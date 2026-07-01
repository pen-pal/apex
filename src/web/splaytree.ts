// Splay tree — a binary search tree that REBALANCES ITSELF around whatever you just touched. Every time you
// look up (or insert) a key, the tree rotates that node all the way up to the root by a sequence of
// zig / zig-zig / zig-zag rotations. No balance factors, no colors, no height fields — just "move what you
// touched to the top." The payoff is temporal locality for free: a key you access often (or just accessed)
// sits near the root and is found in O(1); the whole structure adapts to your access pattern. Individual
// operations can be O(n) in the worst case, but the AMORTIZED cost over any sequence is O(log n), and on
// skewed workloads it beats a balanced tree. Used in some caches, the Linux kernel (vma lookups historically),
// and network routing tables. Reference: Sleator & Tarjan, "Self-Adjusting Binary Search Trees" (1985).

export interface SNode { key: number; left: SNode | null; right: SNode | null }

const rotR = (t: SNode): SNode => { const l = t.left!; t.left = l.right; l.right = t; return l; };
const rotL = (t: SNode): SNode => { const r = t.right!; t.right = r.left; r.left = t; return r; };

/** Top-down-ish recursive splay: bring `key` (or the last node on its search path) to the root of `t`. */
export function splay(t: SNode | null, key: number): SNode | null {
  if (!t || t.key === key) return t;
  if (key < t.key) {
    if (!t.left) return t;                                   // key not present, stop at t
    if (key < t.left.key) { t.left.left = splay(t.left.left, key); t = rotR(t); }        // zig-zig
    else if (key > t.left.key) { t.left.right = splay(t.left.right, key); if (t.left.right) t.left = rotL(t.left); } // zig-zag
    return t.left ? rotR(t) : t;                             // zig
  } else {
    if (!t.right) return t;
    if (key > t.right.key) { t.right.right = splay(t.right.right, key); t = rotL(t); }    // zig-zig
    else if (key < t.right.key) { t.right.left = splay(t.right.left, key); if (t.right.left) t.right = rotR(t.right); } // zig-zag
    return t.right ? rotL(t) : t;                            // zig
  }
}

export class SplayTree {
  root: SNode | null = null;

  /** Insert a key; the new node becomes the root (splay-based insert). */
  insert(key: number): void {
    if (!this.root) { this.root = { key, left: null, right: null }; return; }
    this.root = splay(this.root, key)!;
    if (this.root.key === key) return; // already present
    const n: SNode = { key, left: null, right: null };
    if (key < this.root.key) { n.right = this.root; n.left = this.root.left; this.root.left = null; }
    else { n.left = this.root; n.right = this.root.right; this.root.right = null; }
    this.root = n;
  }

  /** Look up a key, splaying it (or its search-path end) to the root. Returns whether it was found and the
   *  access COST — how deep the key was before splaying (this is what a repeat access saves). */
  find(key: number): { found: boolean; cost: number } {
    const cost = this.depthOf(key); // depth on the search path before we move it
    this.root = splay(this.root, key);
    return { found: this.root?.key === key, cost: cost < 0 ? this.searchDepth(key) : cost };
  }

  /** Depth of a key currently in the tree (0 = root), or -1 if absent. */
  depthOf(key: number): number {
    let n = this.root, d = 0;
    while (n) { if (key === n.key) return d; n = key < n.key ? n.left : n.right; d++; }
    return -1;
  }
  /** Comparisons a search for an absent key would make (its search-path length). */
  private searchDepth(key: number): number {
    let n = this.root, d = 0;
    while (n) { n = key < n.key ? n.left : n.right; d++; }
    return d;
  }

  /** In-order keys — must always be sorted (the BST invariant), no matter how much splaying happened. */
  inorder(): number[] {
    const out: number[] = [];
    const go = (n: SNode | null) => { if (!n) return; go(n.left); out.push(n.key); go(n.right); };
    go(this.root);
    return out;
  }

  rootKey(): number | null { return this.root?.key ?? null; }
  height(): number {
    const h = (n: SNode | null): number => (n ? 1 + Math.max(h(n.left), h(n.right)) : 0);
    return h(this.root);
  }
}
