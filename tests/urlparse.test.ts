import { describe, it, expect } from 'vitest';
import { parseUrl, pctDecode } from '../src/web/urlparse';

describe('parseUrl (RFC 3986)', () => {
  it('breaks a full URL into every component', () => {
    const u = parseUrl('https://user:pass@example.com:8443/a/b?x=1&y=two%20words#frag');
    expect(u.ok).toBe(true);
    expect(u.scheme).toBe('https');
    expect(u.user).toBe('user');
    expect(u.password).toBe('pass');
    expect(u.host).toBe('example.com');
    expect(u.port).toBe('8443');
    expect(u.effectivePort).toBe(8443);
    expect(u.isDefaultPort).toBe(false);
    expect(u.path).toBe('/a/b');
    expect(u.fragment).toBe('frag');
  });

  it('parses query params and percent-decodes their values', () => {
    const u = parseUrl('https://h/s?x=1&y=two%20words&q=a%2Bb');
    expect(u.params).toEqual([
      { rawKey: 'x', rawValue: '1', key: 'x', value: '1' },
      { rawKey: 'y', rawValue: 'two%20words', key: 'y', value: 'two words' },
      { rawKey: 'q', rawValue: 'a%2Bb', key: 'q', value: 'a+b' }, // %2B is a literal '+'
    ]);
  });

  it('treats "+" as a space in query values (form encoding)', () => {
    expect(parseUrl('http://h/?q=hello+world').params[0].value).toBe('hello world');
    // but NOT in the path
    expect(parseUrl('http://h/a+b').pathDecoded).toBe('/a+b');
  });

  it('fills in the scheme default port and flags when it is the default', () => {
    const u = parseUrl('https://example.com/');
    expect(u.port).toBe(''); // none written
    expect(u.effectivePort).toBe(443); // https default
    const explicit = parseUrl('https://example.com:443/');
    expect(explicit.isDefaultPort).toBe(true); // :443 is redundant on https
  });

  it('detects a punycode (IDN) host', () => {
    const u = parseUrl('https://xn--80ak6aa92e.com/');
    expect(u.isPunycode).toBe(true);
    expect(parseUrl('https://example.com/').isPunycode).toBe(false);
  });

  it('keeps an IPv6 literal host intact and finds its port', () => {
    const u = parseUrl('http://[2001:db8::1]:8080/path');
    expect(u.host).toBe('[2001:db8::1]');
    expect(u.port).toBe('8080');
    expect(u.path).toBe('/path');
  });

  it('handles userinfo without a password and a query-less URL', () => {
    const u = parseUrl('ftp://anonymous@ftp.example.org/pub/');
    expect(u.user).toBe('anonymous');
    expect(u.password).toBe('');
    expect(u.params).toHaveLength(0);
    expect(u.effectivePort).toBe(21); // ftp default
  });

  it('rejects empty / nonsense input', () => {
    expect(parseUrl('').ok).toBe(false);
    expect(parseUrl('   ').ok).toBe(false);
  });
});

describe('pctDecode', () => {
  it('decodes UTF-8 percent escapes and tolerates malformed ones', () => {
    expect(pctDecode('caf%C3%A9')).toBe('café');
    expect(pctDecode('%zz')).toBe('%zz'); // invalid escape returned as-is
  });
});
