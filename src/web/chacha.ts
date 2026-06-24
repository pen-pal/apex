// ChaCha20 (RFC 8439) — the stream cipher behind TLS's ChaCha20-Poly1305, fast in
// software without AES hardware. It builds a 64-byte keystream block by stirring a
// 4×4 matrix of 32-bit words (constants ‖ key ‖ counter ‖ nonce) through 20 rounds
// of ARX quarter-rounds (add, rotate, xor), then adds the original state back and
// XORs the result over the data. Verified against the RFC 8439 test vectors.

const rotl = (v: number, n: number) => ((v << n) | (v >>> (32 - n))) >>> 0;

/** The ChaCha quarter-round on four words (pure form, for the §2.1.1 vector). */
export function quarterRound(a: number, b: number, c: number, d: number): [number, number, number, number] {
  a = (a + b) >>> 0; d = rotl(d ^ a, 16);
  c = (c + d) >>> 0; b = rotl(b ^ c, 12);
  a = (a + b) >>> 0; d = rotl(d ^ a, 8);
  c = (c + d) >>> 0; b = rotl(b ^ c, 7);
  return [a, b, c, d];
}

function qr(s: Uint32Array, a: number, b: number, c: number, d: number) {
  s[a] = (s[a] + s[b]) >>> 0; s[d] = rotl(s[d] ^ s[a], 16);
  s[c] = (s[c] + s[d]) >>> 0; s[b] = rotl(s[b] ^ s[c], 12);
  s[a] = (s[a] + s[b]) >>> 0; s[d] = rotl(s[d] ^ s[a], 8);
  s[c] = (s[c] + s[d]) >>> 0; s[b] = rotl(s[b] ^ s[c], 7);
}

const CONSTANTS = [0x61707865, 0x3320646e, 0x79622d32, 0x6b206574]; // "expand 32-byte k"

const leWord = (b: Uint8Array, i: number) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;

/** Build the initial 16-word state for a (key, counter, nonce). */
export function chachaState(key: Uint8Array, counter: number, nonce: Uint8Array): Uint32Array {
  const s = new Uint32Array(16);
  s.set(CONSTANTS, 0);
  for (let i = 0; i < 8; i++) s[4 + i] = leWord(key, i * 4);
  s[12] = counter >>> 0;
  for (let i = 0; i < 3; i++) s[13 + i] = leWord(nonce, i * 4);
  return s;
}

export interface ChachaBlock {
  state: Uint32Array; // the initial state
  rounds: Uint32Array[]; // working state after each of the 10 double-rounds
  out: Uint32Array; // state after adding the original back (pre-serialise)
  keystream: Uint8Array; // 64 bytes, little-endian
}

/** One 64-byte ChaCha20 block, with a snapshot after every double-round. */
export function chacha20Block(key: Uint8Array, counter: number, nonce: Uint8Array): ChachaBlock {
  const state = chachaState(key, counter, nonce);
  const x = state.slice();
  const rounds: Uint32Array[] = [];
  for (let i = 0; i < 10; i++) {
    qr(x, 0, 4, 8, 12); qr(x, 1, 5, 9, 13); qr(x, 2, 6, 10, 14); qr(x, 3, 7, 11, 15); // columns
    qr(x, 0, 5, 10, 15); qr(x, 1, 6, 11, 12); qr(x, 2, 7, 8, 13); qr(x, 3, 4, 9, 14); // diagonals
    rounds.push(x.slice());
  }
  const out = new Uint32Array(16);
  for (let i = 0; i < 16; i++) out[i] = (x[i] + state[i]) >>> 0;
  const keystream = new Uint8Array(64);
  for (let i = 0; i < 16; i++) {
    keystream[i * 4] = out[i] & 0xff;
    keystream[i * 4 + 1] = (out[i] >>> 8) & 0xff;
    keystream[i * 4 + 2] = (out[i] >>> 16) & 0xff;
    keystream[i * 4 + 3] = (out[i] >>> 24) & 0xff;
  }
  return { state, rounds, out, keystream };
}

/** Encrypt/decrypt: XOR the per-block keystream over the data (counter increments). */
export function chacha20(data: Uint8Array, key: Uint8Array, counter: number, nonce: Uint8Array): Uint8Array {
  const out = new Uint8Array(data.length);
  for (let off = 0; off < data.length; off += 64) {
    const ks = chacha20Block(key, counter + (off >> 6), nonce).keystream;
    const n = Math.min(64, data.length - off);
    for (let j = 0; j < n; j++) out[off + j] = data[off + j] ^ ks[j];
  }
  return out;
}

export const hexWord = (w: number) => (w >>> 0).toString(16).padStart(8, '0');
