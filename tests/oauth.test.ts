import { describe, it, expect } from 'vitest';
import { codeChallenge, base64url, runFlow, type Params } from '../src/web/oauth';

describe('PKCE (RFC 7636 Appendix B vector)', () => {
  it('code_challenge = BASE64URL(SHA-256(code_verifier))', () => {
    // the exact verifier/challenge pair published in RFC 7636
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    expect(codeChallenge(verifier)).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('base64url has no padding and uses the URL-safe alphabet', () => {
    expect(base64url(new Uint8Array([0xff, 0xff, 0xff]))).toBe('____'); // would be //// in std base64
    expect(base64url(new Uint8Array([0]))).toBe('AA');                  // no '=' padding
  });
});

const params: Params = {
  clientId: 'app123', redirectUri: 'https://app.example/cb', scope: 'profile', state: 'xyz789',
  verifier: 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk',
};

describe('authorization code flow', () => {
  it('the honest flow issues a token after both checks pass', () => {
    const f = runFlow(params);
    expect(f.tokenIssued).toBe(true);
    expect(f.steps.every((s) => s.ok)).toBe(true);
  });

  it('a mismatched state aborts before the token exchange (CSRF defense)', () => {
    const f = runFlow(params, { wrongState: true });
    expect(f.tokenIssued).toBe(false);
    expect(f.reason).toMatch(/CSRF/);
    const stateStep = f.steps.find((s) => s.title.includes('Verify state'))!;
    expect(stateStep.ok).toBe(false);
    // it must not even reach the token exchange
    expect(f.steps.some((s) => s.title.includes('/token'))).toBe(false);
  });

  it('a stolen code cannot be redeemed without the verifier (PKCE defense)', () => {
    const f = runFlow(params, { attackerStealsCode: true });
    expect(f.tokenIssued).toBe(false);
    expect(f.reason).toMatch(/PKCE/);
    const pkceStep = f.steps.find((s) => s.title.includes('checks PKCE'))!;
    expect(pkceStep.ok).toBe(false);
  });
});
