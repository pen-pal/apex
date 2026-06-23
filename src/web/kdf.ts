// Password-based key derivation (PBKDF2) via WebCrypto. The point a developer
// must internalise: never store a raw hash of a password. PBKDF2 adds a per-user
// SALT (defeats precomputed rainbow tables) and a high ITERATION count (a "work
// factor" that makes brute force expensive). Tested against RFC 6070 vectors.

type Hash = 'SHA-1' | 'SHA-256' | 'SHA-512';

const ab = (b: Uint8Array): ArrayBuffer =>
  b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

/** PBKDF2 → dkLen-byte derived key. */
export async function pbkdf2(
  password: Uint8Array,
  salt: Uint8Array,
  iterations: number,
  hash: Hash,
  dkLenBytes: number,
): Promise<Uint8Array> {
  if (!globalThis.crypto?.subtle) throw new Error('WebCrypto (crypto.subtle) is unavailable here.');
  const key = await crypto.subtle.importKey('raw', ab(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: ab(salt), iterations, hash },
    key,
    dkLenBytes * 8,
  );
  return new Uint8Array(bits);
}

export const toHex = (b: Uint8Array): string => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
