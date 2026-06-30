import { describe, it, expect } from 'vitest';
import { parseHeader, isHsts, record, navigate, type HstsStore } from '../src/web/hsts';

const NO_PRELOAD = new Set<string>();

describe('parsing the Strict-Transport-Security header (RFC 6797 §6.1)', () => {
  it('parses max-age, includeSubDomains, and preload (case-insensitive)', () => {
    expect(parseHeader('max-age=31536000; includeSubDomains; preload'))
      .toEqual({ maxAge: 31536000, includeSubDomains: true, preload: true });
    expect(parseHeader('MAX-AGE=600; INCLUDESUBDOMAINS')).toEqual({ maxAge: 600, includeSubDomains: true, preload: false });
  });
  it('accepts a quoted max-age value', () => {
    expect(parseHeader('max-age="0"')).toEqual({ maxAge: 0, includeSubDomains: false, preload: false });
  });
  it('rejects a header with no max-age directive (invalid)', () => {
    expect(parseHeader('includeSubDomains')).toBeNull();
    expect(parseHeader('max-age=')).toBeNull();
    expect(parseHeader('max-age=-5')).toBeNull();
  });
});

describe('the HSTS store & superdomain matching (§8.2–§8.3)', () => {
  const store: HstsStore = { 'example.com': { expiry: 100, includeSubDomains: true }, 'plain.test': { expiry: 100, includeSubDomains: false } };
  it('an exact, unexpired entry makes a host HSTS', () => {
    expect(isHsts(store, NO_PRELOAD, 'plain.test', 50)).toBe(true);
  });
  it('an expired entry no longer protects', () => {
    expect(isHsts(store, NO_PRELOAD, 'plain.test', 150)).toBe(false);
  });
  it('includeSubDomains on a parent protects subdomains', () => {
    expect(isHsts(store, NO_PRELOAD, 'app.example.com', 50)).toBe(true);
  });
  it('without includeSubDomains, a subdomain is NOT covered', () => {
    expect(isHsts(store, NO_PRELOAD, 'sub.plain.test', 50)).toBe(false);
  });
  it('the preload list protects even with an empty store', () => {
    expect(isHsts({}, new Set(['preloaded.test']), 'preloaded.test', 0)).toBe(true);
  });
});

describe('recording headers (§8.1 — ignore over insecure transport)', () => {
  it('an HSTS header received over https is stored', () => {
    const s = record({}, 'a.test', { maxAge: 100, includeSubDomains: false, preload: false }, true, 0);
    expect(s['a.test']).toEqual({ expiry: 100, includeSubDomains: false });
  });
  it('an HSTS header received over plaintext http is IGNORED', () => {
    const s = record({}, 'a.test', { maxAge: 100, includeSubDomains: false, preload: false }, false, 0);
    expect(s['a.test']).toBeUndefined();
  });
  it('max-age=0 deletes the entry', () => {
    const start: HstsStore = { 'a.test': { expiry: 999, includeSubDomains: false } };
    const s = record(start, 'a.test', { maxAge: 0, includeSubDomains: false, preload: false }, true, 0);
    expect(s['a.test']).toBeUndefined();
  });
});

describe('navigation, SSL stripping, and the trust-on-first-use gap', () => {
  it('FIRST visit over http with a MITM is intercepted (the TOFU gap)', () => {
    const r = navigate('http', 'bank.test', {}, NO_PRELOAD, 0, true);
    expect(r.intercepted).toBe(true);
    expect(r.finalScheme).toBe('http');
  });
  it('after the header is recorded, a later http navigation is upgraded — MITM locked out', () => {
    const store = record({}, 'bank.test', { maxAge: 1000, includeSubDomains: false, preload: false }, true, 0);
    const r = navigate('http', 'bank.test', store, NO_PRELOAD, 10, true);
    expect(r.upgraded).toBe(true);
    expect(r.finalScheme).toBe('https');
    expect(r.intercepted).toBe(false);
  });
  it('a preloaded host is upgraded on the very FIRST visit — closes the TOFU gap', () => {
    const r = navigate('http', 'bank.test', {}, new Set(['bank.test']), 0, true);
    expect(r.upgraded).toBe(true);
    expect(r.intercepted).toBe(false);
  });
  it('an https navigation is always safe', () => {
    expect(navigate('https', 'x.test', {}, NO_PRELOAD, 0, true).intercepted).toBe(false);
  });
  it('end to end: strip on first visit, but only if no header was ever seen', () => {
    // visit 1: http, MITM strips, and (critically) the attacker can prevent the STS header reaching us
    let store: HstsStore = {};
    const v1 = navigate('http', 'site.test', store, NO_PRELOAD, 0, true);
    expect(v1.intercepted).toBe(true);
    // visit over https DID deliver the header → store it
    store = record(store, 'site.test', { maxAge: 1000, includeSubDomains: true, preload: false }, true, 1);
    // visit 2: now even a subdomain over http is upgraded
    expect(navigate('http', 'api.site.test', store, NO_PRELOAD, 2, true).upgraded).toBe(true);
  });
});
