import { describe, it, expect } from 'vitest';
import { verifyBundle, type Bundle } from '../src/web/sigstore';

// Independent oracle: Sigstore's verification order. Accept iff the signature verifies AND the certificate's OIDC
// identity is the expected signer AND the entry is in the Rekor transparency log; any single failure rejects, with the
// signature checked first, then identity, then log inclusion. Expected outcomes follow from those rules.

const ok = (): Bundle => ({ sigValid: true, identityMatches: true, inRekor: true });

describe('verifyBundle', () => {
  it('accepts a valid signature from the expected identity, present in the log', () => {
    const r = verifyBundle(ok());
    expect(r.ok).toBe(true);
    expect(r.reject).toBeNull();
  });
  it('rejects an invalid signature first', () => {
    const r = verifyBundle({ ...ok(), sigValid: false });
    expect(r.ok).toBe(false);
    expect(r.reject).toBe('sig');
  });
  it('rejects a valid signature from the wrong identity', () => {
    const r = verifyBundle({ ...ok(), identityMatches: false });
    expect(r.reject).toBe('identity');
    expect(r.reason).toMatch(/identity|workflow|account/i);
  });
  it('rejects when the entry is missing from Rekor (the expired cert proves nothing alone)', () => {
    const r = verifyBundle({ ...ok(), inRekor: false });
    expect(r.reject).toBe('log');
    expect(r.reason).toMatch(/Rekor|log|timestamp|expired/i);
  });
  it('checks the signature before the identity', () => {
    // both broken → the signature failure is reported, not the identity
    expect(verifyBundle({ sigValid: false, identityMatches: false, inRekor: false }).reject).toBe('sig');
  });
});
