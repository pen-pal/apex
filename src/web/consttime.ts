// Constant-time comparison & the timing side channel — why you must never check a secret (a token,
// an HMAC, a password hash) with an ordinary `==` or memcmp. A naive comparison returns the instant
// it finds a mismatched byte, so HOW LONG it runs leaks HOW MANY leading bytes were correct. An
// attacker who can measure that turns an exponential guess (256^n) into a LINEAR one (256·n): fix
// byte 0, try all values, keep the one that ran longest (it matched), move to byte 1, and so on.
// The fix is to always compare every byte and OR the differences together, so the running time is
// independent of the data. We model the leak with an "examined bytes" counter standing in for time,
// and run the attack against both comparators. Pure, tested.

export interface CmpResult { equal: boolean; examined: number } // examined = bytes touched ≈ time taken

/** The VULNERABLE comparison: bails out at the first mismatch, leaking the matching-prefix length. */
export function naiveEqual(secret: string, guess: string): CmpResult {
  const n = Math.min(secret.length, guess.length);
  for (let i = 0; i < n; i++) if (secret[i] !== guess[i]) return { equal: false, examined: i + 1 };
  if (secret.length !== guess.length) return { equal: false, examined: n + 1 };
  return { equal: true, examined: secret.length };
}

/** The SAFE comparison: always touches every byte, so the time is constant in the data. */
export function constantTimeEqual(secret: string, guess: string): CmpResult {
  let diff = secret.length ^ guess.length;
  const n = Math.max(secret.length, guess.length);
  for (let i = 0; i < n; i++) diff |= (secret.charCodeAt(i) || 0) ^ (guess.charCodeAt(i) || 0);
  return { equal: diff === 0, examined: n }; // examined never depends on WHERE a mismatch is
}

export const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'.split('');

export interface Attack {
  recovered: string;
  probes: number; // total comparisons made
  trail: { pos: number; byte: string; examined: number; chosen: boolean }[]; // per-probe, for visualization
  success: boolean;
}

/** Recover `secret` byte-by-byte through a comparison oracle. With the leaky comparator this needs
 *  only alphabet·length probes; with the constant-time one the timing signal is gone and it fails. */
export function timingAttack(secret: string, cmp: (s: string, g: string) => CmpResult, alphabet = ALPHABET): Attack {
  const recovered = new Array(secret.length).fill(alphabet[0]);
  const trail: Attack['trail'] = [];
  let probes = 0;
  for (let pos = 0; pos < secret.length; pos++) {
    let bestScore = -1, bestByte = alphabet[0];
    for (const b of alphabet) {
      recovered[pos] = b;
      const r = cmp(secret, recovered.join(''));
      probes++;
      const score = r.examined + (r.equal ? 1 : 0); // longest run (and a full match) wins
      const chosen = score > bestScore;
      if (chosen) { bestScore = score; bestByte = b; }
      trail.push({ pos, byte: b, examined: r.examined, chosen });
    }
    recovered[pos] = bestByte;
  }
  const out = recovered.join('');
  return { recovered: out, probes, trail, success: out === secret };
}
