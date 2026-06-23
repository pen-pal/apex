// Real cryptographic hashing for the Cryptography section, via WebCrypto. The
// "bytes are real" creed: these compute genuine SHA-256 / HMAC-SHA-256 and are
// tested against published vectors (NIST FIPS 180-4, RFC 4231). Sandbox values
// only — never a captured stream.

/** SHA-256 of bytes → 32-byte digest. */
export async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  if (!globalThis.crypto?.subtle) throw new Error('WebCrypto (crypto.subtle) is unavailable here.');
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new Uint8Array(await crypto.subtle.digest('SHA-256', buf));
}

/** HMAC-SHA-256 of message under key → 32-byte MAC. */
export async function hmacSha256(key: Uint8Array, msg: Uint8Array): Promise<Uint8Array> {
  if (!globalThis.crypto?.subtle) throw new Error('WebCrypto (crypto.subtle) is unavailable here.');
  const k = await crypto.subtle.importKey(
    'raw',
    key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength) as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const m = msg.buffer.slice(msg.byteOffset, msg.byteOffset + msg.byteLength) as ArrayBuffer;
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, m));
}

/** Count differing bits between two byte arrays (the Hamming distance). */
export function bitDifference(a: Uint8Array, b: Uint8Array): number {
  const n = Math.min(a.length, b.length);
  let bits = 0;
  for (let i = 0; i < n; i++) {
    let x = a[i] ^ b[i];
    while (x) { bits += x & 1; x >>= 1; }
  }
  return bits;
}

/** Lowercase hex of bytes (no separators). */
export function toHex(bytes: Uint8Array): string {
  return [...bytes].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** Flip a single bit (bitIndex counts MSB-first within the byte) of a copy. */
export function flipBit(bytes: Uint8Array, byteIndex: number, bitIndex: number): Uint8Array {
  const out = bytes.slice();
  out[byteIndex] ^= 0x80 >> bitIndex;
  return out;
}
