import { describe, it, expect } from 'vitest';
import { knock, runKnocks, type KnockState } from '../src/web/portknock';

// Independent oracle: the sequence-matcher semantics of a port-knock daemon. The exact ordered sequence opens the
// port; any deviation resets progress (a knock of the first port re-starts). Outcomes are worked out from those rules
// on hand-built knock lists, not from the implementation.

const SECRET = [7000, 8000, 9000];

describe('port knocking sequence', () => {
  it('the exact sequence opens the port', () => {
    expect(runKnocks(SECRET, [7000, 8000, 9000]).opened).toBe(true);
  });
  it('a partial sequence does not open it', () => {
    const s = runKnocks(SECRET, [7000, 8000]);
    expect(s.opened).toBe(false);
    expect(s.progress).toBe(2);
  });
  it('wrong order does not open it', () => {
    expect(runKnocks(SECRET, [7000, 9000, 8000]).opened).toBe(false);
    expect(runKnocks(SECRET, [8000, 7000, 9000]).opened).toBe(false);
  });
  it('a stray wrong knock resets progress, but the sequence can still be completed after', () => {
    // 7000,8000 (progress 2) → 3000 is wrong and not the first port → reset to 0 → then the full sequence opens
    expect(runKnocks(SECRET, [7000, 8000, 3000, 7000, 8000, 9000]).opened).toBe(true);
    // reset happens: after the stray knock, a partial [7000] alone leaves it closed
    expect(runKnocks(SECRET, [7000, 8000, 3000, 7000]).opened).toBe(false);
  });
  it('a wrong knock that equals the first port restarts a fresh attempt (not a dead reset)', () => {
    // 7000,7000: second 7000 mismatches secret[1] but equals secret[0] → progress back to 1, then 8000,9000 opens
    expect(runKnocks(SECRET, [7000, 7000, 8000, 9000]).opened).toBe(true);
  });
  it('a leading junk knock is ignored, then the sequence opens', () => {
    expect(runKnocks(SECRET, [3000, 7000, 8000, 9000]).opened).toBe(true);
  });
  it('a blind port scan never hits the exact sequence', () => {
    const scan = [1, 22, 80, 443, 3000, 3389, 5000, 7000, 5000, 8000, 9000]; // scanning, not knocking in order
    expect(runKnocks(SECRET, scan).opened).toBe(false);
  });
  it('once open it stays open regardless of later knocks', () => {
    const open: KnockState = runKnocks(SECRET, [7000, 8000, 9000]);
    expect(knock(open, 1234, SECRET).opened).toBe(true);
  });
});
