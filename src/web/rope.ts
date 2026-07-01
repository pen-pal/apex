// The rope — how a text editor holds a huge document so that inserting a character in the middle isn't O(n).
// A flat string (or array) is great for reads but brutal for edits: inserting one byte at the front of a 100 MB
// file shifts all 100 MB. A rope stores the text as the leaves of a balanced binary tree; each internal node
// caches the total length of its LEFT subtree (its "weight"). That single number turns navigation into a tree
// walk: to find character i, compare i to the weight — go left if smaller, else go right subtracting the weight —
// so index, split, insert, delete, and concat are all O(log n) instead of O(n). Concatenation is nearly free
// (make a new root over the two ropes), and because nodes are immutable and shared, every edit can keep the old
// version alive for free undo/redo. The catch is balance — naive concatenation can grow a lopsided tree, so real
// ropes rebalance (or use a balanced variant); this model keeps the operations exact and leaves balancing to the
// prose. Ropes (and their cousins the gap buffer and piece table) are why editors open gigabyte files instantly
// and why splicing text stays fast no matter the size. This models index/split/concat/insert/delete against a
// reference string. Reference: Boehm, Atkinson & Plass, "Ropes: an Alternative to Strings" (1995).

export type Rope = { text: string } | { left: Rope; right: Rope; weight: number };

const isLeaf = (r: Rope): r is { text: string } => 'text' in r;
export const leaf = (text: string): Rope => ({ text });

export function length(r: Rope): number { return isLeaf(r) ? r.text.length : r.weight + length(r.right); }

/** Concatenate two ropes in O(1): a new root whose left-weight is |a|. */
export const concat = (a: Rope, b: Rope): Rope => ({ left: a, right: b, weight: length(a) });

/** The character at position i — a tree walk guided by the weights. */
export function index(r: Rope, i: number): string {
  if (isLeaf(r)) return r.text[i];
  return i < r.weight ? index(r.left, i) : index(r.right, i - r.weight);
}

/** Split the rope into [first i characters, the rest]. */
export function split(r: Rope, i: number): [Rope, Rope] {
  if (isLeaf(r)) return [leaf(r.text.slice(0, i)), leaf(r.text.slice(i))];
  if (i < r.weight) { const [ll, lr] = split(r.left, i); return [ll, concat(lr, r.right)]; }
  if (i > r.weight) { const [rl, rr] = split(r.right, i - r.weight); return [concat(r.left, rl), rr]; }
  return [r.left, r.right]; // i === weight: clean cut at the node boundary
}

/** Insert string s at position i (split + graft + join) — O(log n), old rope untouched. */
export function insert(r: Rope, i: number, s: string): Rope {
  const [l, right] = split(r, i);
  return concat(concat(l, leaf(s)), right);
}

/** Delete characters [i, j). */
export function del(r: Rope, i: number, j: number): Rope {
  const [l, rest] = split(r, i);
  const [, right] = split(rest, j - i);
  return concat(l, right);
}

/** Reconstruct the full string (in-order leaf concatenation). */
export function toStr(r: Rope): string { return isLeaf(r) ? r.text : toStr(r.left) + toStr(r.right); }

/** Tree depth — the cost of an operation; a balanced rope keeps this ~log(n). */
export function depth(r: Rope): number { return isLeaf(r) ? 0 : 1 + Math.max(depth(r.left), depth(r.right)); }

/** Build a rope from chunks (a balanced merge, so depth ~ log(chunks)). */
export function fromChunks(chunks: string[]): Rope {
  if (chunks.length === 0) return leaf('');
  let level: Rope[] = chunks.map(leaf);
  while (level.length > 1) {
    const next: Rope[] = [];
    for (let i = 0; i < level.length; i += 2) next.push(i + 1 < level.length ? concat(level[i], level[i + 1]) : level[i]);
    level = next;
  }
  return level[0];
}
