// Base58 & Base58Check — the encoding behind Bitcoin addresses, WIF private keys, and IPFS content IDs. It turns
// arbitrary bytes into a string, like Base64, but with two deliberate differences. First, the alphabet omits the
// four characters that look alike in most fonts — 0 (zero), O (capital o), I (capital i), and l (lowercase L) —
// plus + and / — so a human can read an address aloud or copy it by hand without ambiguity. That leaves 58
// symbols. Second, and more subtly: because 58 is NOT a power of two, you can't slice the input into fixed
// bit-groups the way Base64 chunks 6 bits at a time. Instead Base58 treats the whole byte string as one big
// base-256 integer and repeatedly divides by 58, reading off remainders — a genuine base conversion. A
// consequence is that encoding has no clean byte-to-char ratio and is a touch slower, but the output has no
// padding and no line-noise characters. Leading zero bytes are a special case (they'd vanish in the bignum), so
// each is encoded as a literal '1' (the 0th alphabet symbol). Base58CHECK wraps this for addresses: prepend a
// version byte (0x00 = Bitcoin mainnet P2PKH), append a 4-byte checksum = the first 4 bytes of SHA256(SHA256(
// version‖payload)), and Base58-encode the whole thing. On decode you re-hash and compare those 4 bytes, so a
// single mistyped character is caught with ~1 - 2^-32 probability before any money moves. This models the
// bignum conversion, leading-zero handling, and the real double-SHA256 checksum. Reference: Bitcoin base58check;
// Satoshi's original encoder.

import { sha256 } from './hashing';

export const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'; // no 0 O I l
const MAP = new Map([...ALPHABET].map((c, i) => [c, i]));

/** Encode bytes as Base58 (big-endian bignum, base-256 → base-58, leading zeros → '1'). */
export function encode(bytes: Uint8Array): string {
  let num = 0n;
  for (const b of bytes) num = num * 256n + BigInt(b);
  let out = '';
  while (num > 0n) { out = ALPHABET[Number(num % 58n)] + out; num /= 58n; }
  for (const b of bytes) { if (b === 0) out = '1' + out; else break; } // preserve leading zero bytes
  return out;
}

/** Decode Base58 back to bytes. Throws on an out-of-alphabet character. */
export function decode(str: string): Uint8Array {
  let num = 0n;
  for (const c of str) { const v = MAP.get(c); if (v === undefined) throw new Error(`invalid base58 char '${c}'`); num = num * 58n + BigInt(v); }
  const bytes: number[] = [];
  while (num > 0n) { bytes.unshift(Number(num % 256n)); num /= 256n; }
  for (const c of str) { if (c === '1') bytes.unshift(0); else break; } // leading '1' → leading zero byte
  return new Uint8Array(bytes);
}

const concat = (a: Uint8Array, b: Uint8Array): Uint8Array => { const c = new Uint8Array(a.length + b.length); c.set(a); c.set(b, a.length); return c; };
const sha256d = async (b: Uint8Array): Promise<Uint8Array> => sha256(await sha256(b));

/** Base58Check-encode: version ‖ payload ‖ first4(SHA256d(version‖payload)). */
export async function encodeCheck(version: number, payload: Uint8Array): Promise<string> {
  const data = concat(new Uint8Array([version]), payload);
  const checksum = (await sha256d(data)).slice(0, 4);
  return encode(concat(data, checksum));
}

export interface CheckResult { version: number; payload: Uint8Array; valid: boolean; checksum: Uint8Array; expected: Uint8Array }

/** Decode and verify a Base58Check string (re-hash and compare the 4-byte checksum). */
export async function decodeCheck(str: string): Promise<CheckResult> {
  const full = decode(str);
  const data = full.slice(0, -4), checksum = full.slice(-4);
  const expected = (await sha256d(data)).slice(0, 4);
  const valid = checksum.length === 4 && expected.every((b, i) => b === checksum[i]);
  return { version: data[0], payload: data.slice(1), valid, checksum, expected };
}

export const toHex = (b: Uint8Array): string => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
export const fromHex = (h: string): Uint8Array => new Uint8Array((h.match(/../g) ?? []).map((x) => parseInt(x, 16)));
