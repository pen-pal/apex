// WebAuthn / FIDO2 passkeys (W3C WebAuthn). Passwordless login by public-key signature.
// Registration: the authenticator (your phone/security key) generates a keypair bound to
// this site and gives the server the PUBLIC key — the private key never leaves the device.
// Authentication: the server sends a random challenge; the authenticator signs the
// challenge together with the ORIGIN it is actually talking to, and the server verifies
// with the stored public key. The origin binding is what makes passkeys phishing-proof:
// on a look-alike site the authenticator signs the attacker's origin, so the real server's
// check fails even though the signature is valid. Real signatures via the toy EdDSA;
// tested.
import { sign, verify, publicKey } from './eddsa';
import { sha256 } from './sha256';
import { type Pt } from './ecc';

/** Hash the signed payload (challenge ‖ origin) to the integer the toy signer takes. */
function payload(challenge: string, origin: string): number {
  const d = sha256(new TextEncoder().encode(`${challenge}|${origin}`));
  return ((d[0] << 16) | (d[1] << 8) | d[2]) >>> 0;
}

export interface Credential { publicKey: Pt; credentialId: string; rpId: string }

/** Registration: the device keeps `secret`, the server stores the public key. */
export function register(secret: number, rpId: string): Credential {
  return { publicKey: publicKey(secret), credentialId: 'cred-' + rpId, rpId };
}

export interface Assertion { signature: { R: Pt; s: number }; signedOrigin: string }

/** The authenticator signs (challenge ‖ the origin it is actually visiting). */
export function authenticate(secret: number, challenge: string, actualOrigin: string): Assertion {
  const sig = sign(secret, payload(challenge, actualOrigin));
  return { signature: { R: sig.R, s: sig.s }, signedOrigin: actualOrigin };
}

export interface Verdict { originOk: boolean; signatureOk: boolean; accepted: boolean; reason: string }

/** The server accepts only if the signed origin is its own AND the signature verifies. */
export function verifyAssertion(cred: Credential, challenge: string, expectedOrigin: string, a: Assertion): Verdict {
  const originOk = a.signedOrigin === expectedOrigin;
  const signatureOk = verify(cred.publicKey, payload(challenge, a.signedOrigin), a.signature);
  const accepted = originOk && signatureOk;
  return {
    originOk, signatureOk, accepted,
    reason: !signatureOk ? 'signature does not verify (wrong key or tampered challenge)'
      : !originOk ? `signed origin "${a.signedOrigin}" ≠ expected "${expectedOrigin}" — phishing blocked`
      : 'origin matches and signature verifies — authenticated',
  };
}
