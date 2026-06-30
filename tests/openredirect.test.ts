import { describe, it, expect } from 'vitest';
import { classify } from '../src/web/openredirect';

const ORIGIN = 'trusted.com';
const ALLOW = ['login.trusted.com'];
const c = (t: string) => classify(t, ORIGIN, ALLOW);

describe('open redirect — safe targets', () => {
  it('a relative path stays same-origin', () => {
    expect(c('/dashboard')).toMatchObject({ kind: 'same-origin', safe: true });
    expect(c('dashboard')).toMatchObject({ kind: 'same-origin', safe: true });
    expect(c('/a/b?x=1#y')).toMatchObject({ kind: 'same-origin', safe: true });
  });
  it('an absolute URL to the same host is fine', () => {
    expect(c('https://trusted.com/account')).toMatchObject({ kind: 'same-origin', safe: true, effectiveHost: 'trusted.com' });
  });
  it('an allowlisted host is permitted', () => {
    expect(c('https://login.trusted.com/cb')).toMatchObject({ kind: 'allowlisted', safe: true });
  });
});

describe('open redirect — off-site escapes (unsafe)', () => {
  it('a plain external URL', () => {
    expect(c('https://evil.com')).toMatchObject({ kind: 'external', safe: false, effectiveHost: 'evil.com' });
    expect(c('http://evil.com/phish')).toMatchObject({ kind: 'external', safe: false, effectiveHost: 'evil.com' });
  });
  it('scheme-relative // goes off-origin', () => {
    const v = c('//evil.com');
    expect(v).toMatchObject({ kind: 'external', safe: false, effectiveHost: 'evil.com' });
    expect(v.trick).toMatch(/scheme-relative/);
  });
  it('the backslash trick: /\\evil.com LOOKS like a path but browsers go off-site', () => {
    const v = c('/\\evil.com');
    expect(v).toMatchObject({ kind: 'external', safe: false, effectiveHost: 'evil.com' });
    expect(v.trick).toMatch(/backslash/);
  });
  it('userinfo @ hides the real host (the part after the last @)', () => {
    const v = c('https://trusted.com@evil.com/');
    expect(v).toMatchObject({ kind: 'external', safe: false, effectiveHost: 'evil.com' });
    expect(v.trick).toMatch(/@/);
  });
  it('a look-alike SUBDOMAIN suffix is not the trusted host', () => {
    expect(c('https://trusted.com.evil.com')).toMatchObject({ kind: 'external', safe: false, effectiveHost: 'trusted.com.evil.com' });
  });
  it('leading whitespace/controls are stripped, exposing the real target', () => {
    expect(c('  //evil.com')).toMatchObject({ kind: 'external', safe: false, effectiveHost: 'evil.com' });
    expect(c('\thttps://evil.com')).toMatchObject({ kind: 'external', safe: false, effectiveHost: 'evil.com' });
  });
  it('tab/newline injected mid-URL is removed (no bypass)', () => {
    // "https://ev\nil.com" → browsers strip the newline → evil.com, still caught
    expect(c('https://ev\nil.com')).toMatchObject({ effectiveHost: 'evil.com', safe: false });
  });
});

describe('open redirect — scheme tricks (fail closed)', () => {
  it('a different scheme without // navigates off-site (http: from an https page)', () => {
    // a real browser sends "http:evil.com" to evil.com; must not be called same-origin
    expect(c('http:evil.com')).toMatchObject({ kind: 'external', safe: false, effectiveHost: 'evil.com' });
  });
  it('an ambiguous "scheme:host" with no // is failed closed, not treated as a path', () => {
    expect(c('https:evil.com').safe).toBe(false);
  });
  it('javascript: and data: are flagged as dangerous, never same-origin', () => {
    expect(c('javascript:alert(document.cookie)').safe).toBe(false);
    expect(c('data:text/html,<script>1</script>').safe).toBe(false);
  });
});

describe('open redirect — port and case', () => {
  it('strips the port and lowercases the host for comparison', () => {
    expect(c('https://TRUSTED.com:8443/x')).toMatchObject({ kind: 'same-origin', safe: true });
  });
  it('empty input is invalid', () => {
    expect(c('   ')).toMatchObject({ kind: 'invalid', safe: false });
  });
});
