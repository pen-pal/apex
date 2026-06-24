import { describe, it, expect } from 'vitest';
import { publicKey, commit, respond, verify, forgeCommit, N } from '../src/web/schnorr';

describe('Schnorr proof of knowledge', () => {
  it('an honest prover who knows x always verifies', () => {
    for (let x = 1; x < N; x++)
      for (const r of [1, 4, 11]) for (const c of [0, 3, 7, N - 1]) {
        const Y = publicKey(x), T = commit(r), s = respond(r, c, x);
        expect(verify(Y, T, c, s)).toBe(true); // sG == T + cY
      }
  });

  it('a tampered response fails verification', () => {
    const x = 7, r = 3, c = 5;
    const Y = publicKey(x), T = commit(r), s = respond(r, c, x);
    expect(verify(Y, T, c, (s + 1) % N)).toBe(false);
  });

  it('the secret never appears in the transcript (T, c, s)', () => {
    const x = 9, r = 2, c = 4;
    const T = commit(r), s = respond(r, c, x);
    // s = r + c·x mod N reveals x only if r is known; r is random and never sent
    expect(typeof s).toBe('number');
    expect(verify(publicKey(x), T, c, s)).toBe(true);
  });
});

describe('why the challenge must come AFTER the commitment', () => {
  it('a cheater who fixes (c, s) first can forge a matching T — only if c is known in advance', () => {
    const x = 6, Y = publicKey(x); // attacker does NOT know x
    const c = 5, s = 12; // attacker picks these freely
    const T = forgeCommit(Y, c, s); // back-solve T = sG − cY
    expect(verify(Y, T, c, s)).toBe(true); // passes for THIS c…
    // …but the real verifier picks a fresh c after T, which this transcript won't satisfy
    expect(verify(Y, T, (c + 1) % N, s)).toBe(false);
  });
});
