// Trie (prefix tree) — a tree keyed by the characters of a string, so every word that
// shares a prefix shares a path from the root. That makes prefix questions trivial:
// autocomplete is "walk to the prefix node, then list every word below it," and lookup is
// O(length of key) regardless of how many keys are stored. The same structure, keyed by the
// bits of an address, does longest-prefix-match in IP routing tables. Pure, tested.

export interface TrieNode { children: Record<string, TrieNode>; end: boolean }

export const create = (): TrieNode => ({ children: {}, end: false });

export function insert(root: TrieNode, word: string): void {
  let node = root;
  for (const ch of word) {
    node = node.children[ch] ?? (node.children[ch] = create());
  }
  node.end = true;
}

/** Walk to the node at the end of `path`, or null if the path isn't present. */
function descend(root: TrieNode, path: string): TrieNode | null {
  let node: TrieNode = root;
  for (const ch of path) {
    const next = node.children[ch];
    if (!next) return null;
    node = next;
  }
  return node;
}

/** Is `word` a complete stored key? */
export function has(root: TrieNode, word: string): boolean {
  const n = descend(root, word);
  return !!n && n.end;
}

/** Does any stored key start with `prefix`? */
export const startsWith = (root: TrieNode, prefix: string): boolean => descend(root, prefix) !== null;

/** Every stored word that begins with `prefix`, in sorted order (autocomplete). */
export function complete(root: TrieNode, prefix: string): string[] {
  const start = descend(root, prefix);
  if (!start) return [];
  const out: string[] = [];
  const walk = (node: TrieNode, acc: string) => {
    if (node.end) out.push(prefix + acc);
    for (const ch of Object.keys(node.children).sort()) walk(node.children[ch], acc + ch);
  };
  walk(start, '');
  return out;
}

export const build = (words: string[]): TrieNode => {
  const r = create();
  for (const w of words) insert(r, w);
  return r;
};

/** Total distinct nodes (for showing how shared prefixes save space). */
export function nodeCount(root: TrieNode): number {
  return 1 + Object.values(root.children).reduce((s, c) => s + nodeCount(c), 0);
}
