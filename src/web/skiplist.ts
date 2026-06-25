// Skip list (Pugh, 1990) — a sorted structure that gives B-tree-like O(log n) search with
// nothing but linked lists and coin flips, which is why it backs Redis sorted sets and many
// LSM memtables. Level 0 is an ordinary sorted linked list holding every key; each higher
// level is a sparser "express lane" — a node is promoted to the next level up with
// probability ½, so the lanes thin out geometrically. A search rides the highest lane
// rightward until the next key would overshoot, then drops down a level, repeating — so it
// skips over most nodes. Heights are injected here (instead of random) so the structure is
// deterministic and testable.

export interface SkipNode { key: number; next: (SkipNode | null)[] }
export interface SkipList { head: (SkipNode | null)[]; maxLevel: number }

export const create = (maxLevel = 4): SkipList => ({ head: new Array(maxLevel).fill(null), maxLevel });

/** Insert `key` so it participates in levels 0..height-1. */
export function insert(list: SkipList, key: number, height: number): void {
  height = Math.max(1, Math.min(height, list.maxLevel)); // always at least level 0, never above maxLevel
  const update: (SkipNode | null)[] = new Array(list.maxLevel).fill(null); // predecessor at each level
  // descend from the top, recording where we drop down
  let node: SkipNode | null = null;
  for (let level = list.maxLevel - 1; level >= 0; level--) {
    while (true) {
      const nxt: SkipNode | null = node ? node.next[level] : list.head[level];
      if (nxt && nxt.key < key) node = nxt; else break;
    }
    update[level] = node;
  }
  const fresh: SkipNode = { key, next: new Array(height).fill(null) };
  for (let l = 0; l < height; l++) {
    const pred = update[l];
    if (pred) { fresh.next[l] = pred.next[l]; pred.next[l] = fresh; }
    else { fresh.next[l] = list.head[l]; list.head[l] = fresh; }
  }
}

/** Remove `key` from every level it participates in. Returns whether it was present. */
export function remove(list: SkipList, key: number): boolean {
  const update: (SkipNode | null)[] = new Array(list.maxLevel).fill(null);
  let node: SkipNode | null = null;
  for (let level = list.maxLevel - 1; level >= 0; level--) {
    while (true) {
      const nxt: SkipNode | null = node ? node.next[level] : list.head[level];
      if (nxt && nxt.key < key) node = nxt; else break;
    }
    update[level] = node;
  }
  const target = node ? node.next[0] : list.head[0];
  if (!target || target.key !== key) return false; // not present
  for (let l = 0; l < list.maxLevel; l++) {
    const pred = update[l];
    if ((pred ? pred.next[l] : list.head[l]) === target) { // target is on this level → unlink it
      if (pred) pred.next[l] = target.next[l]; else list.head[l] = target.next[l];
    }
  }
  return true;
}

export interface SearchResult { found: boolean; visited: number[]; hops: number }

/** Search for `key`, recording the keys visited so the express-lane skipping is visible. */
export function search(list: SkipList, key: number): SearchResult {
  const visited: number[] = [];
  let node: SkipNode | null = null;
  for (let level = list.maxLevel - 1; level >= 0; level--) {
    while (true) {
      const nxt: SkipNode | null = node ? node.next[level] : list.head[level];
      if (nxt && nxt.key < key) { node = nxt; visited.push(node.key); } else break;
    }
  }
  const candidate = node ? node.next[0] : list.head[0];
  if (candidate && candidate.key === key) visited.push(candidate.key);
  return { found: !!candidate && candidate.key === key, visited, hops: visited.length };
}

/** Level-0 keys in order (the complete sorted sequence). */
export function toArray(list: SkipList): number[] {
  const out: number[] = [];
  for (let n = list.head[0]; n; n = n.next[0]) out.push(n.key);
  return out;
}

/** How many levels each key reaches (for display), keyed by key. */
export function heights(list: SkipList): Record<number, number> {
  const h: Record<number, number> = {};
  for (let lvl = 0; lvl < list.maxLevel; lvl++) for (let n = list.head[lvl]; n; n = n.next[lvl]) h[n.key] = Math.max(h[n.key] ?? 0, lvl + 1);
  return h;
}
