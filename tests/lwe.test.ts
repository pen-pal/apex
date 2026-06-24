import { describe, it, expect } from 'vitest';
import { PARAMS, keyGen, encryptBit, decryptBit, noiseMargin, half, dot, matVec, transpose } from '../src/web/lwe';

const { q } = PARAMS;

// Deterministic small vectors (no RNG) — the LWE correctness regime is |noise| < q/4.
const A = [
  [52, 9, 31, 77],
  [14, 63, 5, 40],
  [88, 21, 66, 3],
  [7, 49, 18, 70],
];
const s = [1, -1, 2, 0];
const e = [1, 0, -1, 1];

describe('LWE linear algebra (mod q)', () => {
  it('transpose and matVec are consistent', () => {
    expect(transpose(A)[0]).toEqual([52, 14, 88, 7]);
    expect(matVec(A, [1, 0, 0, 0], q)).toEqual([52, 14, 88, 7]); // first column picked out
  });
  it('dot product reduces mod q', () => {
    expect(dot([1, 1, 1, 1], [q, q, q, q], q)).toBe(0);
  });
});

describe('Regev encryption round-trips while the noise is small', () => {
  const pk = keyGen(A, s, e, q);

  it('recovers both bit values across many small randomness choices', () => {
    const smalls = [-2, -1, 0, 1, 2];
    let count = 0;
    for (const r0 of smalls) for (const r1 of [-1, 0, 1]) for (const bit of [0, 1] as const) {
      const r = [r0, r1, -r1, 1];
      const e1 = [1, 0, -1, 0];
      const e2 = r0 % 2 === 0 ? 1 : -1;
      const dec = decryptBit(s, encryptBit(pk, r, e1, e2, bit, q), q);
      expect(dec.bit).toBe(bit);
      expect(Math.abs(dec.noise)).toBeLessThan(noiseMargin(q));
      count++;
    }
    expect(count).toBeGreaterThan(20);
  });

  it('hides the bit near 0 or ⌊q/2⌋', () => {
    const pk2 = keyGen(A, s, e, q);
    const r = [1, 0, 1, -1], e1 = [0, 1, 0, -1];
    expect(decryptBit(s, encryptBit(pk2, r, e1, 0, 0, q), q).bit).toBe(0);
    const c1 = encryptBit(pk2, r, e1, 0, 1, q);
    expect(decryptBit(s, c1, q).bit).toBe(1);
    expect(decryptBit(s, c1, q).raw).toBeGreaterThan(q / 4); // sits up near q/2
  });
});

describe('too much noise flips the bit (why parameters matter)', () => {
  it('a large e2 pushes the value past the rounding boundary', () => {
    const pk = keyGen(A, s, e, q);
    const r = [0, 0, 0, 0], e1 = [0, 0, 0, 0];
    // bit 0 should decode near 0; add ~q/2 of noise via e2 and it crosses into bit 1.
    expect(decryptBit(s, encryptBit(pk, r, e1, 2, 0, q), q).bit).toBe(0); // small noise: fine
    expect(decryptBit(s, encryptBit(pk, r, e1, half(q) - 1, 0, q), q).bit).toBe(1); // huge noise: wrong
  });
});
