// Speculative decoding — how an LLM emits several tokens per expensive forward pass without changing its output. Normal
// autoregressive decoding is one big-model pass per token. Here a cheap DRAFT model guesses the next k tokens; the big
// TARGET model then verifies all k in a SINGLE pass (it can score every position at once). You keep the longest prefix
// where the draft matches what the target would have chosen, take the target's own token at the first disagreement (so
// you always advance by at least one real token), and discard the rest. The result is bit-for-bit what the target alone
// would produce — just faster when the draft is good. This models the accept/reject accounting.

export interface Verify { accepted: number; rejected: number; firstMismatch: number }

// draftMatches[i] = did the draft's i-th proposed token equal the target's greedy choice at that position?
export function verify(draftMatches: boolean[]): Verify {
  const k = draftMatches.length;
  let firstMismatch = draftMatches.indexOf(false);
  if (firstMismatch === -1) firstMismatch = k;      // the whole draft matched
  // accept the matching prefix, plus one token: the target's correction at the mismatch, or a free bonus token when
  // every draft token matched (the target's pass also produces the next token).
  return { accepted: firstMismatch + 1, rejected: k - firstMismatch, firstMismatch };
}

// Tokens produced per (expensive) target forward pass — the speedup over plain decoding, which is 1 token per pass.
export function speedup(v: Verify): number {
  return v.accepted; // accepted tokens all came from a single target pass
}
