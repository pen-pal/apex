// The pairing heap — a heap that is trivially simple to implement yet fast enough that it's a standard choice for
// Dijkstra and Prim (it's in Boost and the GNU C++ policy library). A binary heap lives in an array and is great
// for push/pop, but it can't cheaply MERGE two heaps or decrease a key — operations a shortest-path algorithm
// leans on. Mergeable heaps fix that; the pairing heap is the one that's both easy and fast in practice. It's a
// single multi-way tree obeying the heap property (every node's key <= its children's), and almost everything is
// built from one primitive, MELD: to merge two heaps, compare roots and hang the larger-rooted tree as the new
// first child of the smaller root — O(1). insert is meld with a one-node heap; find-min is just the root. The
// only real work is DELETE-MIN: remove the root and you're left with a forest of its children to recombine. The
// naive way — meld them left to right into one — is what makes the amortized cost bad; the pairing heap's trick
// is a TWO-PASS merge. Pass 1 melds the children in PAIRS left to right (this is the "pairing" the name refers
// to), halving the count; pass 2 folds those results right to left into one tree. This simple change is what
// gives the good amortized bounds (O(1) insert/meld, and delete-min in O(log n) amortized). The exact
// complexity of decrease-key is famously still open — pairing heaps are conjectured but not proven to match the
// Fibonacci heap's O(1) — yet they beat Fibonacci heaps in practice because their constants are tiny and they
// have no parent pointers or bookkeeping. This models meld, insert, the two-pass delete-min, and heapsort.
// Reference: Fredman, Sedgewick, Sleator & Tarjan, "The pairing heap" (1986).

export interface PNode { key: number; children: PNode[] }
export type Heap = PNode | null;

/** Meld two heaps: the smaller root adopts the larger-rooted tree as its new first child. O(1). */
export function meld(a: Heap, b: Heap): Heap {
  if (a === null) return b;
  if (b === null) return a;
  return a.key <= b.key
    ? { key: a.key, children: [b, ...a.children] }
    : { key: b.key, children: [a, ...b.children] };
}

export const insert = (h: Heap, key: number): Heap => meld(h, { key, children: [] });
export const findMin = (h: Heap): number | null => (h ? h.key : null);

/** Two-pass merge of a child forest: pair left-to-right, then fold right-to-left. */
export function twoPass(list: PNode[]): Heap {
  if (list.length === 0) return null;
  const paired: Heap[] = [];
  for (let i = 0; i + 1 < list.length; i += 2) paired.push(meld(list[i], list[i + 1])); // pass 1: pairs
  if (list.length % 2 === 1) paired.push(list[list.length - 1]);
  let acc: Heap = paired[paired.length - 1];
  for (let i = paired.length - 2; i >= 0; i--) acc = meld(paired[i], acc);              // pass 2: fold right→left
  return acc;
}

/** Remove and return the minimum; the root's children are recombined by the two-pass merge. */
export function deleteMin(h: Heap): { min: number | null; heap: Heap } {
  if (h === null) return { min: null, heap: null };
  return { min: h.key, heap: twoPass(h.children) };
}

/** Build a heap by inserting a sequence of keys. */
export const fromKeys = (keys: number[]): Heap => keys.reduce<Heap>((h, k) => insert(h, k), null);

/** Repeatedly delete-min → the keys in sorted order (heapsort). */
export function drain(h: Heap): number[] {
  const out: number[] = [];
  let cur = h;
  while (cur !== null) { const { min, heap } = deleteMin(cur); out.push(min!); cur = heap; }
  return out;
}

/** Verify the heap-order invariant everywhere (every parent <= its children). */
export function isHeap(h: Heap): boolean {
  if (h === null) return true;
  return h.children.every((c) => h.key <= c.key && isHeap(c));
}
