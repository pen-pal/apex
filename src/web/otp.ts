// HOTP (RFC 4226) and TOTP (RFC 6238) — the math behind the 6-digit codes in
// Google Authenticator / Authy. HOTP truncates an HMAC-SHA1 to a few decimal
// digits; TOTP is just HOTP with a time-based counter (unix time / 30s). Tested
// against the published RFC test vectors. Real HMAC via WebCrypto.

const ab = (b: Uint8Array): ArrayBuffer => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

async function hmacSha1(key: Uint8Array, msg: Uint8Array): Promise<Uint8Array> {
  if (!globalThis.crypto?.subtle) throw new Error('WebCrypto unavailable.');
  const k = await crypto.subtle.importKey('raw', ab(key), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, ab(msg)));
}

export interface HotpTrace {
  code: string;
  counterBytes: Uint8Array; // the 8-byte big-endian counter
  hmac: Uint8Array; // 20-byte HMAC-SHA1
  offset: number; // dynamic-truncation offset (last nibble)
  binary: number; // 31-bit truncated value
}

/** HOTP (RFC 4226): dynamic-truncation of HMAC-SHA1(secret, counter). */
export async function hotpTrace(secret: Uint8Array, counter: number, digits = 6): Promise<HotpTrace> {
  const counterBytes = new Uint8Array(8);
  let c = BigInt(counter);
  for (let i = 7; i >= 0; i--) { counterBytes[i] = Number(c & 0xffn); c >>= 8n; }
  const hmac = await hmacSha1(secret, counterBytes);
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  const code = (binary % 10 ** digits).toString().padStart(digits, '0');
  return { code, counterBytes, hmac, offset, binary };
}

export async function hotp(secret: Uint8Array, counter: number, digits = 6): Promise<string> {
  return (await hotpTrace(secret, counter, digits)).code;
}

/** TOTP (RFC 6238): HOTP over the time-step counter floor(unixSeconds / step). */
export async function totp(secret: Uint8Array, unixSeconds: number, step = 30, digits = 6): Promise<string> {
  return hotp(secret, Math.floor(unixSeconds / step), digits);
}

// ---- base32 (RFC 4648) — how authenticator secrets are written --------------

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Decode an RFC 4648 base32 string (the format in otpauth:// URIs) to bytes. */
export function base32Decode(s: string): Uint8Array {
  const clean = s.toUpperCase().replace(/=+$/, '').replace(/\s/g, '');
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) { bits -= 8; out.push((value >> bits) & 0xff); }
  }
  return new Uint8Array(out);
}
