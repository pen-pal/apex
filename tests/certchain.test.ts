import { describe, it, expect } from 'vitest';
import { validateChain, hostMatches, type Cert } from '../src/web/certchain';

const NOW = 1_700_000_000;
const DAY = 86400;
const cert = (over: Partial<Cert>): Cert => ({
  subject: 'x', issuer: 'y', notBefore: NOW - DAY, notAfter: NOW + DAY, isCA: false, sans: [], signatureValidByParent: true, ...over,
});

// A good 3-cert chain: leaf → intermediate → root.
const goodChain = (): Cert[] => [
  cert({ subject: 'CN=shop.example.com', issuer: 'CN=Example Intermediate CA', sans: ['shop.example.com', '*.example.com'] }),
  cert({ subject: 'CN=Example Intermediate CA', issuer: 'CN=Example Root CA', isCA: true }),
  cert({ subject: 'CN=Example Root CA', issuer: 'CN=Example Root CA', isCA: true }), // self-signed root
];
const ROOTS = new Set(['CN=Example Root CA']);

describe('hostMatches', () => {
  it('matches exact and single-level wildcard SANs', () => {
    expect(hostMatches(cert({ sans: ['shop.example.com'] }), 'shop.example.com')).toBe(true);
    expect(hostMatches(cert({ sans: ['*.example.com'] }), 'shop.example.com')).toBe(true);
    expect(hostMatches(cert({ sans: ['*.example.com'] }), 'a.b.example.com')).toBe(false); // wildcard = one label
    expect(hostMatches(cert({ sans: ['shop.example.com'] }), 'evil.com')).toBe(false);
  });
});

describe('validateChain — the happy path', () => {
  it('trusts a well-formed chain to a trusted root', () => {
    const r = validateChain(goodChain(), 'shop.example.com', NOW, ROOTS);
    expect(r.valid).toBe(true);
    expect(r.failAt).toBeNull();
    expect(r.links.every((l) => l.ok)).toBe(true);
  });
});

describe('validateChain — each failure mode fails at the right link', () => {
  it('rejects a host the leaf does not cover', () => {
    const r = validateChain(goodChain(), 'evil.com', NOW, ROOTS);
    expect(r.valid).toBe(false);
    expect(r.failure).toBe('host-mismatch');
    expect(r.failAt).toBe(0);
  });
  it('rejects an expired cert at its own link', () => {
    const c = goodChain();
    c[1] = { ...c[1], notAfter: NOW - DAY }; // intermediate expired
    const r = validateChain(c, 'shop.example.com', NOW, ROOTS);
    expect(r.failure).toBe('expired');
    expect(r.failAt).toBe(1);
  });
  it('rejects a broken issuer→subject link', () => {
    const c = goodChain();
    c[0] = { ...c[0], issuer: 'CN=Someone Else' };
    const r = validateChain(c, 'shop.example.com', NOW, ROOTS);
    expect(r.failure).toBe('issuer-subject-mismatch');
    expect(r.failAt).toBe(0);
  });
  it('rejects a forged signature', () => {
    const c = goodChain();
    c[0] = { ...c[0], signatureValidByParent: false };
    const r = validateChain(c, 'shop.example.com', NOW, ROOTS);
    expect(r.failure).toBe('bad-signature');
    expect(r.failAt).toBe(0);
  });
  it('rejects a non-CA that signed a cert', () => {
    const c = goodChain();
    c[1] = { ...c[1], isCA: false }; // intermediate is not a CA
    const r = validateChain(c, 'shop.example.com', NOW, ROOTS);
    expect(r.failure).toBe('parent-not-ca');
    expect(r.failAt).toBe(1);
  });
  it('rejects a chain ending at an untrusted root', () => {
    const r = validateChain(goodChain(), 'shop.example.com', NOW, new Set(['CN=Some Other Root']));
    expect(r.failure).toBe('untrusted-root');
    expect(r.failAt).toBe(2);
  });
  it('rejects an empty chain', () => {
    expect(validateChain([], 'shop.example.com', NOW, ROOTS).failure).toBe('empty');
  });
});
