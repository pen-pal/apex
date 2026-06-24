// Certificate-chain (PKI) path validation — why your browser trusts a site's cert.
// A TLS server sends a chain: leaf → intermediate(s) → (root). Validation walks it:
// each cert must be signed by the next up, its issuer must equal that parent's
// subject, every signer must be a CA, all certs must be in date, the chain must end
// at a TRUSTED root anchor, and the leaf must be valid for the host you asked for.
// We return the FIRST failure (that's how real validators fail-fast). RFC 5280 §6.
//
// The signatures are REAL: each cert carries the subject's public key and an honest
// RSA signature (rsa.ts) by the issuer over the cert's to-be-signed bytes, hashed
// with the from-scratch SHA-256. Tamper any signed field, or forge the signature,
// and verifyCert fails for real — no boolean stand-in. (Teaching key sizes, no
// PKCS#1 padding; the verification math itself is genuine.)
import { modpow, rsaKeygen, gcd, type RsaKey } from './rsa';
import { sha256 } from './sha256';

export interface PubKey { n: bigint; e: bigint }

export interface Cert {
  subject: string; // distinguished name (simplified to a CN/label)
  issuer: string; // who signed it (== parent.subject for a good chain)
  notBefore: number; // epoch seconds
  notAfter: number;
  isCA: boolean; // basicConstraints CA:TRUE
  sans: string[]; // subjectAltName DNS names (leaf only, really)
  pubKey: PubKey; // the subject's public key
  signature: bigint; // the issuer's RSA signature over this cert's TBS
}

// ---- real signatures over the certificate ----------------------------------
const isPrime = (n: bigint): boolean => {
  if (n < 2n) return false;
  for (let i = 2n; i * i <= n; i++) if (n % i === 0n) return false;
  return true;
};
const nextPrime = (n: bigint): bigint => { while (!isPrime(n)) n++; return n; };

/** A deterministic teaching keypair seeded near `seed` (real primes, e=65537). */
export function genKey(seed: number): RsaKey {
  const p = nextPrime(BigInt(seed));
  const q = nextPrime(BigInt(Math.floor(seed * 1.7)));
  const phi = (p - 1n) * (q - 1n);
  const e = gcd(65537n, phi) === 1n ? 65537n : 17n;
  return rsaKeygen(p, q, e);
}

/** Canonical to-be-signed bytes (everything except the signature itself). */
export function tbsBytes(c: Cert): Uint8Array {
  const s = [c.subject, c.issuer, c.notBefore, c.notAfter, c.isCA ? 1 : 0, c.sans.join(','), c.pubKey.n.toString(), c.pubKey.e.toString()].join('|');
  return new TextEncoder().encode(s);
}

/** SHA-256 of the TBS, reduced into the signing modulus. */
function tbsHash(c: Cert, n: bigint): bigint {
  let x = 0n;
  for (const b of sha256(tbsBytes(c))) x = (x << 8n) | BigInt(b);
  return x % n;
}

/** Build a cert and have `issuer` sign it (issuer === own key for a self-signed root). */
export function signed(fields: Omit<Cert, 'pubKey' | 'signature'>, subjectPub: PubKey, issuer: RsaKey): Cert {
  const cert: Cert = { ...fields, pubKey: subjectPub, signature: 0n };
  cert.signature = modpow(tbsHash(cert, issuer.n), issuer.d, issuer.n); // s = H(tbs)^d mod n
  return cert;
}

/** Verify cert's signature under an issuer public key: s^e mod n == H(tbs). */
export function verifyCert(cert: Cert, issuerPub: PubKey): boolean {
  return modpow(cert.signature, issuerPub.e, issuerPub.n) === tbsHash(cert, issuerPub.n);
}

export type FailKind =
  | 'ok' | 'empty' | 'expired' | 'not-yet-valid' | 'issuer-subject-mismatch'
  | 'bad-signature' | 'parent-not-ca' | 'untrusted-root' | 'host-mismatch';

export interface LinkResult {
  cert: Cert;
  index: number;
  ok: boolean;
  failure?: FailKind;
  reason?: string;
}

export interface ChainResult {
  valid: boolean;
  failAt: number | null; // index of the first failing cert (or null)
  failure: FailKind;
  reason: string;
  links: LinkResult[];
}

/** Does a leaf cert cover `host` (exact, or a single-level wildcard *.example.com)? */
export function hostMatches(cert: Cert, host: string): boolean {
  const names = cert.sans.length ? cert.sans : [cert.subject];
  return names.some((n) => {
    if (n === host) return true;
    if (n.startsWith('*.')) {
      const suffix = n.slice(1); // '.example.com'
      const idx = host.indexOf('.');
      return idx > 0 && host.slice(idx) === suffix; // wildcard matches exactly one label
    }
    return false;
  });
}

/**
 * Validate `chain` (ordered leaf→…→root-or-last) for `host` at time `now`, given a
 * set of trusted root subjects. Returns the first failure encountered.
 */
export function validateChain(chain: Cert[], host: string, now: number, trustedRoots: Set<string>): ChainResult {
  const links: LinkResult[] = chain.map((cert, index) => ({ cert, index, ok: true }));
  const fail = (i: number, failure: FailKind, reason: string): ChainResult => {
    links[i] = { ...links[i], ok: false, failure, reason };
    return { valid: false, failAt: i, failure, reason, links };
  };

  if (chain.length === 0) return { valid: false, failAt: null, failure: 'empty', reason: 'No certificates presented.', links };

  // 1. leaf must be valid for the requested host
  if (!hostMatches(chain[0], host)) {
    return fail(0, 'host-mismatch', `The leaf certificate is not valid for ${host} (covers ${(chain[0].sans.length ? chain[0].sans : [chain[0].subject]).join(', ')}).`);
  }

  for (let i = 0; i < chain.length; i++) {
    const cert = chain[i];
    // 2. validity period
    if (now < cert.notBefore) return fail(i, 'not-yet-valid', `“${cert.subject}” is not valid until later — its notBefore is in the future.`);
    if (now > cert.notAfter) return fail(i, 'expired', `“${cert.subject}” has expired (past its notAfter date).`);

    const parent = chain[i + 1];
    if (parent) {
      // 3. issuer/subject linkage
      if (cert.issuer !== parent.subject) return fail(i, 'issuer-subject-mismatch', `“${cert.subject}” claims issuer “${cert.issuer}”, but the next cert in the chain is “${parent.subject}” — the chain is broken.`);
      // 4. the signature must verify under the parent's key (real RSA verify)
      if (!verifyCert(cert, parent.pubKey)) return fail(i, 'bad-signature', `“${cert.subject}”’s signature does not verify under “${parent.subject}”’s key — forged or tampered.`);
      // 5. the signer must be a CA
      if (!parent.isCA) return fail(i + 1, 'parent-not-ca', `“${parent.subject}” signed a certificate but is not a CA (basicConstraints CA:FALSE).`);
    } else {
      // 6. top of the presented chain — it must chain to a trusted anchor.
      // Either this cert IS a trusted root, or it was issued by one we trust.
      const anchor = cert.issuer === cert.subject ? cert.subject : cert.issuer;
      if (!trustedRoots.has(cert.subject) && !trustedRoots.has(anchor)) {
        return fail(i, 'untrusted-root', `The chain ends at “${cert.subject}” (issued by “${cert.issuer}”), which is not in the trusted root store.`);
      }
    }
  }

  return { valid: true, failAt: null, failure: 'ok', reason: `Trusted: ${host} chains to a trusted root, every signature verifies, and all certs are in date.`, links };
}
