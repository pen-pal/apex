// Sigstore keyless signing — how you verify a release nobody kept a signing key for. Instead of a long-lived private
// key, the signer uses an EPHEMERAL keypair; it proves its identity to Fulcio over OIDC (e.g. a specific GitHub Actions
// workflow), and Fulcio issues a short-lived (~10 min) X.509 cert binding the ephemeral public key to that identity;
// the signature and cert are logged in Rekor, a transparency log, and the key is thrown away. The non-obvious part is
// verification: by the time anyone checks, the cert has long expired, so its validity can't come from the cert — it
// comes from Rekor's signed timestamp, which proves the signature was made inside the cert's 10-minute window. So
// identity replaces key custody, and the log replaces cert validity. This models the verification decision.

export interface Bundle {
  sigValid: boolean;        // the signature verifies against the cert's public key
  identityMatches: boolean; // the cert's OIDC identity equals the signer you expect
  inRekor: boolean;         // the signature+cert is present in the Rekor transparency log (with a timestamp)
}

export type Reject = 'sig' | 'identity' | 'log' | null;
export interface Result { ok: boolean; reject: Reject; reason: string }

// Verify in order: the signature must check out, the identity must be the one you trust, and the entry must be in the
// log (the only thing that proves the now-expired cert was valid when it signed).
export function verifyBundle(b: Bundle): Result {
  if (!b.sigValid) {
    return { ok: false, reject: 'sig', reason: 'The signature doesn’t verify against the certificate’s public key — the artifact was altered or the signature is forged.' };
  }
  if (!b.identityMatches) {
    return { ok: false, reject: 'identity', reason: 'The signature is valid, but the certificate’s OIDC identity isn’t the signer you trust — a different workflow or account signed it. Keyless security IS the identity check; skip it and any Sigstore user can sign anything.' };
  }
  if (!b.inRekor) {
    return { ok: false, reject: 'log', reason: 'Valid signature from the right identity, but there’s no Rekor entry. The certificate expired long ago, so without the log’s signed timestamp proving the signature was made during its 10-minute window, you can’t trust it was ever legitimately issued.' };
  }
  return { ok: true, reject: null, reason: 'Verified: a valid signature, from the expected identity, with a Rekor timestamp inside the certificate’s validity window — even though nobody kept a key and the cert is long expired.' };
}
