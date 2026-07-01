// The Z-algorithm — linear-time string matching from one elegant array. Z[i] is the length of the longest
// substring starting at position i that is ALSO a prefix of the string. Computing every Z[i] naively is
// O(n²); the trick is to remember the rightmost match window [l, r) you've already verified: if i falls
// inside it, you already know s[i..] mirrors s[i-l..] there, so you can copy that Z value (capped at the
// window edge) and only ever compare *new* characters past r. Each character is matched at most once as you
// extend r, so the whole array is O(n). To find a pattern P in text T, run Z over "P§T" (a separator not in
// either): every position where Z ≥ |P| is a match. It's the conceptual cousin of KMP — same linear bound,
// but many find the Z-array easier to reason about. Reference: Gusfield, "Algorithms on Strings, Trees, and
// Sequences" (1997).

// NUL: a code point that never appears in normal text/emoji input, so a match can't span the P|T boundary.
const SEP = String.fromCharCode(0); // NUL sentinel

// Core on a code-point array (emoji-safe: we index code points, not UTF-16 units).
function zc(s: string[]): number[] {
  const n = s.length;
  const z = new Array(n).fill(0);
  // z[0] is left 0 by convention (the whole string trivially matches its own prefix).
  let l = 0, r = 0; // [l, r) is the rightmost segment known to match a prefix
  for (let i = 1; i < n; i++) {
    if (i < r) z[i] = Math.min(r - i, z[i - l]); // reuse the mirror value, capped at the window edge
    while (i + z[i] < n && s[z[i]] === s[i + z[i]]) z[i]++; // extend by comparing only new characters
    if (i + z[i] > r) { l = i; r = i + z[i]; } // grew the window → remember it
  }
  return z;
}

/** The Z-array of a string. z[i] = length of the longest prefix of `str` starting at code-point index i. */
export function zArray(str: string): number[] {
  return zc([...str]);
}

/** All start positions (code-point indices in `text`) where `pattern` occurs, via Z over "pattern§text". */
export function search(text: string, pattern: string): number[] {
  if (pattern.length === 0) return [];
  const pat = [...pattern], txt = [...text];
  const comb = [...pat, SEP, ...txt];
  const z = zc(comb);
  const m = pat.length;
  const out: number[] = [];
  for (let i = m + 1; i < comb.length; i++) if (z[i] >= m) out.push(i - m - 1); // -m-1 maps back into text
  return out;
}

/** The combined "pattern§text" string and its Z-array — for visualizing how matching works. `combined` uses a
 *  visible § for display; the Z-array is computed with the same-length NUL separator so indices line up. */
export function matchTrace(text: string, pattern: string): { combined: string[]; z: number[]; sepIndex: number } {
  const pat = [...pattern], txt = [...text];
  const combined = [...pat, '§', ...txt];
  return { combined, z: zc([...pat, SEP, ...txt]), sepIndex: pat.length };
}
