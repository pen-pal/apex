// HKDF (RFC 5869) and the TLS 1.3 HKDF-Expand-Label (RFC 8446 §7.1), built on the
// from-scratch SHA-256 so we can show real, verifiable derivations. HKDF is two
// steps: EXTRACT condenses input keying material + a salt into a uniform pseudo-
// random key (PRK); EXPAND stretches the PRK into as many output bytes as needed,
// each block chained through HMAC. The HKDF/HMAC core is tested against the published RFC 5869 /
// RFC 4231 vectors; the TLS 1.3 Expand-Label layer follows RFC 8446 §7.1's encoding (its byte output
// is checked structurally, not pinned to an RFC 8448 trace).
import { sha256 } from './sha256';

const BLOCK = 64; // SHA-256 block size
const HLEN = 32; // SHA-256 output size

const concat = (...a: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(a.reduce((n, x) => n + x.length, 0));
  let o = 0;
  for (const x of a) { out.set(x, o); o += x.length; }
  return out;
};

/** HMAC-SHA256 built on the local SHA-256 (so it works identically in tests). */
export function hmacSha256(key: Uint8Array, msg: Uint8Array): Uint8Array {
  let k = key;
  if (k.length > BLOCK) k = sha256(k);
  if (k.length < BLOCK) k = concat(k, new Uint8Array(BLOCK - k.length));
  const ipad = new Uint8Array(BLOCK);
  const opad = new Uint8Array(BLOCK);
  for (let i = 0; i < BLOCK; i++) { ipad[i] = k[i] ^ 0x36; opad[i] = k[i] ^ 0x5c; }
  return sha256(concat(opad, sha256(concat(ipad, msg))));
}

/** HKDF-Extract(salt, IKM) → PRK (RFC 5869 §2.2). */
export function hkdfExtract(salt: Uint8Array, ikm: Uint8Array): Uint8Array {
  return hmacSha256(salt.length ? salt : new Uint8Array(HLEN), ikm);
}

/** HKDF-Expand(PRK, info, L) → L bytes of output keying material (RFC 5869 §2.3). */
export function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number): Uint8Array {
  if (length > 255 * HLEN) throw new Error('HKDF-Expand: length must be ≤ 255·HashLen (RFC 5869 §2.3)'); // else the 1-byte counter wraps
  const n = Math.ceil(length / HLEN);
  const out = new Uint8Array(n * HLEN);
  let prev: Uint8Array = Uint8Array.from([]);
  for (let i = 0; i < n; i++) {
    prev = Uint8Array.from(hmacSha256(prk, concat(prev, info, new Uint8Array([i + 1]))));
    out.set(prev, i * HLEN);
  }
  return out.slice(0, length);
}

/**
 * HKDF-Expand-Label (RFC 8446 §7.1): the TLS 1.3 wrapper around HKDF-Expand whose
 * `info` is a structured HkdfLabel { length, "tls13 " + label, context }.
 */
export function hkdfExpandLabel(secret: Uint8Array, label: string, context: Uint8Array, length: number): Uint8Array {
  const full = new TextEncoder().encode('tls13 ' + label);
  const info = concat(
    new Uint8Array([(length >> 8) & 0xff, length & 0xff]),
    new Uint8Array([full.length]), full,
    new Uint8Array([context.length]), context,
  );
  return hkdfExpand(secret, info, length);
}

/** Derive-Secret(secret, label, messages) (RFC 8446 §7.1): expand-label over a transcript hash. */
export function deriveSecret(secret: Uint8Array, label: string, transcript: Uint8Array): Uint8Array {
  return hkdfExpandLabel(secret, label, sha256(transcript), HLEN);
}

export const toHex = (b: Uint8Array): string => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');

// ---- The TLS 1.3 key schedule (RFC 8446 §7.1), as a derivation tree ----------

export interface KsNode {
  id: string;
  label: string; // human name
  kind: 'input' | 'extract' | 'derive' | 'secret' | 'key';
  value: Uint8Array;
  via: string; // the HKDF step that produced it
  from: string[]; // parent node ids
  note: string;
}

const ZERO = new Uint8Array(HLEN);

/**
 * Build the (EC)DHE-only key schedule from a shared (EC)DHE secret, using an empty
 * transcript (sandbox values only — never a captured handshake). Returns the nodes
 * of the derivation tree in dependency order.
 */
export function tls13KeySchedule(ecdheSecret: Uint8Array): KsNode[] {
  const emptyMsgs = new Uint8Array(0);

  const earlySecret = hkdfExtract(new Uint8Array(0), ZERO); // PSK = 0
  const derivedForHs = deriveSecret(earlySecret, 'derived', emptyMsgs);
  const handshakeSecret = hkdfExtract(derivedForHs, ecdheSecret);
  const cHsTraffic = deriveSecret(handshakeSecret, 'c hs traffic', emptyMsgs);
  const sHsTraffic = deriveSecret(handshakeSecret, 's hs traffic', emptyMsgs);
  const derivedForMaster = deriveSecret(handshakeSecret, 'derived', emptyMsgs);
  const masterSecret = hkdfExtract(derivedForMaster, ZERO);
  const cAppTraffic = deriveSecret(masterSecret, 'c ap traffic', emptyMsgs);
  const sAppTraffic = deriveSecret(masterSecret, 's ap traffic', emptyMsgs);
  const cKey = hkdfExpandLabel(cAppTraffic, 'key', emptyMsgs, 16); // AES-128 key
  const cIv = hkdfExpandLabel(cAppTraffic, 'iv', emptyMsgs, 12); // 96-bit nonce

  return [
    { id: 'ikm0', label: 'PSK = 0', kind: 'input', value: ZERO, via: 'all-zero (no PSK)', from: [], note: 'With no pre-shared key, the early-secret input keying material is a string of zeros.' },
    { id: 'early', label: 'Early Secret', kind: 'extract', value: earlySecret, via: 'HKDF-Extract(0, PSK)', from: ['ikm0'], note: 'The root of the schedule. Without 0-RTT, nothing else is derived from it yet except the "derived" salt.' },
    { id: 'derived-hs', label: 'Derived (for Handshake)', kind: 'derive', value: derivedForHs, via: 'Derive-Secret(Early, "derived", "")', from: ['early'], note: 'A salt for the next Extract, bound to the empty transcript.' },
    { id: 'ecdhe', label: '(EC)DHE shared secret', kind: 'input', value: ecdheSecret, via: 'from key_share exchange', from: [], note: 'The ephemeral Diffie-Hellman secret both sides computed from the ClientHello/ServerHello key_shares.' },
    { id: 'handshake', label: 'Handshake Secret', kind: 'extract', value: handshakeSecret, via: 'HKDF-Extract(Derived, (EC)DHE)', from: ['derived-hs', 'ecdhe'], note: 'Mixes in the (EC)DHE secret — this is where forward secrecy enters. Everything in the handshake is keyed from here.' },
    { id: 'c-hs', label: 'client handshake traffic', kind: 'secret', value: cHsTraffic, via: 'Derive-Secret(Handshake, "c hs traffic", …)', from: ['handshake'], note: 'Protects the client→server handshake messages (e.g. the client Finished).' },
    { id: 's-hs', label: 'server handshake traffic', kind: 'secret', value: sHsTraffic, via: 'Derive-Secret(Handshake, "s hs traffic", …)', from: ['handshake'], note: 'Protects the server→client handshake messages (EncryptedExtensions … Finished).' },
    { id: 'derived-ms', label: 'Derived (for Master)', kind: 'derive', value: derivedForMaster, via: 'Derive-Secret(Handshake, "derived", "")', from: ['handshake'], note: 'Salt for the final Extract that yields the master secret.' },
    { id: 'master', label: 'Master Secret', kind: 'extract', value: masterSecret, via: 'HKDF-Extract(Derived, 0)', from: ['derived-ms'], note: 'The application-data root. No new entropy is added here — just a clean Extract.' },
    { id: 'c-ap', label: 'client application traffic', kind: 'secret', value: cAppTraffic, via: 'Derive-Secret(Master, "c ap traffic", …)', from: ['master'], note: 'Keys the client’s application data after the handshake completes.' },
    { id: 's-ap', label: 'server application traffic', kind: 'secret', value: sAppTraffic, via: 'Derive-Secret(Master, "s ap traffic", …)', from: ['master'], note: 'Keys the server’s application data.' },
    { id: 'c-key', label: 'client write key (AES-128)', kind: 'key', value: cKey, via: 'HKDF-Expand-Label(c ap, "key", "", 16)', from: ['c-ap'], note: 'The actual 16-byte AES-GCM key for client records.' },
    { id: 'c-iv', label: 'client write IV (96-bit)', kind: 'key', value: cIv, via: 'HKDF-Expand-Label(c ap, "iv", "", 12)', from: ['c-ap'], note: 'The 12-byte nonce base, XORed with the record sequence number per record.' },
  ];
}
