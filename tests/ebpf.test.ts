import { describe, it, expect } from 'vitest';
import { verify, runXdp, score, DEFAULT_PACKETS, type Program } from '../src/web/ebpf';

// Independent oracle: the verifier's contract and XDP semantics. A program loads iff it terminates (bounded loop),
// stays in bounds, is under the size limit, and uses only allowed helpers; any single violation is rejected with the
// matching reason. A loaded XDP filter drops exactly the flood (blocklisted) packets and passes the rest; a rejected
// program never attaches, so every packet passes. Expected outcomes are derived from those rules, not the model.

const ok = (): Program => ({ boundedLoop: true, checksBounds: true, smallEnough: true, safeHelpers: true });

describe('the verifier', () => {
  it('accepts a program that satisfies every check', () => {
    expect(verify(ok()).loaded).toBe(true);
  });
  it('rejects an unbounded loop (can’t prove termination)', () => {
    const v = verify({ ...ok(), boundedLoop: false });
    expect(v.loaded).toBe(false);
    expect(v.reason).toMatch(/terminate|loop|bound/i);
  });
  it('rejects an out-of-bounds packet read', () => {
    const v = verify({ ...ok(), checksBounds: false });
    expect(v.loaded).toBe(false);
    expect(v.reason).toMatch(/memory|bounds|data_end/i);
  });
  it('rejects a program over the complexity limit', () => {
    expect(verify({ ...ok(), smallEnough: false }).loaded).toBe(false);
    expect(verify({ ...ok(), smallEnough: false }).reason).toMatch(/large|limit|complexity/i);
  });
  it('rejects a disallowed helper call', () => {
    expect(verify({ ...ok(), safeHelpers: false }).loaded).toBe(false);
    expect(verify({ ...ok(), safeHelpers: false }).reason).toMatch(/helper/i);
  });
});

describe('XDP at the hook', () => {
  const packets = DEFAULT_PACKETS();
  const floodCount = packets.filter((p) => p.flood).length;
  const legitCount = packets.length - floodCount;

  it('a loaded filter drops exactly the flood and passes the legit traffic', () => {
    const s = score(runXdp(true, packets));
    expect(s.dropped).toBe(floodCount);
    expect(s.floodThrough).toBe(0);
    expect(s.legitPassed).toBe(legitCount);
  });
  it('when the program was rejected, nothing runs and the whole flood gets through', () => {
    const s = score(runXdp(false, packets));
    expect(s.dropped).toBe(0);
    expect(s.floodThrough).toBe(floodCount);
    expect(s.legitPassed).toBe(legitCount);
  });
  it('DROP happens only for flood packets', () => {
    for (const r of runXdp(true, packets)) {
      expect(r.action).toBe(r.packet.flood ? 'DROP' : 'PASS');
    }
  });
});
