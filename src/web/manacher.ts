// Manacher's algorithm — the longest palindromic substring in O(n). The brute force is O(n³) (try every
// substring, check each); expanding around every center is O(n²). Manacher gets to LINEAR with one idea:
// palindromes are mirror-symmetric, so once you've found a big palindrome you already KNOW the radius at
// positions inside it — they mirror positions you've measured on the other side. You only ever do new
// character comparisons that push the known boundary further right, so the total work is O(n). The classic
// trick to handle even- and odd-length palindromes uniformly is to interleave a separator (#a#b#a#) so
// every palindrome has an odd length in the transformed string. Reference: Manacher (1975); the standard
// linear-time longest-palindrome algorithm.

export interface ManacherResult {
  transformed: string;  // the '#'-interleaved string the algorithm works on
  radii: number[];      // P[i] = palindrome radius (in transformed coords) centered at i; = palindrome length in the original
  longest: string;      // the longest palindromic substring of the input
  start: number;        // its start index in the original string
  length: number;       // its length
  comparisons: number;  // character comparisons that EXTENDED a palindrome — stays ~O(n)
}

/** Longest palindromic substring via Manacher's algorithm. */
export function manacher(s: string): ManacherResult {
  // Work on an ARRAY of code points (not a string): indexing a string mid-surrogate would split non-BMP
  // characters (emoji) and break the equality checks. t alternates separator / code-point / separator …
  const chars = [...s];
  const t: string[] = ['#'];
  for (const c of chars) t.push(c, '#'); // interleave separators; every palindrome is now odd-length
  const n = t.length;
  const p = new Array(n).fill(0);
  let center = 0, right = 0, comparisons = 0; // [center−right, center+right] is the rightmost-reaching palindrome

  for (let i = 0; i < n; i++) {
    if (i < right) {
      const mirror = 2 * center - i;       // i's reflection across the current center
      p[i] = Math.min(right - i, p[mirror]); // reuse the mirror's radius, capped by the known boundary
    }
    // try to grow past what the mirror guaranteed — the only place new comparisons happen
    while (i - p[i] - 1 >= 0 && i + p[i] + 1 < n && t[i - p[i] - 1] === t[i + p[i] + 1]) {
      p[i]++; comparisons++;
    }
    if (i + p[i] > right) { center = i; right = i + p[i]; } // extend the rightmost boundary
  }

  let length = 0, ci = 0;
  for (let i = 0; i < n; i++) if (p[i] > length) { length = p[i]; ci = i; }
  const start = (ci - length) / 2; // map the transformed-center back to the original string
  const longest = chars.slice(start, start + length).join('');
  return { transformed: t.join(''), radii: p, longest, start, length, comparisons };
}
