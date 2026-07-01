import { describe, it, expect } from 'vitest';
import { decode, encode, Dram, DDR4, T, refreshesPerWindow } from '../src/web/dram';

describe('physical address decode', () => {
  it('splits an address into burst / column / bank / row and is invertible', () => {
    let s = 1; const rnd = (n: number) => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s % n; };
    for (let i = 0; i < 20000; i++) { const a = rnd(0x40000000); expect(encode(decode(a))).toBe(a); }
  });
  it('column occupies the low bits above the burst offset', () => {
    expect(decode(0)).toEqual({ burst: 0, column: 0, bank: 0, row: 0 });
    expect(decode(8).column).toBe(1);                 // 8 = one column past the 8-byte burst
    expect(decode(1 << 17)).toMatchObject({ bank: 0, row: 1 }); // one row up in bank 0
  });
});

describe('row buffer: hit / miss / conflict', () => {
  it('the first access to an idle bank misses, then same-row accesses hit', () => {
    const d = new Dram();
    const states = [0, 8, 16, 24].map((a) => d.access(a).state);
    expect(states).toEqual(['miss', 'hit', 'hit', 'hit']);
  });
  it('a different row in the same bank is a conflict (precharge + activate + read)', () => {
    const d = new Dram();
    d.access(0);
    const r = d.access(1 << 17);                       // same bank, next row
    expect(r.state).toBe('conflict');
    expect(r.latencyNs).toBeCloseTo(T.RP + T.RCD + T.CL, 5);
  });
  it('a different bank has its own row buffer (independent, no conflict)', () => {
    const d = new Dram();
    d.access(0);
    const other = d.access(1 << (DDR4.burstBits + DDR4.colBits)); // set a bank bit
    expect(decode(1 << (DDR4.burstBits + DDR4.colBits)).bank).toBe(1);
    expect(other.state).toBe('miss');                 // bank 1 idle, not a conflict with bank 0
    expect(d.access(0).state).toBe('hit');            // bank 0's row stayed open
  });
  it('latencies follow the model: hit < miss < conflict', () => {
    expect(T.CL).toBeLessThan(T.RCD + T.CL);
    expect(T.RCD + T.CL).toBeLessThan(T.RP + T.RCD + T.CL);
  });
});

describe('refresh', () => {
  it('a device is fully refreshed once per retention window (one command per row)', () => {
    expect(refreshesPerWindow(8192)).toBe(8192);
    expect(T.retentionMs).toBe(64);                   // the classic ~64 ms retention
  });
});
