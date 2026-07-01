// HMAC — Hash-based Message Authentication Code, the standard way to prove a message came from someone who
// holds a shared secret key and wasn't tampered with (TLS record integrity, JWT signatures, API request signing,
// webhooks). The naive idea — just hash the key prepended to the message, MAC = H(key ‖ msg) — is broken by a
// LENGTH-EXTENSION attack: for Merkle–Damgård hashes (MD5, SHA-1, SHA-256) an attacker who sees H(key ‖ msg) can,
// without knowing the key, compute a valid MAC for msg ‖ padding ‖ anything, because the hash's internal state
// after msg is exactly its output. HMAC defends by hashing TWICE with two key-derived pads:
//     HMAC(K, m) = H( (K ⊕ opad) ‖ H( (K ⊕ ipad) ‖ m) )
// where ipad = 0x36 repeated, opad = 0x5c repeated, and K is zero-padded (or hashed first, if longer) to the
// hash's block size (64 bytes for SHA-256). The inner hash binds the message under the key; the outer hash wraps
// that digest under the key again, so an attacker only ever sees the OUTER hash of a fixed-length inner digest —
// there's nothing to length-extend. This is provably secure given a reasonable hash, which is why HMAC is used
// even with hashes (SHA-256) that are otherwise fine, and why it, not raw keyed hashing, is the standard. This
// builds HMAC from the two-pass construction on real SHA-256, exposing the intermediate values, and checks it
// against the platform's HMAC. Reference: RFC 2104 (HMAC); RFC 4231 (HMAC-SHA-256 test vectors); Bellare et al.

import { sha256 } from './hashing';

const BLOCK = 64; // SHA-256 block size in bytes

const concat = (a: Uint8Array, b: Uint8Array): Uint8Array => { const c = new Uint8Array(a.length + b.length); c.set(a); c.set(b, a.length); return c; };
const xorPad = (k0: Uint8Array, pad: number): Uint8Array => k0.map((b) => b ^ pad);

export interface HmacSteps { blockKey: Uint8Array; ipadKey: Uint8Array; opadKey: Uint8Array; inner: Uint8Array; mac: Uint8Array; keyWasHashed: boolean }

/** Compute HMAC-SHA256, returning the tag and every intermediate value for visualization. */
export async function hmac(key: Uint8Array, msg: Uint8Array): Promise<HmacSteps> {
  const keyWasHashed = key.length > BLOCK;
  let k = keyWasHashed ? await sha256(key) : key;   // shorten an over-long key by hashing it
  const blockKey = new Uint8Array(BLOCK);
  blockKey.set(k);                                   // zero-pad up to the block size
  const ipadKey = xorPad(blockKey, 0x36);
  const opadKey = xorPad(blockKey, 0x5c);
  const inner = await sha256(concat(ipadKey, msg));  // inner hash: H((K⊕ipad) ‖ m)
  const mac = await sha256(concat(opadKey, inner));  // outer hash: H((K⊕opad) ‖ inner)
  return { blockKey, ipadKey, opadKey, inner, mac, keyWasHashed };
}

/** The broken naive MAC = H(key ‖ msg), shown for contrast (length-extension forgeable). */
export async function naiveMac(key: Uint8Array, msg: Uint8Array): Promise<Uint8Array> {
  return sha256(concat(key, msg));
}

export const enc = (s: string): Uint8Array => new TextEncoder().encode(s);
export const hex = (b: Uint8Array): string => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
export const fromHex = (h: string): Uint8Array => new Uint8Array((h.match(/../g) ?? []).map((x) => parseInt(x, 16)));
