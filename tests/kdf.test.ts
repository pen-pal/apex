import { describe, it, expect } from 'vitest';
import { pbkdf2, toHex } from '../src/web/kdf';
import { modpow, dhExchange } from '../src/web/dh';

const enc = (s: string) => new TextEncoder().encode(s);

describe('PBKDF2 (RFC 6070, HMAC-SHA1)', () => {
  it('matches the published vectors for c=1, 2, 4096', async () => {
    const P = enc('password'), S = enc('salt');
    expect(toHex(await pbkdf2(P, S, 1, 'SHA-1', 20))).toBe('0c60c80f961f0e71f3a9b524af6012062fe037a6');
    expect(toHex(await pbkdf2(P, S, 2, 'SHA-1', 20))).toBe('ea6c014dc72d6f8ccd1ed92ace1d41f0d8de8957');
    expect(toHex(await pbkdf2(P, S, 4096, 'SHA-1', 20))).toBe('4b007901b765489abead49d926f721d065a429c1');
  });
  it('a different salt yields a completely different key (rainbow tables defeated)', async () => {
    const a = await pbkdf2(enc('hunter2'), enc('alice'), 1000, 'SHA-256', 32);
    const b = await pbkdf2(enc('hunter2'), enc('bob'), 1000, 'SHA-256', 32);
    expect(toHex(a)).not.toBe(toHex(b)); // same password, different salt → unrelated
  });
});

describe('modpow', () => {
  it('computes modular exponentiation exactly', () => {
    expect(modpow(5n, 6n, 23n)).toBe(8n);
    expect(modpow(4n, 13n, 497n)).toBe(445n); // common textbook example
    expect(modpow(2n, 0n, 7n)).toBe(1n);
  });
});

describe('Diffie–Hellman', () => {
  it('both parties derive the same secret (classic p=23, g=5 example)', () => {
    const r = dhExchange(23n, 5n, 6n, 15n);
    expect(r.A).toBe(8n); // 5^6 mod 23
    expect(r.B).toBe(19n); // 5^15 mod 23
    expect(r.sharedAlice).toBe(2n);
    expect(r.sharedBob).toBe(2n);
    expect(r.agree).toBe(true);
  });
  it('different private exponents still converge on a shared secret', () => {
    const r = dhExchange(101n, 2n, 37n, 71n);
    expect(r.agree).toBe(true);
    expect(r.sharedAlice).toBe(r.sharedBob);
  });
});
