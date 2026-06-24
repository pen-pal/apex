// X3DH — Signal's Extended Triple Diffie-Hellman, the ASYNCHRONOUS handshake that bootstraps a secure
// session even when the recipient is offline. Bob publishes a "prekey bundle" to the server ahead of
// time: his long-term Identity Key (IK), a Signed PreKey (SPK, signed by IK so it's authentic), and a
// batch of one-time PreKeys (OPK). Alice fetches the bundle, makes a fresh Ephemeral key (EK), and
// combines FOUR Diffie-Hellman results into one shared secret:
//   DH1 = DH(IK_A, SPK_B)  — ties Alice's identity to Bob's authenticated prekey (mutual auth)
//   DH2 = DH(EK_A, IK_B)   — ties Alice's ephemeral to Bob's identity
//   DH3 = DH(EK_A, SPK_B)  — forward secrecy from the ephemeral
//   DH4 = DH(EK_A, OPK_B)  — one-time, extra forward secrecy (dropped after use)
//   SK  = KDF(DH1 ‖ DH2 ‖ DH3 ‖ DH4)
// Bob, when he later comes online, recomputes the same four DHs with roles swapped and derives the
// SAME SK — no live round trip needed. We use a small prime-field DH (a teaching group, not Curve25519)
// with the real modular exponentiation and a real SHA-256 KDF, so both sides provably agree. Tested.
import { modpow } from './dh';
import { sha256 } from './sha256';

export interface KeyPair { priv: bigint; pub: bigint }
export const keypair = (priv: bigint, p: bigint, g: bigint): KeyPair => ({ priv, pub: modpow(g, priv, p) });

const enc = (s: string) => new TextEncoder().encode(s);
const hex = (b: Uint8Array) => Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('');
/** A real KDF over the concatenated DH outputs (SHA-256); returns the session key as hex. */
const kdf = (dh: bigint[]) => hex(sha256(enc('X3DH|' + dh.map((d) => d.toString()).join('|')))).slice(0, 32);

export interface X3DHResult { dh: bigint[]; sk: string }

/** Alice's side: she holds her IK + a fresh EK and Bob's PUBLIC bundle (IK_B, SPK_B, OPK_B). */
export function aliceDerive(p: bigint, ikA: KeyPair, ekA: KeyPair, ikBpub: bigint, spkBpub: bigint, opkBpub: bigint): X3DHResult {
  const dh = [
    modpow(spkBpub, ikA.priv, p), // DH1 = SPK_B ^ ik_a
    modpow(ikBpub, ekA.priv, p), //  DH2 = IK_B  ^ ek_a
    modpow(spkBpub, ekA.priv, p), // DH3 = SPK_B ^ ek_a
    modpow(opkBpub, ekA.priv, p), // DH4 = OPK_B ^ ek_a
  ];
  return { dh, sk: kdf(dh) };
}

/** Bob's side (later): he holds his private IK/SPK/OPK and Alice's PUBLIC IK_A + EK_A. */
export function bobDerive(p: bigint, ikB: KeyPair, spkB: KeyPair, opkB: KeyPair, ikApub: bigint, ekApub: bigint): X3DHResult {
  const dh = [
    modpow(ikApub, spkB.priv, p), // DH1 = IK_A ^ spk_b  (= SPK_B ^ ik_a)
    modpow(ekApub, ikB.priv, p), //  DH2 = EK_A ^ ik_b
    modpow(ekApub, spkB.priv, p), // DH3 = EK_A ^ spk_b
    modpow(ekApub, opkB.priv, p), // DH4 = EK_A ^ opk_b
  ];
  return { dh, sk: kdf(dh) };
}

export const LABELS = ['DH1 = IK_A · SPK_B', 'DH2 = EK_A · IK_B', 'DH3 = EK_A · SPK_B', 'DH4 = EK_A · OPK_B'];
export const WHY = ['mutual authentication', "binds Alice's ephemeral to Bob", 'forward secrecy', 'one-time forward secrecy'];
