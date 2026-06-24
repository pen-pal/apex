// The Signal Double Ratchet — how a messenger gives every message its own key, with
// forward secrecy (a compromise today can't read yesterday's messages) and post-
// compromise security (a fresh DH exchange heals a compromise). Two ratchets:
//   • symmetric-key ratchet: a one-way hash chain. Each message advances the chain
//     key (CK → CK') and spits out a message key (MK). Because the step is a hash,
//     you can't run it backward — delete MK after use and the past is unrecoverable.
//   • DH ratchet: when the peer sends a new DH public key, mix the new shared secret
//     into the ROOT key, reseeding the chains with entropy an attacker doesn't have.
// Real SHA-256 chains (from sha256.ts). A teaching model of the construction.
import { sha256, concatBytes } from './sha256';

const kdf = (key: Uint8Array, label: number): Uint8Array => sha256(concatBytes(key, Uint8Array.from([label])));

export interface SymStep { ck: Uint8Array; mk: Uint8Array }

/** Advance the symmetric ratchet one message: MK = KDF(CK,1), CK' = KDF(CK,2). */
export function symStep(ck: Uint8Array): SymStep {
  return { mk: kdf(ck, 0x01), ck: kdf(ck, 0x02) };
}

/** Produce `n` message keys from a starting chain key, returning the chain trace. */
export function chain(ck0: Uint8Array, n: number): { i: number; ck: Uint8Array; mk: Uint8Array }[] {
  let ck = ck0;
  const out: { i: number; ck: Uint8Array; mk: Uint8Array }[] = [];
  for (let i = 0; i < n; i++) { const s = symStep(ck); out.push({ i, ck, mk: s.mk }); ck = s.ck; }
  return out;
}

export interface DhStep { rk: Uint8Array; ck: Uint8Array }

/** DH ratchet: fold a fresh DH shared secret into the root key, reseeding a chain. */
export function dhStep(rk: Uint8Array, dhSecret: Uint8Array): DhStep {
  const t = sha256(concatBytes(rk, dhSecret));
  return { rk: kdf(t, 0x01), ck: kdf(t, 0x02) };
}

export const shortHex = (b: Uint8Array, n = 4): string => [...b.subarray(0, n)].map((x) => x.toString(16).padStart(2, '0')).join('');
