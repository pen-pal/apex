import { describe, it, expect } from 'vitest';
import { verify, speedup } from '../src/web/specdecode';

// Independent oracle: speculative decoding accepts the longest matching prefix and then one token (the target's
// correction, or a free bonus when the whole draft matched). So for k draft tokens: all match → k+1 accepted, 0
// rejected; first mismatch at index i → i+1 accepted, k−i rejected; mismatch at 0 → 1 accepted, k rejected. Expected
// numbers are computed by hand.

describe('verify', () => {
  it('a fully-correct 4-token draft yields 5 tokens from one target pass', () => {
    expect(verify([true, true, true, true])).toEqual({ accepted: 5, rejected: 0, firstMismatch: 4 });
  });
  it('a mismatch at index 2 keeps the first two plus the correction, discards two', () => {
    expect(verify([true, true, false, true])).toEqual({ accepted: 3, rejected: 2, firstMismatch: 2 });
  });
  it('an immediate mismatch yields only the target’s own token', () => {
    expect(verify([false, true, true, true])).toEqual({ accepted: 1, rejected: 4, firstMismatch: 0 });
  });
});

describe('speedup', () => {
  it('is the number of accepted tokens per target pass', () => {
    expect(speedup(verify([true, true, true, true]))).toBe(5); // 5× vs one-token-per-pass
    expect(speedup(verify([false, true, true, true]))).toBe(1); // no gain — the draft was wasted
  });
});
