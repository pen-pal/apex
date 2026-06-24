// DNSSEC chain of trust (RFC 4033–4035). A resolver trusts one key — the root's — and
// from it validates a signed delegation chain down to the answer. Two kinds of link
// alternate: a SIGNATURE link (an RRSIG over an RRset verifies under the zone's DNSKEY)
// and a DELEGATION link (the parent zone holds a DS record = a hash of the child's
// DNSKEY, and that DS is itself signed). If every link holds from the trust anchor to
// the leaf, the answer is "secure"; break any one and validation fails ("bogus" →
// SERVFAIL). The DS digests use real SHA-256, and the RRSIGs are real (toy-modulus) RSA
// signatures — sign with d, verify with e — so the chain is honest math, not theatre.
import { rsaKeygen, rsaSign, rsaVerify, type RsaKey } from './rsa';
import { sha256, hex } from './sha256';

export interface Zone { name: string; key: RsaKey }

const enc = (s: string) => new TextEncoder().encode(s);

/** A DS record is a digest of the child zone's DNSKEY (real SHA-256). */
export function digestKey(key: RsaKey): string {
  return hex(sha256(enc(`DNSKEY ${key.n} ${key.e}`)));
}

/** Hash an RRset to an integer below the signing modulus (toy stand-in for the real
 *  full-width RSA/SHA signature; the avalanche still comes from real SHA-256). */
export function hashRRset(data: string, n: bigint): bigint {
  const d = sha256(enc(data));
  let h = 0n;
  for (const b of d) h = (h << 8n) | BigInt(b);
  return h % n;
}

export const signRRset = (data: string, key: RsaKey): bigint => rsaSign(hashRRset(data, key.n), key);
export const verifyRRset = (data: string, sig: bigint, key: RsaKey): boolean =>
  rsaVerify(sig, key) === hashRRset(data, key.n);

export interface Leaf { owner: string; type: string; value: string }
export interface Tamper { dsAtZone?: number; sigAtZone?: number; leafSig?: boolean }

export interface Step { label: string; kind: 'anchor' | 'ds' | 'rrsig' | 'leaf'; ok: boolean; detail: string }
export interface Validation { steps: Step[]; secure: boolean; brokeAt: number }

/** Walk the chain from the root trust anchor down to the leaf record. */
export function validateChain(zones: Zone[], leaf: Leaf, tamper: Tamper = {}): Validation {
  const steps: Step[] = [];
  steps.push({ label: `${zones[0].name || '.'} DNSKEY`, kind: 'anchor', ok: true, detail: 'trusted directly — this is the resolver’s configured trust anchor' });

  for (let i = 1; i < zones.length; i++) {
    const parent = zones[i - 1], child = zones[i];
    const realDs = digestKey(child.key);
    const storedDs = tamper.dsAtZone === i ? realDs.replace(/^./, (c) => (c === '0' ? '1' : '0')) : realDs;
    // the parent signs the DS RRset; both the signature AND the digest match must hold
    const dsRRset = `DS ${child.name} ${storedDs}`;
    const dsSig = signRRset(dsRRset, parent.key);
    const sigOk = tamper.sigAtZone === i ? false : verifyRRset(dsRRset, dsSig, parent.key);
    const digestOk = storedDs === realDs;
    const ok = sigOk && digestOk;
    steps.push({
      label: `${parent.name || '.'} → ${child.name} (DS)`,
      kind: 'ds',
      ok,
      detail: !sigOk ? 'the parent’s RRSIG over the DS does not verify'
        : !digestOk ? 'the DS digest does not match the child’s DNSKEY — delegation broken'
        : `DS = SHA-256(${child.name} DNSKEY) matches, and the parent’s RRSIG verifies`,
    });
    if (!ok) return { steps, secure: false, brokeAt: steps.length - 1 };
  }

  const leafZone = zones[zones.length - 1];
  const rrset = `${leaf.owner} ${leaf.type} ${leaf.value}`;
  const sig = signRRset(rrset, leafZone.key);
  const leafOk = tamper.leafSig ? false : verifyRRset(rrset, sig, leafZone.key);
  steps.push({
    label: `${leafZone.name} RRSIG over ${leaf.owner} ${leaf.type}`,
    kind: 'leaf',
    ok: leafOk,
    detail: leafOk ? `the ${leaf.type} record’s RRSIG verifies under ${leafZone.name}’s DNSKEY — answer is authentic`
      : 'the answer’s RRSIG does not verify — the record was forged or altered',
  });

  const secure = steps.every((s) => s.ok);
  return { steps, secure, brokeAt: secure ? -1 : steps.findIndex((s) => !s.ok) };
}

/** A small, deterministic demo chain: root → com → example.com. */
export function demoZones(): Zone[] {
  return [
    { name: '', key: rsaKeygen(61n, 53n, 17n) },     // root (.)
    { name: 'com', key: rsaKeygen(59n, 67n, 17n) },
    { name: 'example.com', key: rsaKeygen(71n, 73n, 17n) },
  ];
}
