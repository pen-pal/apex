import { describe, it, expect } from 'vitest';
import { parseSetCookie, domainMatch, pathMatch, defaultPath, evaluate, type Cookie, type Request } from '../src/web/cookies';

const NOW = 1_700_000_000;
const set = (header: string, host = 'shop.example.com', path = '/account/orders') =>
  parseSetCookie({ header, requestHost: host, requestPath: path, now: NOW })!;

describe('parseSetCookie (RFC 6265 §5.2)', () => {
  it('parses name/value and the security attributes', () => {
    const c = set('sid=abc123; Domain=example.com; Path=/; Secure; HttpOnly; SameSite=Strict');
    expect(c.name).toBe('sid');
    expect(c.value).toBe('abc123');
    expect(c.domain).toBe('example.com');
    expect(c.hostOnly).toBe(false);
    expect(c.path).toBe('/');
    expect(c.secure && c.httpOnly).toBe(true);
    expect(c.sameSite).toBe('Strict');
  });
  it('defaults to a host-only cookie, Lax SameSite, and the directory path', () => {
    const c = set('theme=dark'); // no attributes
    expect(c.hostOnly).toBe(true);
    expect(c.domain).toBe('shop.example.com');
    expect(c.sameSite).toBe('Lax'); // modern default
    expect(c.path).toBe('/account'); // default-path of /account/orders
  });
  it('resolves Max-Age relative to now', () => {
    expect(set('x=1; Max-Age=3600').expires).toBe(NOW + 3600);
    expect(set('x=1').expires).toBeNull(); // session cookie
  });
});

describe('matching rules', () => {
  it('defaultPath strips to the last slash', () => {
    expect(defaultPath('/a/b/c')).toBe('/a/b');
    expect(defaultPath('/')).toBe('/');
    expect(defaultPath('noslash')).toBe('/');
  });
  it('domainMatch honours host-only vs subdomain scope', () => {
    const hostOnly = set('a=1', 'example.com');
    expect(domainMatch('example.com', hostOnly)).toBe(true);
    expect(domainMatch('www.example.com', hostOnly)).toBe(false); // host-only: no subdomains
    const domainCookie = set('a=1; Domain=example.com', 'example.com');
    expect(domainMatch('www.example.com', domainCookie)).toBe(true); // subdomain allowed
    expect(domainMatch('notexample.com', domainCookie)).toBe(false);
  });
  it('pathMatch requires a prefix on a path boundary', () => {
    expect(pathMatch('/account/orders', '/account')).toBe(true);
    expect(pathMatch('/account', '/account')).toBe(true);
    expect(pathMatch('/accountant', '/account')).toBe(false); // not a boundary
  });
});

describe('evaluate — which cookies are sent and why', () => {
  const jar: Cookie[] = [
    set('sid=1; Domain=example.com; Path=/; Secure; SameSite=Lax', 'example.com', '/'),
    set('csrf=2; Path=/; SameSite=Strict', 'example.com', '/'),
    set('legacy=3; Path=/admin', 'example.com', '/'),
  ];
  const base: Request = { host: 'example.com', path: '/', https: true, crossSite: false, topLevelNav: true, now: NOW };

  it('sends matching cookies on a same-site HTTPS request', () => {
    const r = evaluate(jar, base);
    expect(r.find((x) => x.cookie.name === 'sid')!.sent).toBe(true);
    expect(r.find((x) => x.cookie.name === 'csrf')!.sent).toBe(true);
    expect(r.find((x) => x.cookie.name === 'legacy')!.sent).toBe(false); // path /admin doesn't match /
  });
  it('withholds a Secure cookie over plain HTTP', () => {
    const r = evaluate(jar, { ...base, https: false });
    expect(r.find((x) => x.cookie.name === 'sid')!.reason).toMatch(/Secure/);
    expect(r.find((x) => x.cookie.name === 'sid')!.sent).toBe(false);
  });
  it('blocks SameSite=Strict cross-site, the CSRF defense', () => {
    const r = evaluate(jar, { ...base, crossSite: true });
    expect(r.find((x) => x.cookie.name === 'csrf')!.sent).toBe(false);
    expect(r.find((x) => x.cookie.name === 'csrf')!.reason).toMatch(/Strict/);
  });
  it('allows SameSite=Lax on a cross-site TOP-LEVEL navigation but not a subrequest', () => {
    const lax = evaluate(jar, { ...base, crossSite: true, topLevelNav: true });
    expect(lax.find((x) => x.cookie.name === 'sid')!.sent).toBe(true);
    const sub = evaluate(jar, { ...base, crossSite: true, topLevelNav: false });
    expect(sub.find((x) => x.cookie.name === 'sid')!.sent).toBe(false);
  });
  it('drops an expired cookie', () => {
    const expired = [set('old=1; Max-Age=-1; Path=/', 'example.com', '/')];
    expect(evaluate(expired, base)[0].sent).toBe(false);
    expect(evaluate(expired, base)[0].reason).toMatch(/expired/);
  });
});
