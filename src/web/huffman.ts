// Huffman coding — optimal prefix-free compression. Count how often each symbol
// appears, then greedily merge the two least-frequent nodes into a subtree until one
// tree remains; the path to each leaf (left = 0, right = 1) is its code. Frequent
// symbols get short codes, rare ones long codes, and because it's a tree no code is a
// prefix of another (so the stream decodes unambiguously with no separators). The
// result provably minimises total bits for a symbol-by-symbol code. Deterministic
// tie-breaking so the codes are reproducible. Tested.

export interface Node { freq: number; symbol?: string; left?: Node; right?: Node; order: number }

export function counts(text: string): Record<string, number> {
  const c: Record<string, number> = {};
  for (const ch of text) c[ch] = (c[ch] ?? 0) + 1;
  return c;
}

/** Build the Huffman tree; ties broken by insertion order for reproducibility. */
export function buildTree(freqs: Record<string, number>): Node | null {
  let order = 0;
  let nodes: Node[] = Object.entries(freqs).map(([symbol, freq]) => ({ symbol, freq, order: order++ }));
  if (nodes.length === 0) return null;
  if (nodes.length === 1) return { freq: nodes[0].freq, left: nodes[0], order: order++ }; // single symbol → 1-bit code
  while (nodes.length > 1) {
    nodes.sort((a, b) => a.freq - b.freq || a.order - b.order);
    const left = nodes.shift()!, right = nodes.shift()!;
    nodes.push({ freq: left.freq + right.freq, left, right, order: order++ });
  }
  return nodes[0];
}

/** Map each symbol to its bit-string code (left=0, right=1). */
export function buildCodes(tree: Node | null): Record<string, string> {
  const codes: Record<string, string> = {};
  const walk = (n: Node, path: string) => {
    if (n.symbol !== undefined) { codes[n.symbol] = path || '0'; return; }
    if (n.left) walk(n.left, path + '0');
    if (n.right) walk(n.right, path + '1');
  };
  if (tree) walk(tree, '');
  return codes;
}

export interface HuffResult {
  codes: Record<string, string>;
  bits: string;
  originalBits: number; // fixed-width: 8 bits/char
  compressedBits: number;
  ratio: number;
}

export function encode(text: string): HuffResult {
  const codes = buildCodes(buildTree(counts(text)));
  let bits = '';
  for (const ch of text) bits += codes[ch];
  const originalBits = text.length * 8;
  return { codes, bits, originalBits, compressedBits: bits.length, ratio: originalBits ? bits.length / originalBits : 0 };
}

/** Decode a bit string back to text using the tree (proves the codes are prefix-free). */
export function decode(bits: string, tree: Node | null): string {
  if (!tree) return '';
  let out = '', n = tree;
  for (const b of bits) {
    n = (b === '0' ? n.left : n.right) ?? n;
    if (n.symbol !== undefined) { out += n.symbol; n = tree; }
  }
  return out;
}
