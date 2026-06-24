import { describe, it, expect } from 'vitest';
import { analyze, intersects, worstCase } from '../src/web/quorumrw';

describe('quorum analysis (Dynamo math)', () => {
  it('N=3 R=2 W=2 — the classic default: strong and conflict-free', () => {
    const a = analyze({ n: 3, r: 2, w: 2 });
    expect(a.overlap).toBe(1);          // 2 + 2 − 3
    expect(a.strongRead).toBe(true);    // R + W > N
    expect(a.writeConflictFree).toBe(true); // 2·2 = 4 > 3
  });

  it('N=3 R=1 W=1 — eventually consistent (R+W not > N)', () => {
    const a = analyze({ n: 3, r: 1, w: 1 });
    expect(a.overlap).toBe(0);
    expect(a.strongRead).toBe(false);
    expect(a.profile).toMatch(/[Ee]ventual/);
  });

  it('N=3 R=3 W=1 — strong reads but writes can conflict (2W ≤ N)', () => {
    const a = analyze({ n: 3, r: 3, w: 1 });
    expect(a.strongRead).toBe(true);        // 3 + 1 > 3
    expect(a.writeConflictFree).toBe(false); // 2·1 = 2 < 3
  });

  it('N=5 R=3 W=3 — majority quorum is strong and conflict-free', () => {
    const a = analyze({ n: 5, r: 3, w: 3 });
    expect(a.overlap).toBe(1);
    expect(a.strongRead).toBe(true);
    expect(a.writeConflictFree).toBe(true);
  });
});

describe('the pigeonhole guarantee', () => {
  it('when R+W>N, even the worst-case placement still shares a node', () => {
    for (const c of [{ n: 3, r: 2, w: 2 }, { n: 5, r: 3, w: 3 }, { n: 7, r: 4, w: 4 }]) {
      expect(worstCase(c).shared.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('when R+W≤N, a disjoint placement exists (stale read possible)', () => {
    // N=4, R=2, W=2: write {0,1}, read {2,3} → no overlap
    expect(intersects([2, 3], [0, 1])).toEqual([]);
    expect(analyze({ n: 4, r: 2, w: 2 }).strongRead).toBe(false);
  });
});
