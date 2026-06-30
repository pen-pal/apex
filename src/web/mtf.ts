// Move-to-front (MTF) coding — the stage that sits between the Burrows-Wheeler transform and the entropy
// coder in bzip2. Keep an ordered list of the alphabet; to encode a symbol, output its CURRENT index in
// the list, then move it to the front. A symbol used again immediately codes as 0, and a recently-used
// one codes as a small number — so a run of the same character (exactly what the BWT produces) becomes a
// run of ZEROS, and skewed-but-shifting data becomes a stream of small integers an entropy coder loves.
// It's perfectly reversible: decode reads each index, emits that list entry, and moves it to the front,
// reconstructing the same list state. Reference: Bentley et al. 1986; bzip2's BWT → MTF → RLE → Huffman.

/** Encode a string against an ordered `alphabet`, returning the move-to-front index of each symbol. */
export function encode(input: string, alphabet: string[]): number[] {
  const list = [...alphabet];
  const out: number[] = [];
  for (const c of input) {
    const idx = list.indexOf(c);
    out.push(idx);
    list.splice(idx, 1);   // remove from its position…
    list.unshift(c);       // …and put it at the front
  }
  return out;
}

/** Inverse: read indices, emit the list entry at each, moving it to the front to track the same state. */
export function decode(indices: number[], alphabet: string[]): string {
  const list = [...alphabet];
  let out = '';
  for (const idx of indices) {
    const c = list[idx];
    out += c;
    list.splice(idx, 1);
    list.unshift(c);
  }
  return out;
}

/** Trace each step (symbol, emitted index, list state after) for the visualization. */
export interface MtfStep { sym: string; index: number; listAfter: string[] }
export function trace(input: string, alphabet: string[]): MtfStep[] {
  const list = [...alphabet];
  return [...input].map((c) => {
    const idx = list.indexOf(c);
    list.splice(idx, 1); list.unshift(c);
    return { sym: c, index: idx, listAfter: [...list] };
  });
}

/** Distinct sorted characters of a string — the natural starting alphabet. */
export const alphabetOf = (s: string) => [...new Set(s)].sort();
