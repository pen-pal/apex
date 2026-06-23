import { describe, it, expect } from 'vitest';
import { decodeJwt, verifyHs256, b64urlToBytes, bytesToB64url } from '../src/web/jwt';
import { hotp, totp, base32Decode } from '../src/web/otp';

// The canonical jwt.io HS256 example (RFC 7515 structure), secret below.
const JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' +
  '.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ' +
  '.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
const SECRET = 'your-256-bit-secret';

describe('JWT decode', () => {
  it('splits and decodes header + payload', () => {
    const j = decodeJwt(JWT);
    expect(j.ok).toBe(true);
    expect(j.header).toEqual({ alg: 'HS256', typ: 'JWT' });
    expect(j.payload).toEqual({ sub: '1234567890', name: 'John Doe', iat: 1516239022 });
    expect(j.alg).toBe('HS256');
    expect(j.warnings).toHaveLength(0);
  });
  it('flags the alg:none forgery vector', () => {
    const header = bytesToB64url(new TextEncoder().encode(JSON.stringify({ alg: 'none', typ: 'JWT' })));
    const payload = bytesToB64url(new TextEncoder().encode(JSON.stringify({ sub: 'admin' })));
    const j = decodeJwt(`${header}.${payload}.`);
    expect(j.ok).toBe(true);
    expect(j.alg).toBe('none');
    expect(j.warnings[0]).toMatch(/UNSIGNED/);
  });
  it('rejects a malformed token', () => {
    expect(decodeJwt('not.a').ok).toBe(false);
  });
});

describe('JWT HS256 verification', () => {
  it('accepts the right secret and rejects a wrong one', async () => {
    expect(await verifyHs256(JWT, SECRET)).toBe(true);
    expect(await verifyHs256(JWT, 'wrong-secret')).toBe(false);
  });
});

describe('base64url round-trip', () => {
  it('survives arbitrary bytes', () => {
    const bytes = new Uint8Array([0, 1, 250, 255, 62, 63, 10]);
    expect([...b64urlToBytes(bytesToB64url(bytes))]).toEqual([...bytes]);
  });
});

describe('HOTP (RFC 4226 Appendix D vectors)', () => {
  const secret = new TextEncoder().encode('12345678901234567890');
  const expected = ['755224', '287082', '359152', '969429', '338314', '254676', '287922', '162583', '399871', '520489'];
  it('matches all ten published counters', async () => {
    for (let c = 0; c < 10; c++) expect(await hotp(secret, c, 6)).toBe(expected[c]);
  });
});

describe('TOTP (RFC 6238)', () => {
  const secret = new TextEncoder().encode('12345678901234567890'); // SHA-1 seed
  it('matches the T=59s, 8-digit published value', async () => {
    expect(await totp(secret, 59, 30, 8)).toBe('94287082');
  });
});

describe('base32 decode (RFC 4648)', () => {
  it('decodes the standard examples', () => {
    expect(new TextDecoder().decode(base32Decode('MFRGG==='))).toBe('abc'); // 'abc'
    expect(new TextDecoder().decode(base32Decode('JBSWY3DP'))).toBe('Hello');
  });
});
