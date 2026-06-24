// B+tree — the index structure under almost every relational database and filesystem. Keys
// live in sorted leaves linked left-to-right (for fast range scans); internal nodes hold
// only separator keys to route a lookup down to the right leaf. The tree stays balanced by
// SPLITTING: when a node overflows its capacity, it splits in two and pushes a separator up
// to its parent — and when the root splits, the tree grows one level taller. Because every
// leaf is at the same depth, every lookup costs the same O(log n). Pure, tested for the
// B+tree invariants (balanced, sorted, bounded fan-out).

export interface Leaf { kind: 'leaf'; keys: number[] }
export interface Internal { kind: 'internal'; keys: number[]; children: Node[] }
export type Node = Leaf | Internal;

const maxKeys = (order: number) => order - 1; // a node of `order` holds ≤ order-1 keys

function insertSorted(arr: number[], k: number): void {
  let i = arr.length;
  while (i > 0 && arr[i - 1] > k) i--;
  if (arr[i - 1] === k) return; // ignore duplicates
  arr.splice(i, 0, k);
}

interface Split { sepKey: number; right: Node }

function insertRec(node: Node, key: number, order: number): { node: Node; split?: Split } {
  if (node.kind === 'leaf') {
    const keys = [...node.keys];
    insertSorted(keys, key);
    if (keys.length <= maxKeys(order)) return { node: { kind: 'leaf', keys } };
    // overflow → split: right leaf's first key is COPIED up as the separator
    const mid = Math.ceil(keys.length / 2);
    const left: Leaf = { kind: 'leaf', keys: keys.slice(0, mid) };
    const right: Leaf = { kind: 'leaf', keys: keys.slice(mid) };
    return { node: left, split: { sepKey: right.keys[0], right } };
  }
  // internal: route to the child, then absorb any split it returns
  let ci = node.keys.length;
  for (let i = 0; i < node.keys.length; i++) if (key < node.keys[i]) { ci = i; break; }
  const res = insertRec(node.children[ci], key, order);
  const keys = [...node.keys];
  const children = [...node.children];
  children[ci] = res.node;
  if (!res.split) return { node: { kind: 'internal', keys, children } };
  keys.splice(ci, 0, res.split.sepKey);
  children.splice(ci + 1, 0, res.split.right);
  if (keys.length <= maxKeys(order)) return { node: { kind: 'internal', keys, children } };
  // internal overflow → split: the middle separator MOVES up (not copied)
  const mid = Math.floor(keys.length / 2);
  const sepKey = keys[mid];
  const left: Internal = { kind: 'internal', keys: keys.slice(0, mid), children: children.slice(0, mid + 1) };
  const right: Internal = { kind: 'internal', keys: keys.slice(mid + 1), children: children.slice(mid + 1) };
  return { node: left, split: { sepKey, right } };
}

export function insert(root: Node, key: number, order: number): Node {
  const res = insertRec(root, key, order);
  if (!res.split) return res.node;
  return { kind: 'internal', keys: [res.split.sepKey], children: [res.node, res.split.right] };
}

export const emptyTree = (): Node => ({ kind: 'leaf', keys: [] });
export const build = (keys: number[], order: number): Node => keys.reduce((t, k) => insert(t, k, order), emptyTree());

/** All keys in order, read straight off the leaves left to right. */
export function leafScan(node: Node): number[] {
  if (node.kind === 'leaf') return [...node.keys];
  return node.children.flatMap(leafScan);
}

export function height(node: Node): number {
  return node.kind === 'leaf' ? 1 : 1 + height(node.children[0]);
}

/** Depths at which leaves appear — a B+tree is balanced iff this set has size 1. */
export function leafDepths(node: Node, d = 1, acc = new Set<number>()): Set<number> {
  if (node.kind === 'leaf') acc.add(d);
  else for (const c of node.children) leafDepths(c, d + 1, acc);
  return acc;
}
