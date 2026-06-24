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

// ---- deletion -------------------------------------------------------------------------------
// Deleting is the mirror of inserting. Remove the key from its leaf; if that leaves the node
// below its minimum occupancy it UNDERFLOWS, and we repair it the same two ways insertion grows:
// BORROW one key from an adjacent sibling that has a spare (rotating through the parent separator),
// or MERGE with a sibling when neither can spare one — pulling the separator down for internal
// nodes, just dropping it for leaves (leaves already hold every key). A merge can cascade an
// underflow up to the parent; if the root collapses to a single child, the tree shrinks a level.

const minLeafKeys = (order: number) => Math.floor(order / 2); // ≈ half full (ceil((order-1)/2))
const minInternalKeys = (order: number) => Math.ceil(order / 2) - 1; // ≥ ceil(order/2) children
const underflows = (n: Node, order: number) => n.keys.length < (n.kind === 'leaf' ? minLeafKeys(order) : minInternalKeys(order));

function cloneNode(n: Node): Node {
  return n.kind === 'leaf' ? { kind: 'leaf', keys: [...n.keys] } : { kind: 'internal', keys: [...n.keys], children: n.children.map(cloneNode) };
}

function borrowLeft(parent: Internal, ci: number): void {
  const child = parent.children[ci], left = parent.children[ci - 1];
  if (child.kind === 'leaf' && left.kind === 'leaf') {
    child.keys.unshift(left.keys.pop()!);
    parent.keys[ci - 1] = child.keys[0]; // separator = child's new first key
  } else if (child.kind === 'internal' && left.kind === 'internal') {
    child.keys.unshift(parent.keys[ci - 1]); // rotate the separator down
    child.children.unshift(left.children.pop()!);
    parent.keys[ci - 1] = left.keys.pop()!; // and the sibling's last key up
  }
}

function borrowRight(parent: Internal, ci: number): void {
  const child = parent.children[ci], right = parent.children[ci + 1];
  if (child.kind === 'leaf' && right.kind === 'leaf') {
    child.keys.push(right.keys.shift()!);
    parent.keys[ci] = right.keys[0]; // separator = right sibling's new first key
  } else if (child.kind === 'internal' && right.kind === 'internal') {
    child.keys.push(parent.keys[ci]);
    child.children.push(right.children.shift()!);
    parent.keys[ci] = right.keys.shift()!;
  }
}

/** Merge children[idx] and children[idx+1] into one node, consuming the separator between them. */
function mergeAt(parent: Internal, idx: number): void {
  const a = parent.children[idx], b = parent.children[idx + 1];
  if (a.kind === 'leaf' && b.kind === 'leaf') {
    a.keys = [...a.keys, ...b.keys]; // leaves: separator just disappears
  } else if (a.kind === 'internal' && b.kind === 'internal') {
    a.keys = [...a.keys, parent.keys[idx], ...b.keys]; // internal: pull the separator down
    a.children = [...a.children, ...b.children];
  }
  parent.keys.splice(idx, 1);
  parent.children.splice(idx + 1, 1);
}

function fixUnderflow(parent: Internal, ci: number, order: number): void {
  const left = ci > 0 ? parent.children[ci - 1] : null;
  const right = ci < parent.children.length - 1 ? parent.children[ci + 1] : null;
  const min = parent.children[ci].kind === 'leaf' ? minLeafKeys(order) : minInternalKeys(order);
  if (left && left.keys.length > min) return borrowLeft(parent, ci);
  if (right && right.keys.length > min) return borrowRight(parent, ci);
  if (left) return mergeAt(parent, ci - 1); // merge child into its left sibling
  return mergeAt(parent, ci); //                merge right sibling into child
}

function deleteRec(node: Node, key: number, order: number): void {
  if (node.kind === 'leaf') {
    const i = node.keys.indexOf(key);
    if (i >= 0) node.keys.splice(i, 1);
    return;
  }
  let ci = node.keys.length;
  for (let i = 0; i < node.keys.length; i++) if (key < node.keys[i]) { ci = i; break; }
  deleteRec(node.children[ci], key, order);
  if (underflows(node.children[ci], order)) fixUnderflow(node, ci, order);
}

/** Remove a key, rebalancing by borrow/merge. Returns the new root (collapsed a level if needed). */
export function remove(root: Node, key: number, order: number): Node {
  const r = cloneNode(root);
  deleteRec(r, key, order);
  if (r.kind === 'internal' && r.keys.length === 0) return r.children[0]; // root shrank to one child
  return r;
}
