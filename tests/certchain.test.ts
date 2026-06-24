import { describe, it, expect } from 'vitest';
import { validateChain, hostMatches, signed, verifyCert, genKey, type Cert, type PubKey } from '../src/web/certchain';

const NOW = 1_700_000_000;
const DAY = 86400;

// Real teaching keypairs for the three roles.
const rootKey = genKey(50021);
const interKey = genKey(50111);
const leafKey = genKey(50231);
const pub = (k: typeof rootKey): PubKey => ({ n: k.n, e: k.e });

const mkCert = (over: Partial<Cert>): Cert => ({
  subject: 'x', issuer: 'y', notBefore: NOW - DAY, notAfter: NOW + DAY, isCA: false, sans: [],
  pubKey: { n: 1n, e: 1n }, signature: 0n, ...over,
});

// A good 3-cert chain with genuine RSA signatures: leaf → intermediate → root.
const goodChain = (): Cert[] => {
  const root = signed({ subject: 'CN=Example Root CA', issuer: 'CN=Example Root CA', notBefore: NOW - DAY, notAfter: NOW + DAY, isCA: true, sans: [] }, pub(rootKey), rootKey);
  const inter = signed({ subject: 'CN=Example Intermediate CA', issuer: 'CN=Example Root CA', notBefore: NOW - DAY, notAfter: NOW + DAY, isCA: true, sans: [] }, pub(interKey), rootKey);
  const leaf = signed({ subject: 'CN=shop.example.com', issuer: 'CN=Example Intermediate CA', notBefore: NOW - DAY, notAfter: NOW + DAY, isCA: false, sans: ['shop.example.com', '*.example.com'] }, pub(leafKey), interKey);
  return [leaf, inter, root];
};
const ROOTS = new Set(['CN=Example Root CA']);

describe('hostMatches', () => {
  it('matches exact and single-level wildcard SANs', () => {
    expect(hostMatches(mkCert({ sans: ['shop.example.com'] }), 'shop.example.com')).toBe(true);
    expect(hostMatches(mkCert({ sans: ['*.example.com'] }), 'shop.example.com')).toBe(true);
    expect(hostMatches(mkCert({ sans: ['*.example.com'] }), 'a.b.example.com')).toBe(false); // wildcard = one label
    expect(hostMatches(mkCert({ sans: ['shop.example.com'] }), 'evil.com')).toBe(false);
  });
});

describe('real RSA signatures on the certs', () => {
  it('a signed cert verifies under the signer, not under a stranger', () => {
    const c = signed({ subject: 'CN=leaf', issuer: 'CN=inter', notBefore: NOW - DAY, notAfter: NOW + DAY, isCA: false, sans: [] }, pub(leafKey), interKey);
    expect(verifyCert(c, pub(interKey))).toBe(true);
    expect(verifyCert(c, pub(rootKey))).toBe(false);
  });
  it('tampering any signed field invalidates the signature', () => {
    const c = signed({ subject: 'CN=leaf', issuer: 'CN=inter', notBefore: NOW - DAY, notAfter: NOW + DAY, isCA: false, sans: [] }, pub(leafKey), interKey);
    expect(verifyCert({ ...c, subject: 'CN=evil' }, pub(interKey))).toBe(false);
    expect(verifyCert({ ...c, isCA: true }, pub(interKey))).toBe(false);
  });
});

describe('validateChain — the happy path', () => {
  it('trusts a well-formed, genuinely-signed chain to a trusted root', () => {
    const r = validateChain(goodChain(), 'shop.example.com', NOW, ROOTS);
    expect(r.valid).toBe(true);
    expect(r.failAt).toBeNull();
    expect(r.links.every((l) => l.ok)).toBe(true);
  });
});

describe('validateChain — each failure mode fails at the right link', () => {
  it('rejects a host the leaf does not cover', () => {
    const r = validateChain(goodChain(), 'evil.com', NOW, ROOTS);
    expect(r.failure).toBe('host-mismatch');
    expect(r.failAt).toBe(0);
  });
  it('rejects an expired cert at its own link', () => {
    const c = goodChain();
    c[1] = { ...c[1], notAfter: NOW - DAY }; // intermediate expired (date is checked before signature)
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
  it('rejects a forged signature (real verify fails)', () => {
    const c = goodChain();
    c[0] = { ...c[0], signature: c[0].signature + 1n }; // tamper the signature value itself
    const r = validateChain(c, 'shop.example.com', NOW, ROOTS);
    expect(r.failure).toBe('bad-signature');
    expect(r.failAt).toBe(0);
  });
  it('rejects a non-CA that signed a cert', () => {
    const c = goodChain();
    c[1] = { ...c[1], isCA: false }; // intermediate is not a CA (checked while validating the leaf)
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
