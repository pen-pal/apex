// Email authentication: SPF + DKIM + DMARC — the three records that decide whether a
// message claiming to be "from your bank" really is. SPF (RFC 7208) checks the sending
// server's IP against a DNS list of allowed senders. DKIM (RFC 6376) verifies a
// cryptographic signature over the message using a public key in DNS, so any tampering
// breaks it. DMARC (RFC 7489) ties them to the visible From: domain by requiring
// ALIGNMENT — SPF or DKIM must pass AND match the From domain — then applies the domain
// owner's policy (none / quarantine / reject). DKIM here is a real (toy-modulus) RSA
// signature over a real SHA-256 digest; tested.
import { rsaSign, rsaVerify, type RsaKey } from './rsa';
import { sha256 } from './sha256';

// ── SPF ──
export interface SpfResult { pass: boolean; domain: string }
export function spfCheck(senderIp: string, fromDomain: string, allowedIps: string[]): SpfResult {
  return { pass: allowedIps.includes(senderIp), domain: fromDomain };
}

// ── DKIM (real RSA over SHA-256 of the body, reduced to the toy modulus) ──
function bodyHash(body: string, n: bigint): bigint {
  const d = sha256(new TextEncoder().encode(body));
  let h = 0n;
  for (const b of d) h = (h << 8n) | BigInt(b);
  return h % n;
}
export const dkimSign = (body: string, key: RsaKey): bigint => rsaSign(bodyHash(body, key.n), key);

export interface DkimResult { pass: boolean; domain: string }
export function dkimVerify(body: string, sig: bigint, key: RsaKey, signingDomain: string): DkimResult {
  return { pass: rsaVerify(sig, key) === bodyHash(body, key.n), domain: signingDomain };
}

// ── DMARC ──
export type Policy = 'none' | 'quarantine' | 'reject';
export interface Dmarc {
  spfAligned: boolean;
  dkimAligned: boolean;
  pass: boolean;
  action: 'deliver' | 'quarantine' | 'reject';
  reason: string;
}

/** DMARC: pass if SPF or DKIM both AUTHENTICATED and ALIGNED with the visible From domain. */
export function dmarc(fromDomain: string, spf: SpfResult, dkim: DkimResult, policy: Policy): Dmarc {
  const spfAligned = spf.pass && spf.domain === fromDomain;
  const dkimAligned = dkim.pass && dkim.domain === fromDomain;
  const pass = spfAligned || dkimAligned;
  let action: Dmarc['action'] = 'deliver';
  if (!pass) action = policy === 'reject' ? 'reject' : policy === 'quarantine' ? 'quarantine' : 'deliver';
  return {
    spfAligned, dkimAligned, pass, action,
    reason: pass
      ? `authenticated and aligned via ${spfAligned ? 'SPF' : ''}${spfAligned && dkimAligned ? ' + ' : ''}${dkimAligned ? 'DKIM' : ''}`
      : policy === 'none' ? 'DMARC fails, but policy p=none → still delivered (monitoring only)'
      : `DMARC fails and p=${policy} → ${action}`,
  };
}
