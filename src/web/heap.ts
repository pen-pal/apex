// Binary heap / priority queue — a complete binary tree (stored compactly in an array)
// where every parent is ≤ its children (a min-heap), so the smallest element is always at
// the root, readable in O(1). Insert by appending at the end and SIFTING UP (swapping with
// the parent while smaller); remove-min by moving the last element to the root and SIFTING
// DOWN (swapping with the smaller child while larger). Both touch only one root-to-leaf
// path, so they're O(log n). It's the engine behind Dijkstra and A*'s frontier, Huffman
// tree construction, heapsort, and event/task schedulers. Array layout: parent(i)=⌊(i−1)/2⌋,
// children 2i+1 and 2i+2. Pure, tested.

export interface Heap { data: number[] }
export const create = (): Heap => ({ data: [] });

const swap = (a: number[], i: number, j: number) => { [a[i], a[j]] = [a[j], a[i]]; };

/** Insert and sift up; returns the indices visited (for the visualization). */
export function push(h: Heap, value: number): number[] {
  const a = h.data;
  a.push(value);
  let i = a.length - 1;
  const path = [i];
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (a[p] <= a[i]) break;
    swap(a, i, p); i = p; path.push(i);
  }
  return path;
}

/** Remove and return the minimum (the root), sifting the replacement down. */
export function pop(h: Heap): { min: number | null; path: number[] } {
  const a = h.data;
  if (a.length === 0) return { min: null, path: [] };
  const min = a[0];
  const last = a.pop()!;
  if (a.length === 0) return { min, path: [] };
  a[0] = last;
  let i = 0;
  const path = [0];
  for (;;) {
    const l = 2 * i + 1, r = 2 * i + 2;
    let smallest = i;
    if (l < a.length && a[l] < a[smallest]) smallest = l;
    if (r < a.length && a[r] < a[smallest]) smallest = r;
    if (smallest === i) break;
    swap(a, i, smallest); i = smallest; path.push(i);
  }
  return { min, path };
}

export const peek = (h: Heap): number | null => (h.data.length ? h.data[0] : null);

/** Is the heap property satisfied everywhere? (for tests / honesty) */
export function isValid(h: Heap): boolean {
  const a = h.data;
  for (let i = 1; i < a.length; i++) if (a[(i - 1) >> 1] > a[i]) return false;
  return true;
}

/** Pop everything — yields a sorted sequence (heapsort). */
export function drain(h: Heap): number[] {
  const out: number[] = [];
  let r = pop(h);
  while (r.min !== null) { out.push(r.min); r = pop(h); }
  return out;
}
