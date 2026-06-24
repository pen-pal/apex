// The man-in-the-middle on unauthenticated Diffie–Hellman. DH lets two strangers
// derive a shared secret over an open wire, and a PASSIVE eavesdropper can't recover
// it (discrete log is hard). But an ACTIVE attacker who can rewrite traffic just runs
// DH twice — once with each side — and sits in the middle decrypting and re-encrypting.
// Neither side notices, because nothing tied the DH public value to an identity. The
// fix is authentication: sign the public value, and Eve's substitution fails the
// check. Real modular arithmetic (modpow from rsa.ts); canonical p=23, g=5.
import { modpow } from './rsa';

export const P = 23n;
export const G = 5n;

export const pub = (priv: number): number => Number(modpow(G, BigInt(priv), P));
export const shared = (otherPub: number, priv: number): number => Number(modpow(BigInt(otherPub), BigInt(priv), P));

export interface DhResult {
  A: number; B: number; // the genuine public values
  aliceSees: number; bobSees: number; // the public value each side actually receives
  aliceKey: number; bobKey: number; // the secret each side derives
  eve?: { pub: number; keyWithAlice: number; keyWithBob: number };
  agree: boolean; // do Alice and Bob hold the same key?
  compromised: boolean; // is Eve silently in the middle?
  detected: boolean; // did authentication catch the substitution?
}

export interface Opts { mitm: boolean; eve: number; authenticated: boolean }

export function exchange(a: number, b: number, opts: Opts): DhResult {
  const A = pub(a), B = pub(b);
  if (!opts.mitm) {
    const aliceKey = shared(B, a), bobKey = shared(A, b);
    return { A, B, aliceSees: B, bobSees: A, aliceKey, bobKey, agree: aliceKey === bobKey, compromised: false, detected: false };
  }
  // Active Eve substitutes her own public value toward each side.
  const E = pub(opts.eve);
  const aliceKey = shared(E, a); // Alice ↔ Eve
  const bobKey = shared(E, b); // Bob ↔ Eve
  const eve = { pub: E, keyWithAlice: shared(A, opts.eve), keyWithBob: shared(B, opts.eve) };
  if (opts.authenticated) {
    // The signed public value won't match Eve's substitution → handshake aborts.
    return { A, B, aliceSees: B, bobSees: A, aliceKey: shared(B, a), bobKey: shared(A, b), eve, agree: true, compromised: false, detected: true };
  }
  return { A, B, aliceSees: E, bobSees: E, aliceKey, bobKey, eve, agree: aliceKey === bobKey, compromised: true, detected: false };
}
