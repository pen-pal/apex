// Rabin-Karp string matching (1987) — find a pattern by comparing HASHES instead of
// characters. The trick is the ROLLING HASH: treat a window of text as a base-b number mod
// a prime; when the window slides one character, update the hash in O(1) by subtracting the
// leaving character's contribution, multiplying by the base, and adding the entering one —
// no need to re-hash the whole window. Where the window hash equals the pattern hash, do a
// full character check to rule out a collision. The same rolling hash underlies rsync's
// block matching, content-defined chunking (dedup), and multi-pattern search. Pure, tested.

export const BASE = 256;
export const PRIME = 1_000_000_007;

function hashOf(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * BASE + s.charCodeAt(i)) % PRIME;
  return h;
}

export interface Step { start: number; windowHash: number; hashMatch: boolean; verified: boolean }
export interface Result { matches: number[]; steps: Step[]; hashHits: number; falsePositives: number }

export function search(text: string, pattern: string): Result {
  const m = pattern.length, n = text.length;
  const matches: number[] = [], steps: Step[] = [];
  if (m === 0 || m > n) return { matches, steps, hashHits: 0, falsePositives: 0 };

  const patHash = hashOf(pattern);
  let high = 1; // BASE^(m-1) mod PRIME, the weight of the leaving character
  for (let i = 0; i < m - 1; i++) high = (high * BASE) % PRIME;

  let windowHash = hashOf(text.slice(0, m));
  let hashHits = 0, falsePositives = 0;

  for (let i = 0; i + m <= n; i++) {
    const hashMatch = windowHash === patHash;
    let verified = false;
    if (hashMatch) {
      hashHits++;
      verified = text.substr(i, m) === pattern; // full check rules out a hash collision
      if (verified) matches.push(i); else falsePositives++;
    }
    steps.push({ start: i, windowHash, hashMatch, verified });
    // roll the hash forward one character
    if (i + m < n) {
      windowHash = ((windowHash - text.charCodeAt(i) * high) * BASE + text.charCodeAt(i + m)) % PRIME;
      windowHash = ((windowHash % PRIME) + PRIME) % PRIME; // keep it non-negative
    }
  }
  return { matches, steps, hashHits, falsePositives };
}

/** The rolling-hash update in isolation (for showing the O(1) step). */
export function roll(prevHash: number, leaving: string, entering: string, m: number): number {
  let high = 1;
  for (let i = 0; i < m - 1; i++) high = (high * BASE) % PRIME;
  let h = ((prevHash - leaving.charCodeAt(0) * high) * BASE + entering.charCodeAt(0)) % PRIME;
  return ((h % PRIME) + PRIME) % PRIME;
}

export const windowHash = hashOf;

export function naiveSearch(text: string, pattern: string): number[] {
  const out: number[] = [];
  if (!pattern) return out;
  for (let i = 0; i + pattern.length <= text.length; i++) if (text.substr(i, pattern.length) === pattern) out.push(i);
  return out;
}
