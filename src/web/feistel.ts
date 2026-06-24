// Feistel networks — the other great block-cipher structure (DES, Blowfish, Twofish,
// GOST). Split the block into two halves L,R and each round do L,R = R, L⊕F(R,Kᵢ).
// The magic: this is reversible for ANY round function F — even one that throws
// information away — because decryption just runs the same structure backward. That's
// the opposite of AES's substitution-permutation network, where every single step has
// to be individually invertible. We use a deliberately non-invertible F to prove the
// point. Toy 16-bit block (two bytes); the structure is the lesson. Tested.

export const ROUNDS = 8;

/** A deliberately NON-invertible round function: r·r mod 256 is many-to-one
 *  (r and 256−r collide), yet the Feistel cipher still decrypts perfectly. */
export const roundF = (r: number, k: number): number => (((r * r) & 0xff) ^ k) & 0xff;

/** A simple key schedule: one byte per round, mixed from the key. */
export function roundKeys(key: number, rounds = ROUNDS): number[] {
  return Array.from({ length: rounds }, (_, i) => ((key * (i + 1)) ^ (0x3b * i + 0x9e)) & 0xff);
}

export interface FRound { round: number; L: number; R: number; f: number; key: number }

/** Encrypt (L,R): each round L,R ← R, L ⊕ F(R,Kᵢ). Returns a per-round trace. */
export function encryptTrace(L: number, R: number, keys: number[]): FRound[] {
  const trace: FRound[] = [{ round: 0, L, R, f: 0, key: 0 }];
  for (let i = 0; i < keys.length; i++) {
    const f = roundF(R, keys[i]);
    [L, R] = [R, L ^ f];
    trace.push({ round: i + 1, L, R, f, key: keys[i] });
  }
  return trace;
}

/** Decrypt: run the rounds backward. Given (L,R) after round i: R_{i-1}=L, L_{i-1}=R⊕F(L,Kᵢ). */
export function decryptTrace(L: number, R: number, keys: number[]): FRound[] {
  const trace: FRound[] = [{ round: keys.length, L, R, f: 0, key: 0 }];
  for (let i = keys.length - 1; i >= 0; i--) {
    const f = roundF(L, keys[i]);
    [L, R] = [R ^ f, L];
    trace.push({ round: i, L, R, f, key: keys[i] });
  }
  return trace;
}

export const encrypt = (L: number, R: number, keys: number[]): [number, number] => {
  const t = encryptTrace(L, R, keys); const last = t[t.length - 1]; return [last.L, last.R];
};
export const decrypt = (L: number, R: number, keys: number[]): [number, number] => {
  const t = decryptTrace(L, R, keys); const last = t[t.length - 1]; return [last.L, last.R];
};
