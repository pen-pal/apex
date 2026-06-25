import { describe, it, expect } from 'vitest';
import { encode, decode, next, bitFields, TWITTER_EPOCH, MAX_SEQUENCE, type GenState } from '../src/web/snowflake';

const E = TWITTER_EPOCH;

describe('Snowflake bit-packing', () => {
  it('places each field at the right shift', () => {
    expect(encode(E + 5000n, 0n, 0n)).toBe(5000n << 22n);     // timestamp only
    expect(encode(E, 3n, 0n)).toBe(3n << 12n);                // worker only = 12288
    expect(encode(E, 0n, 7n)).toBe(7n);                       // sequence only
    expect(encode(E, 1n, 1n)).toBe((1n << 12n) | 1n);         // 4097
  });

  it('round-trips through decode', () => {
    const id = encode(E + 123456n, 42n, 1000n);
    const p = decode(id);
    expect(p.tsMs).toBe(E + 123456n);
    expect(p.worker).toBe(42n);
    expect(p.sequence).toBe(1000n);
  });

  it('IDs sort by time (k-sortable): later timestamp ⇒ larger ID', () => {
    expect(encode(E + 2n, 1023n, 4095n) < encode(E + 3n, 0n, 0n)).toBe(true);
  });
});

describe('generation with sequence roll-over', () => {
  it('increments the sequence within the same millisecond', () => {
    let s: GenState = { lastMs: 0n, sequence: 0n };
    const ids: bigint[] = [];
    for (let i = 0; i < 3; i++) { const r = next(s, E + 100n, 5n); s = r.state; ids.push(r.id); }
    expect(ids.map((id) => decode(id).sequence)).toEqual([0n, 1n, 2n]);
    expect(ids[0] < ids[1] && ids[1] < ids[2]).toBe(true); // strictly increasing
  });

  it('resets the sequence to 0 on a new millisecond', () => {
    const s: GenState = { lastMs: E + 100n, sequence: 9n };
    const r = next(s, E + 101n, 5n);
    expect(decode(r.id).sequence).toBe(0n);
  });

  it('rolls into the next millisecond when the sequence is exhausted', () => {
    const s: GenState = { lastMs: E + 100n, sequence: MAX_SEQUENCE };
    const r = next(s, E + 100n, 5n);
    expect(r.rolledOver).toBe(true);
    expect(decode(r.id).tsMs).toBe(E + 101n);
    expect(decode(r.id).sequence).toBe(0n);
  });
});

describe('bit field display', () => {
  it('splits a 64-bit id into sign/timestamp/worker/sequence widths', () => {
    const f = bitFields(encode(E + 5000n, 3n, 7n));
    expect(f.sign.length).toBe(1);
    expect(f.timestamp.length).toBe(41);
    expect(f.worker.length).toBe(10);
    expect(f.sequence.length).toBe(12);
    expect(parseInt(f.worker, 2)).toBe(3);
    expect(parseInt(f.sequence, 2)).toBe(7);
  });
});

describe('monotonicity across roll-over and clock regression', () => {
  const E = TWITTER_EPOCH;
  it('stays strictly increasing when the clock has not caught up after a roll-over', () => {
    // exhaust ms E+100 → spills to E+101/seq0
    const r1 = next({ lastMs: E + 100n, sequence: MAX_SEQUENCE }, E + 100n, 1n);
    expect(r1.rolledOver).toBe(true);
    expect(decode(r1.id).tsMs).toBe(E + 101n);
    // the wall clock is STILL at E+100 — the next ID must not regress to E+100
    const r2 = next(r1.state, E + 100n, 1n);
    expect(r2.id).toBeGreaterThan(r1.id); // strictly increasing (was a smaller, duplicate ID before the fix)
    expect(decode(r2.id).tsMs).toBe(E + 101n); // no timestamp regression
    expect(decode(r2.id).sequence).toBe(1n);
  });
  it('does not go backward on a backward clock step', () => {
    const a = next({ lastMs: E + 200n, sequence: 0n }, E + 199n, 1n); // clock jumped back 1ms
    expect(a.id).toBeGreaterThan(encode(E + 200n, 1n, 0n)); // still ahead of the last minted id
    expect(decode(a.id).tsMs).toBe(E + 200n); // pinned to lastMs, not the regressed clock
  });
});
