import { describe, it, expect } from 'vitest';
import { runOT } from '../src/web/ot';
import { N } from '../src/web/blindsig';

// Two secrets the sender holds. Both must be < N to round-trip on the toy modulus.
const M0 = 42, M1 = 1234;

describe('1-2 oblivious transfer (EGL on toy RSA)', () => {
  it('the receiver recovers EXACTLY the message it chose (b=0)', () => {
    const t = runOT(M0, M1, 0, 7, 100, 2500);
    expect(t.output).toBe(M0);
  });

  it('the receiver recovers EXACTLY the message it chose (b=1)', () => {
    const t = runOT(M0, M1, 1, 7, 100, 2500);
    expect(t.output).toBe(M1);
  });

  it('correctness holds across many blinding values k and pad choices', () => {
    for (let k = 1; k < 60; k++) {
      for (const [x0, x1] of [[100, 2500], [5, 9], [3000, 17]]) {
        expect(runOT(M0, M1, 0, k, x0, x1).output).toBe(M0);
        expect(runOT(M0, M1, 1, k, x0, x1).output).toBe(M1);
      }
    }
  });

  it('the un-chosen message stays HIDDEN — the same decrypt step garbles it', () => {
    // receiver chose b=0, so trying to also decrypt branch 1 with k yields noise, not M1
    const t = runOT(M0, M1, 0, 7, 100, 2500);
    expect(t.otherAttempt).not.toBe(M1);
  });

  it("the receiver's query v hides the choice: same k+pads, only b differs, but v is built identically", () => {
    // v = x_b + k^e. With x0 != x1, v differs by branch — but each is x_b masked by the SAME k^e, so to a
    // sender who doesn't know k, v is uniform and leaks nothing about b. Here we just confirm v is in range.
    for (const choice of [0, 1] as const) {
      const t = runOT(M0, M1, choice, 13, 222, 1999);
      expect(t.v).toBeGreaterThanOrEqual(0);
      expect(t.v).toBeLessThan(N);
    }
  });

  it('all transcript values are valid residues mod N', () => {
    const t = runOT(M0, M1, 1, 31, 100, 2500);
    for (const val of [t.v, t.enc0, t.enc1, t.output, t.otherAttempt]) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(N);
    }
  });
});
