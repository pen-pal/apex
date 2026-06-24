// LZ77 sliding-window compression (Lempel & Ziv, 1977 — the dictionary half of DEFLATE,
// which gzip/zlib/PNG pair with Huffman coding). The data itself is the dictionary: at
// each position the encoder looks back over a window of already-seen bytes for the
// longest match of the text ahead, and emits a (distance, length, nextChar) token
// instead of the raw run. A distance-1 match copies a repeating byte, so long runs and
// repeated substrings collapse. Decoding just replays the copies. Pure and tested:
// the decoder is independent of the encoder, so round-tripping is a real correctness
// check, not a tautology.

export interface Token { pos: number; offset: number; length: number; next: string }

/** Encode `input` with a search window of `window` bytes. Every token reserves one
 *  literal `next` char, so the stream is always well-formed and round-trips. */
export function lz77(input: string, window = 32): Token[] {
  const tokens: Token[] = [];
  let pos = 0;
  while (pos < input.length) {
    const maxLen = input.length - pos - 1; // leave one char for `next`
    let bestLen = 0, bestOff = 0;
    // scan most-recent positions first so equal-length matches pick the smallest offset
    const start = Math.max(0, pos - window);
    for (let m = pos - 1; m >= start; m--) {
      let len = 0;
      while (len < maxLen && input[m + len] === input[pos + len]) len++; // overlap allowed
      if (len > bestLen) { bestLen = len; bestOff = pos - m; }
    }
    tokens.push({ pos, offset: bestLen ? bestOff : 0, length: bestLen, next: input[pos + bestLen] });
    pos += bestLen + 1;
  }
  return tokens;
}

/** Reconstruct the original text from a token stream (overlap-safe). */
export function lz77Decode(tokens: Token[]): string {
  const out: string[] = [];
  for (const t of tokens) {
    const start = out.length - t.offset;
    for (let k = 0; k < t.length; k++) out.push(out[start + k]); // copy, possibly into what we just wrote
    if (t.next !== undefined) out.push(t.next);
  }
  return out.join('');
}

export interface Stats { tokens: number; literals: number; copies: number; copiedChars: number; inputLen: number }

export function stats(input: string, tokens: Token[]): Stats {
  const copies = tokens.filter((t) => t.length > 0).length;
  return {
    tokens: tokens.length,
    literals: tokens.filter((t) => t.length === 0).length,
    copies,
    copiedChars: tokens.reduce((s, t) => s + t.length, 0),
    inputLen: input.length,
  };
}
