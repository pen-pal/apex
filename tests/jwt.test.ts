import { describe, it, expect } from 'vitest';
import { signHS256, verifyStrict, verifyNaive, forgeAlgNone, decodeJwt, b64urlToBytes, bytesToB64url } from '../src/web/jwt';

const HEADER = { alg: 'HS256', typ: 'JWT' };
const PAYLOAD = { sub: '1234567890', name: 'John Doe', iat: 1516239022 };
const SECRET = 'your-256-bit-secret';
// the well-known jwt.io default token
const JWT_IO = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

describe('signing produces real, standard tokens', () => {
  it('reproduces the well-known jwt.io HS256 reference token exactly', async () => {
    expect(await signHS256(HEADER, PAYLOAD, SECRET)).toBe(JWT_IO);
  });
  it('base64url round-trips arbitrary bytes', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255, 42]);
    expect([...b64urlToBytes(bytesToB64url(bytes))]).toEqual([...bytes]);
  });
});

describe('strict verification', () => {
  it('accepts a valid token and rejects a wrong secret', async () => {
    expect((await verifyStrict(JWT_IO, SECRET)).valid).toBe(true);
    expect((await verifyStrict(JWT_IO, 'wrong-secret')).valid).toBe(false);
  });
  it('rejects a token whose payload was tampered (signature no longer matches)', async () => {
    const [h, , s] = JWT_IO.split('.');
    const tampered = `${h}.${bytesToB64url(new TextEncoder().encode(JSON.stringify({ ...PAYLOAD, name: 'HACKER' })))}.${s}`;
    expect((await verifyStrict(tampered, SECRET)).valid).toBe(false);
  });
});

describe('the alg=none forgery', () => {
  it('a naive verifier accepts an unsigned forged token; a strict one rejects it', async () => {
    const forged = forgeAlgNone(JWT_IO, { admin: true });
    expect(decodeJwt(forged).payload.admin).toBe(true);   // attacker escalated privileges
    expect(decodeJwt(forged).alg).toBe('none');

    const naive = await verifyNaive(forged, SECRET);
    expect(naive.valid).toBe(true);                        // VULNERABLE
    expect(naive.reason).toMatch(/none/);

    const strict = await verifyStrict(forged, SECRET);
    expect(strict.valid).toBe(false);                      // safe: server fixed the alg
  });
  it('the naive verifier still checks HS256 signatures — it only fails open on alg=none', async () => {
    expect((await verifyNaive(JWT_IO, SECRET)).valid).toBe(true);
    expect((await verifyNaive(JWT_IO, 'wrong')).valid).toBe(false);
  });
});
