import { describe, it, expect } from 'vitest';
import { register, authenticate, verifyAssertion } from '../src/web/webauthn';

const SECRET = 7;
const RP = 'https://bank.example';
const cred = register(SECRET, RP);

describe('WebAuthn registration', () => {
  it('stores a public key; the private secret never appears in the credential', () => {
    expect(cred.publicKey).not.toBeNull();
    expect(JSON.stringify(cred)).not.toContain(String(SECRET));
  });
});

describe('legitimate authentication', () => {
  it('a fresh challenge signed on the real origin verifies', () => {
    const challenge = 'rnd-abc-123';
    const a = authenticate(SECRET, challenge, RP);
    const v = verifyAssertion(cred, challenge, RP, a);
    expect(v.accepted).toBe(true);
    expect(v.originOk).toBe(true);
    expect(v.signatureOk).toBe(true);
  });

  it('replaying with a different challenge fails (the signature is challenge-bound)', () => {
    const a = authenticate(SECRET, 'challenge-A', RP);
    const v = verifyAssertion(cred, 'challenge-B', RP, a); // server expects a different challenge
    expect(v.signatureOk).toBe(false);
    expect(v.accepted).toBe(false);
  });
});

describe('phishing resistance — the origin binding', () => {
  it('a relayed challenge signed on the attacker origin is rejected by the real server', () => {
    const challenge = 'rnd-xyz-789';
    // user is tricked onto the phishing site; the authenticator signs THAT origin
    const a = authenticate(SECRET, challenge, 'https://bank-secure.evil');
    // the phishing signature is internally valid for its own origin…
    expect(a.signedOrigin).toBe('https://bank-secure.evil');
    // …but the real bank verifies against its own origin and rejects it
    const v = verifyAssertion(cred, challenge, RP, a);
    expect(v.signatureOk).toBe(true);   // the signature itself is genuine
    expect(v.originOk).toBe(false);     // but it covers the wrong origin
    expect(v.accepted).toBe(false);
    expect(v.reason).toMatch(/phishing blocked/);
  });

  it('a wrong public key (different device) fails verification', () => {
    const otherCred = register(11, RP);
    const a = authenticate(SECRET, 'c1', RP); // signed by device 7
    const v = verifyAssertion(otherCred, 'c1', RP, a); // verified against device 11's key
    expect(v.signatureOk).toBe(false);
  });
});
