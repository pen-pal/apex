// The Cartesian tree — a binary tree built from a sequence that is, at the same time, a binary SEARCH tree on
// array position and a min-HEAP on value. From an array A, the root is the position of the minimum element; its
// left subtree is the Cartesian tree of everything to the left of that minimum, its right subtree the tree of
// everything to the right. Recurse. Two beautiful facts fall out. First, an in-order traversal returns the
// original array (it's a BST by index), while every parent's value is <= its children's (it's a heap by value).
// Second — and this is the famous one — the LOWEST COMMON ANCESTOR of positions i and j in the Cartesian tree
// is exactly the position of the MINIMUM of A[i..j]. That means the Range-Minimum-Query problem and the
// Lowest-Common-Ancestor problem are the same problem wearing different clothes: solve one and you've solved the
// other, and this equivalence is the key that unlocks O(n) preprocessing / O(1) query RMQ (via the ±1 RMQ on an
// Euler tour). The tree also builds in O(n) total with a single stack pass — each element pops the stack while
// the top is larger (those become its left subtree), then attaches under whatever remains — so every element is
// pushed and popped at most once. Cartesian trees also underlie the treap (a Cartesian tree on (key, random
// priority) pairs is a balanced BST) and pattern-matching indexes. This models both constructions, the
// heap/BST invariants, and the RMQ=LCA equivalence. Reference: Vuillemin (1980); Gabow, Bentley & Tarjan (1984).

export interface CNode { i: number; val: number; left: number; right: number; parent: number }
export interface Tree { nodes: CNode[]; root: number }

/** Build the min-Cartesian-tree of `a` in O(n) with a single monotonic-stack pass. */
export function build(a: number[]): Tree {
  const nodes: CNode[] = a.map((val, i) => ({ i, val, left: -1, right: -1, parent: -1 }));
  const stack: number[] = []; // indices, values increasing from bottom to top
  for (let i = 0; i < a.length; i++) {
    let last = -1;
    while (stack.length && a[stack[stack.length - 1]] > a[i]) last = stack.pop()!;
    if (last !== -1) { nodes[i].left = last; nodes[last].parent = i; }        // popped subtree hangs left
    if (stack.length) { const t = stack[stack.length - 1]; nodes[t].right = i; nodes[i].parent = t; }
    stack.push(i);
  }
  return { nodes, root: stack.length ? stack[0] : -1 };
}

/** The equivalent recursive definition (root = argmin of the range), for cross-checking. */
export function buildRecursive(a: number[]): Tree {
  const nodes: CNode[] = a.map((val, i) => ({ i, val, left: -1, right: -1, parent: -1 }));
  const rec = (lo: number, hi: number, parent: number): number => {
    if (lo > hi) return -1;
    let m = lo;
    for (let k = lo + 1; k <= hi; k++) if (a[k] < a[m]) m = k;   // left-most minimum
    nodes[m].parent = parent;
    nodes[m].left = rec(lo, m - 1, m);
    nodes[m].right = rec(m + 1, hi, m);
    return m;
  };
  return { nodes, root: rec(0, a.length - 1, -1) };
}

/** In-order traversal — returns the node indices in array order (should be 0..n-1). */
export function inorder(t: Tree): number[] {
  const out: number[] = [];
  const visit = (x: number) => { if (x === -1) return; visit(t.nodes[x].left); out.push(x); visit(t.nodes[x].right); };
  visit(t.root);
  return out;
}

/** Depth of every node from the root. */
function depths(t: Tree): number[] {
  const d = new Array(t.nodes.length).fill(0);
  const visit = (x: number, dep: number) => { if (x === -1) return; d[x] = dep; visit(t.nodes[x].left, dep + 1); visit(t.nodes[x].right, dep + 1); };
  visit(t.root, 0);
  return d;
}

/** Lowest common ancestor of positions i and j (by walking up parent pointers). */
export function lca(t: Tree, i: number, j: number): number {
  const d = depths(t);
  let a = i, b = j;
  while (d[a] > d[b]) a = t.nodes[a].parent;
  while (d[b] > d[a]) b = t.nodes[b].parent;
  while (a !== b) { a = t.nodes[a].parent; b = t.nodes[b].parent; }
  return a;
}

/** Range minimum of a[i..j] via the LCA (the equivalence); returns the position of the minimum. */
export const rmqPos = (t: Tree, i: number, j: number): number => lca(t, i, j);
