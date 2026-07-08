// MLS / TreeKEM — how a group of thousands keeps one shared key fresh in O(log n) instead of O(n). Members are the
// leaves of a binary ratchet tree; each member knows the secrets on the path from its leaf up to the root, and the
// group key sits at the root. When a member updates its key (or joins/leaves), only the nodes on its DIRECT PATH (leaf
// to root) are re-keyed, and the fresh secret for each is encrypted to the SIBLING subtree (the copath) so every other
// member can recompute the new root. That's log n re-keys and log n encryptions per change, versus n-1 if you re-keyed
// pairwise. This computes the exact tree structure and cost; the HPKE encryptions themselves are out of scope.

export interface Node { level: number; index: number }

const levelsFor = (n: number) => Math.log2(n); // n members = 2^levels leaves; root sits at `levels`

// The internal nodes from a leaf up to the root (the nodes whose secrets get replaced on an update).
export function directPath(leaf: number, n: number): Node[] {
  const levels = levelsFor(n);
  const path: Node[] = [];
  let idx = leaf;
  for (let level = 1; level <= levels; level++) {
    idx = idx >> 1;
    path.push({ level, index: idx });
  }
  return path;
}

// The sibling of each node on the path leaf→root — the subtree that must be sent the new node secret. The first entry
// is the leaf's sibling leaf; the rest are internal siblings.
export function copath(leaf: number, n: number): Node[] {
  const levels = levelsFor(n);
  const co: Node[] = [];
  let idx = leaf;
  for (let level = 0; level < levels; level++) {
    co.push({ level, index: idx ^ 1 }); // sibling at this level
    idx = idx >> 1;
  }
  return co;
}

export interface Cost { members: number; reKeyed: number; encryptions: number; naivePairwise: number }
export function updateCost(n: number): Cost {
  const levels = levelsFor(n);
  return { members: n, reKeyed: levels + 1, encryptions: levels, naivePairwise: n - 1 };
}

// After member `removed` is evicted, can `member` still derive the new root secret? Everyone in the group can; the
// removed member's leaf is blanked and the path re-keyed, so it cannot.
export function canDeriveRoot(member: number, removed: number | null): boolean {
  return member !== removed;
}
