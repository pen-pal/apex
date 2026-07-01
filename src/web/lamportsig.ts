// Lamport one-time signatures — the simplest digital signature there is, built from nothing but a hash
// function, and the conceptual root of the post-quantum hash-based signatures (SPHINCS+, XMSS) now being
// standardized. Every other common signature (RSA, ECDSA, EdDSA) rests on a number-theory problem — factoring
// or discrete logs — that a large quantum computer would break. Lamport rests only on a hash being one-way and
// collision-resistant, which quantum computers barely dent, so it survives. The mechanism is startlingly plain.
// To sign L-bit message digests, your PRIVATE key is 2L random secrets — a pair (s_i^0, s_i^1) for each bit
// position i. Your PUBLIC key is those same secrets HASHED: (H(s_i^0), H(s_i^1)). To sign a message, hash it to
// L bits and, for each bit b_i, REVEAL the matching secret s_i^{b_i} — the signature is just those L revealed
// preimages. To verify, the receiver hashes each revealed secret and checks it equals the corresponding half of
// the public key. A forger can't invent a preimage that hashes to a public value (that's inverting the hash).
// The catch in the name: it's ONE-TIME. Signing a second message reveals more secrets, and once BOTH secrets of
// some position are public an attacker can mix them to forge new messages — so each key pair signs exactly once
// (real systems chain many one-time keys under a Merkle tree to sign many messages). This models keygen, sign,
// verify, and the two-messages-leak weakness. Reference: Lamport, "Constructing Digital Signatures from a
// One-Way Function" (1979); NIST SP 800-208 (SPHINCS+/XMSS).

export const L = 16; // message-digest bits (real Lamport uses 256; small here for legibility)

/** A small teaching hash → 8 hex chars. Real Lamport uses SHA-256; only one-wayness matters to the mechanism. */
export function H(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  h ^= h >>> 16; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 13; h = Math.imul(h, 0x85ebca6b) >>> 0; h ^= h >>> 16;
  return (h >>> 0).toString(16).padStart(8, '0');
}

export interface KeyPair { priv: [string, string][]; pub: [string, string][] }

/** Generate a key pair: 2L random secrets and their hashes. */
export function keygen(seed: number): KeyPair {
  let s = seed >>> 0;
  const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return (s >>> 0).toString(16).padStart(8, '0'); };
  const priv: [string, string][] = [], pub: [string, string][] = [];
  for (let i = 0; i < L; i++) { const a = rnd(), b = rnd(); priv.push([a, b]); pub.push([H(a), H(b)]); }
  return { priv, pub };
}

/** Hash a message to its L bits (bit i = bit i of the digest). */
export function messageBits(msg: string): number[] {
  const h = parseInt(H(msg), 16) >>> 0;
  return Array.from({ length: L }, (_, i) => (h >>> i) & 1);
}

/** Sign: reveal, for each bit b_i of the digest, the secret s_i^{b_i}. */
export function sign(msg: string, priv: [string, string][]): string[] {
  return messageBits(msg).map((bit, i) => priv[i][bit]);
}

/** Verify: each revealed secret must hash to the corresponding public-key half. */
export function verify(msg: string, sig: string[], pub: [string, string][]): boolean {
  const bits = messageBits(msg);
  return bits.length === sig.length && bits.every((bit, i) => H(sig[i]) === pub[i][bit]);
}

/** Which of {0,1} secrets are revealed at each position after signing this set of messages.
 *  A position with BOTH revealed is one a forger can now set to either bit — the one-time weakness. */
export function revealed(messages: string[]): Set<number>[] {
  const r: Set<number>[] = Array.from({ length: L }, () => new Set<number>());
  for (const m of messages) messageBits(m).forEach((bit, i) => r[i].add(bit));
  return r;
}

/** Count of bit positions a forger controls after signing `messages` (both secrets exposed). */
export const forgeablePositions = (messages: string[]): number => revealed(messages).filter((s) => s.size === 2).length;
