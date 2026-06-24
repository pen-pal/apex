// A real, from-scratch AES-128 block cipher — because WebCrypto deliberately
// omits ECB (it's insecure), yet ECB is the single best way to SEE why cipher
// modes matter: identical plaintext blocks become identical ciphertext blocks,
// leaking structure. Implemented to FIPS-197 and verified against the NIST
// SP 800-38A known-answer vectors in tests. Encryption only (enough for the demo).

// prettier-ignore
const SBOX = new Uint8Array([
  0x63,0x7c,0x77,0x7b,0xf2,0x6b,0x6f,0xc5,0x30,0x01,0x67,0x2b,0xfe,0xd7,0xab,0x76,
  0xca,0x82,0xc9,0x7d,0xfa,0x59,0x47,0xf0,0xad,0xd4,0xa2,0xaf,0x9c,0xa4,0x72,0xc0,
  0xb7,0xfd,0x93,0x26,0x36,0x3f,0xf7,0xcc,0x34,0xa5,0xe5,0xf1,0x71,0xd8,0x31,0x15,
  0x04,0xc7,0x23,0xc3,0x18,0x96,0x05,0x9a,0x07,0x12,0x80,0xe2,0xeb,0x27,0xb2,0x75,
  0x09,0x83,0x2c,0x1a,0x1b,0x6e,0x5a,0xa0,0x52,0x3b,0xd6,0xb3,0x29,0xe3,0x2f,0x84,
  0x53,0xd1,0x00,0xed,0x20,0xfc,0xb1,0x5b,0x6a,0xcb,0xbe,0x39,0x4a,0x4c,0x58,0xcf,
  0xd0,0xef,0xaa,0xfb,0x43,0x4d,0x33,0x85,0x45,0xf9,0x02,0x7f,0x50,0x3c,0x9f,0xa8,
  0x51,0xa3,0x40,0x8f,0x92,0x9d,0x38,0xf5,0xbc,0xb6,0xda,0x21,0x10,0xff,0xf3,0xd2,
  0xcd,0x0c,0x13,0xec,0x5f,0x97,0x44,0x17,0xc4,0xa7,0x7e,0x3d,0x64,0x5d,0x19,0x73,
  0x60,0x81,0x4f,0xdc,0x22,0x2a,0x90,0x88,0x46,0xee,0xb8,0x14,0xde,0x5e,0x0b,0xdb,
  0xe0,0x32,0x3a,0x0a,0x49,0x06,0x24,0x5c,0xc2,0xd3,0xac,0x62,0x91,0x95,0xe4,0x79,
  0xe7,0xc8,0x37,0x6d,0x8d,0xd5,0x4e,0xa9,0x6c,0x56,0xf4,0xea,0x65,0x7a,0xae,0x08,
  0xba,0x78,0x25,0x2e,0x1c,0xa6,0xb4,0xc6,0xe8,0xdd,0x74,0x1f,0x4b,0xbd,0x8b,0x8a,
  0x70,0x3e,0xb5,0x66,0x48,0x03,0xf6,0x0e,0x61,0x35,0x57,0xb9,0x86,0xc1,0x1d,0x9e,
  0xe1,0xf8,0x98,0x11,0x69,0xd9,0x8e,0x94,0x9b,0x1e,0x87,0xe9,0xce,0x55,0x28,0xdf,
  0x8c,0xa1,0x89,0x0d,0xbf,0xe6,0x42,0x68,0x41,0x99,0x2d,0x0f,0xb0,0x54,0xbb,0x16,
]);
const RCON = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];

/** Multiply by 2 in GF(2^8) with the AES reduction polynomial. */
function xtime(a: number): number {
  return ((a << 1) ^ (a & 0x80 ? 0x1b : 0)) & 0xff;
}

/** Expand a 16-byte key into 11 round keys (FIPS-197 key schedule). */
export function expandKey128(key: Uint8Array): Uint8Array[] {
  if (key.length !== 16) throw new Error('AES-128 needs a 16-byte key');
  const w: number[][] = [];
  for (let i = 0; i < 4; i++) w.push([key[4 * i], key[4 * i + 1], key[4 * i + 2], key[4 * i + 3]]);
  for (let i = 4; i < 44; i++) {
    let t = w[i - 1].slice();
    if (i % 4 === 0) {
      t = [t[1], t[2], t[3], t[0]].map((b) => SBOX[b]); // RotWord + SubWord
      t[0] ^= RCON[i / 4 - 1];
    }
    w.push(w[i - 4].map((b, j) => b ^ t[j]));
  }
  const rks: Uint8Array[] = [];
  for (let r = 0; r <= 10; r++) {
    const rk = new Uint8Array(16);
    for (let c = 0; c < 4; c++) for (let j = 0; j < 4; j++) rk[4 * c + j] = w[4 * r + c][j];
    rks.push(rk);
  }
  return rks;
}

function addRoundKey(s: Uint8Array, rk: Uint8Array) { for (let i = 0; i < 16; i++) s[i] ^= rk[i]; }
function subBytes(s: Uint8Array) { for (let i = 0; i < 16; i++) s[i] = SBOX[s[i]]; }
function shiftRows(s: Uint8Array) {
  const o = s.slice();
  // state index = col*4 + row (column-major); row r rotates left by r.
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < 4; col++) s[col * 4 + row] = o[((col + row) % 4) * 4 + row];
}
function mixColumns(s: Uint8Array) {
  for (let c = 0; c < 4; c++) {
    const i = c * 4;
    const a0 = s[i], a1 = s[i + 1], a2 = s[i + 2], a3 = s[i + 3];
    s[i] = xtime(a0) ^ (xtime(a1) ^ a1) ^ a2 ^ a3;
    s[i + 1] = a0 ^ xtime(a1) ^ (xtime(a2) ^ a2) ^ a3;
    s[i + 2] = a0 ^ a1 ^ xtime(a2) ^ (xtime(a3) ^ a3);
    s[i + 3] = (xtime(a0) ^ a0) ^ a1 ^ a2 ^ xtime(a3);
  }
}

/** Encrypt one 16-byte block with pre-expanded round keys. */
export function encryptBlock(block: Uint8Array, rks: Uint8Array[]): Uint8Array {
  const s = block.slice();
  addRoundKey(s, rks[0]);
  for (let r = 1; r < 10; r++) { subBytes(s); shiftRows(s); mixColumns(s); addRoundKey(s, rks[r]); }
  subBytes(s); shiftRows(s); addRoundKey(s, rks[10]);
  return s;
}

/** Zero-pad to a whole number of 16-byte blocks (for the visual demo). */
export function padBlocks(bytes: Uint8Array): Uint8Array {
  const n = Math.ceil(Math.max(bytes.length, 1) / 16) * 16;
  const out = new Uint8Array(n);
  out.set(bytes);
  return out;
}

/** AES-128-ECB: each block encrypted independently (insecure — that's the point). */
export function aesEcbEncrypt(bytes: Uint8Array, key: Uint8Array): Uint8Array[] {
  const rks = expandKey128(key);
  const padded = padBlocks(bytes);
  const out: Uint8Array[] = [];
  for (let i = 0; i < padded.length; i += 16) out.push(encryptBlock(padded.subarray(i, i + 16), rks));
  return out;
}

/** AES-128-CBC: each block XOR'd with the previous ciphertext before encryption. */
export function aesCbcEncrypt(bytes: Uint8Array, key: Uint8Array, iv: Uint8Array): Uint8Array[] {
  const rks = expandKey128(key);
  const padded = padBlocks(bytes);
  const out: Uint8Array[] = [];
  let prev: Uint8Array = Uint8Array.from(iv);
  for (let i = 0; i < padded.length; i += 16) {
    const blk = Uint8Array.from(padded.subarray(i, i + 16));
    for (let j = 0; j < 16; j++) blk[j] ^= prev[j];
    const ct = encryptBlock(blk, rks);
    out.push(ct);
    prev = ct;
  }
  return out;
}

// ── AES round internals: a full step-by-step trace, for the "inside AES" view ──
// Same FIPS-197 operations as encryptBlock, but snapshotting the 16-byte state
// (column-major: index = col*4 + row) after every transform so a UI can animate
// confusion (SubBytes) and diffusion (ShiftRows + MixColumns) round by round.

/** The AES S-box, exposed so the view can show the SubBytes lookup table. */
export const AES_SBOX = SBOX;

export type AesOp = 'input' | 'AddRoundKey' | 'SubBytes' | 'ShiftRows' | 'MixColumns';

export interface AesStep {
  round: number; // 0 = initial whitening; 1..10 = the cipher rounds
  op: AesOp;
  state: Uint8Array; // the 16-byte state AFTER this op (column-major)
  roundKey?: Uint8Array; // the round key XOR'd in, for AddRoundKey steps
}

/** Trace encrypting one 16-byte block: every state between every transform. */
export function aesTrace(block: Uint8Array, key: Uint8Array): AesStep[] {
  if (block.length !== 16) throw new Error('AES block must be 16 bytes');
  const rks = expandKey128(key);
  const s = block.slice();
  const steps: AesStep[] = [{ round: 0, op: 'input', state: s.slice() }];
  addRoundKey(s, rks[0]);
  steps.push({ round: 0, op: 'AddRoundKey', state: s.slice(), roundKey: rks[0].slice() });
  for (let r = 1; r <= 9; r++) {
    subBytes(s); steps.push({ round: r, op: 'SubBytes', state: s.slice() });
    shiftRows(s); steps.push({ round: r, op: 'ShiftRows', state: s.slice() });
    mixColumns(s); steps.push({ round: r, op: 'MixColumns', state: s.slice() });
    addRoundKey(s, rks[r]); steps.push({ round: r, op: 'AddRoundKey', state: s.slice(), roundKey: rks[r].slice() });
  }
  subBytes(s); steps.push({ round: 10, op: 'SubBytes', state: s.slice() });
  shiftRows(s); steps.push({ round: 10, op: 'ShiftRows', state: s.slice() });
  addRoundKey(s, rks[10]); steps.push({ round: 10, op: 'AddRoundKey', state: s.slice(), roundKey: rks[10].slice() });
  return steps;
}

/** How many of the 16 state bytes differ between two traces, step by step
 *  (diffusion: flip one input bit and watch it spread to the whole block). */
export function aesDiffusion(a: AesStep[], b: AesStep[]): number[] {
  return a.map((step, i) => {
    let n = 0;
    for (let j = 0; j < 16; j++) if (step.state[j] !== b[i].state[j]) n++;
    return n;
  });
}
