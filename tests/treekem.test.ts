import { describe, it, expect } from 'vitest';
import { directPath, copath, updateCost, canDeriveRoot } from '../src/web/treekem';

// Independent oracle: binary ratchet-tree structure. For 8 leaves (levels 1..3), a leaf's direct path is its chain of
// parents to the root (index halves each level); its copath is the sibling at each level (index xor 1, then halve).
// Update cost is log2(n)+1 re-keyed nodes and log2(n) encryptions, versus n-1 pairwise. Expected values are derived by
// hand from the tree, not the code.

describe('directPath — ancestors to the root', () => {
  it('leaf 0 in an 8-member tree', () => {
    expect(directPath(0, 8)).toEqual([{ level: 1, index: 0 }, { level: 2, index: 0 }, { level: 3, index: 0 }]);
  });
  it('leaf 5 in an 8-member tree', () => {
    // 5 -> parent 2 (L1) -> 1 (L2) -> 0 (root L3)
    expect(directPath(5, 8)).toEqual([{ level: 1, index: 2 }, { level: 2, index: 1 }, { level: 3, index: 0 }]);
  });
});

describe('copath — the siblings that get the new secret', () => {
  it('leaf 0’s copath is its sibling leaf and the sibling internal nodes', () => {
    expect(copath(0, 8)).toEqual([{ level: 0, index: 1 }, { level: 1, index: 1 }, { level: 2, index: 1 }]);
  });
  it('a copath has one node per level below the root', () => {
    expect(copath(5, 8)).toHaveLength(3);
  });
});

describe('update cost is logarithmic', () => {
  it('8 members: 4 re-keyed nodes, 3 encryptions, vs 7 pairwise', () => {
    expect(updateCost(8)).toEqual({ members: 8, reKeyed: 4, encryptions: 3, naivePairwise: 7 });
  });
  it('1024 members: 10 encryptions, not 1023', () => {
    const c = updateCost(1024);
    expect(c.encryptions).toBe(10);
    expect(c.naivePairwise).toBe(1023);
  });
});

describe('removal locks the member out', () => {
  it('a removed member can’t derive the new root; others can', () => {
    expect(canDeriveRoot(3, 3)).toBe(false);
    expect(canDeriveRoot(5, 3)).toBe(true);
    expect(canDeriveRoot(5, null)).toBe(true);
  });
});
