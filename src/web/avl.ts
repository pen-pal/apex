// AVL tree (Adelson-Velsky & Landis, 1962) — a binary search tree that keeps itself balanced
// after every insert, so search/insert/delete stay O(log n) instead of degrading to a linked
// list on sorted input. Each node tracks its height; the BALANCE FACTOR (left height − right
// height) must stay in {−1, 0, +1}. When an insert pushes it to ±2, a ROTATION restores
// balance — four cases (LL, RR, LR, RL) depending on where the new node landed. Rotations are
// local pointer rewires that preserve the in-order (sorted) sequence. Pure, tested for the BST
// + balance invariants and the canonical rotation cases.

export interface Node { key: number; height: number; left: Node | null; right: Node | null }

const h = (n: Node | null): number => (n ? n.height : 0);
const bf = (n: Node | null): number => (n ? h(n.left) - h(n.right) : 0);
const fix = (n: Node): Node => { n.height = 1 + Math.max(h(n.left), h(n.right)); return n; };
const node = (key: number): Node => ({ key, height: 1, left: null, right: null });

function rotateRight(y: Node): Node { const x = y.left!; y.left = x.right; x.right = y; fix(y); return fix(x); }
function rotateLeft(x: Node): Node { const y = x.right!; x.right = y.left; y.left = x; fix(x); return fix(y); }

export function insert(root: Node | null, key: number): Node {
  if (!root) return node(key);
  if (key < root.key) root.left = insert(root.left, key);
  else if (key > root.key) root.right = insert(root.right, key);
  else return root; // ignore duplicates
  fix(root);

  const balance = bf(root);
  if (balance > 1 && key < root.left!.key) return rotateRight(root);              // LL
  if (balance < -1 && key > root.right!.key) return rotateLeft(root);             // RR
  if (balance > 1 && key > root.left!.key) { root.left = rotateLeft(root.left!); return rotateRight(root); }   // LR
  if (balance < -1 && key < root.right!.key) { root.right = rotateRight(root.right!); return rotateLeft(root); } // RL
  return root;
}

export const build = (keys: number[]): Node | null => keys.reduce<Node | null>((t, k) => insert(t, k), null);

/** In-order traversal — yields the keys in sorted order (the BST invariant). */
export function inorder(n: Node | null, out: number[] = []): number[] {
  if (n) { inorder(n.left, out); out.push(n.key); inorder(n.right, out); }
  return out;
}

export const height = h;
export const balanceFactor = bf;

/** Is this a valid AVL tree (BST order + every balance factor in {−1,0,+1})? */
export function isAvl(n: Node | null, lo = -Infinity, hi = Infinity): boolean {
  if (!n) return true;
  if (n.key <= lo || n.key >= hi) return false;            // BST order
  if (Math.abs(bf(n)) > 1) return false;                   // balance
  if (n.height !== 1 + Math.max(h(n.left), h(n.right))) return false; // height cached correctly
  return isAvl(n.left, lo, n.key) && isAvl(n.right, n.key, hi);
}
