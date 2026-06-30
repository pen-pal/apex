import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, add, addConst, mulConst, L, N, N2, G, LAMBDA, MU } from '../src/web/paillier';
import { modpow, modinv } from '../src/web/blindsig';

describe('Paillier — key constants are consistent with the math', () => {
  it('MU = (L(g^lambda mod n^2))^-1 mod n', () => {
    expect(MU).toBe(modinv(L(modpow(G, LAMBDA, N2)), N));
  });
  it('n^2 and g are derived from n', () => {
    expect(N2).toBe(N * N);
    expect(G).toBe(N + 1);
  });
});

describe('encryption round-trips', () => {
  it('decrypt(encrypt(m, r)) === m for every m and several r', () => {
    for (let m = 0; m < N; m++) {
      for (const r of [2, 3, 5, 13, 30]) {
        expect(decrypt(encrypt(m, r))).toBe(m);
      }
    }
  });
  it('is semantically secure: the same plaintext encrypts to different ciphertexts', () => {
    expect(encrypt(5, 2)).not.toBe(encrypt(5, 3));
    // ...yet both decrypt to 5
    expect(decrypt(encrypt(5, 2))).toBe(5);
    expect(decrypt(encrypt(5, 3))).toBe(5);
  });
});

describe('the homomorphic properties — compute on ciphertext, never decrypting the operands', () => {
  it('multiplying ciphertexts ADDS the plaintexts', () => {
    expect(decrypt(add(encrypt(30, 2), encrypt(12, 3)))).toBe(42);
    expect(decrypt(add(encrypt(9, 5), encrypt(8, 13)))).toBe(17);
  });
  it('addition wraps mod n', () => {
    expect(decrypt(add(encrypt(70, 2), encrypt(20, 3)))).toBe((70 + 20) % N); // 90 mod 77 = 13
  });
  it('adding a PUBLIC constant', () => {
    expect(decrypt(addConst(encrypt(40, 2), 25))).toBe(65);
  });
  it('multiplying by a PUBLIC scalar', () => {
    expect(decrypt(mulConst(encrypt(6, 5), 7))).toBe(42);
    expect(decrypt(mulConst(encrypt(11, 3), 7))).toBe((11 * 7) % N); // 77 mod 77 = 0
  });
  it('a private tally: sum several encrypted votes, decrypt only the total', () => {
    const votes = [1, 0, 1, 1, 0, 1].map((v, i) => encrypt(v, [2, 3, 5, 13, 2, 3][i]));
    const tally = votes.reduce((acc, c) => add(acc, c));
    expect(decrypt(tally)).toBe(4); // four yes-votes, individual ballots never revealed
  });
});

describe('L function', () => {
  it('L(x) = (x-1)/n exactly when x ≡ 1 (mod n)', () => {
    expect(L(1)).toBe(0);
    expect(L(1 + N)).toBe(1);
    expect(L(1 + 5 * N)).toBe(5);
  });
});
