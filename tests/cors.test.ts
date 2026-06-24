import { describe, it, expect } from 'vitest';
import { parseOrigin, sameOrigin, isSimple, evaluate, type Request, type ServerCORS } from '../src/web/cors';

const simpleGet: Request = { method: 'GET', customHeaders: [], contentType: '', credentials: false };
const open: ServerCORS = { allowOrigin: '*', allowMethods: ['*'], allowHeaders: ['*'], allowCredentials: false };

describe('same-origin check (scheme + host + port)', () => {
  const o = (u: string) => parseOrigin(u);
  it('default ports normalise', () => {
    expect(sameOrigin(o('https://a.com'), o('https://a.com:443'))).toBe(true);
    expect(sameOrigin(o('http://a.com'), o('http://a.com:80'))).toBe(true);
  });
  it('any differing component breaks the origin', () => {
    expect(sameOrigin(o('https://a.com'), o('http://a.com'))).toBe(false);  // scheme
    expect(sameOrigin(o('https://a.com'), o('https://b.com'))).toBe(false); // host
    expect(sameOrigin(o('https://a.com'), o('https://a.com:8443'))).toBe(false); // port
    expect(sameOrigin(o('https://a.com'), o('https://sub.a.com'))).toBe(false); // subdomain ≠ same origin
  });
});

describe('simple vs preflighted requests', () => {
  it('GET/POST with safe content type is simple', () => {
    expect(isSimple(simpleGet)).toBe(true);
    expect(isSimple({ method: 'POST', customHeaders: [], contentType: 'text/plain', credentials: false })).toBe(true);
  });
  it('PUT, custom headers, or JSON make it non-simple', () => {
    expect(isSimple({ method: 'PUT', customHeaders: [], contentType: '', credentials: false })).toBe(false);
    expect(isSimple({ method: 'GET', customHeaders: ['X-Token'], contentType: '', credentials: false })).toBe(false);
    expect(isSimple({ method: 'POST', customHeaders: [], contentType: 'application/json', credentials: false })).toBe(false);
  });
});

describe('CORS decisions', () => {
  it('same-origin requests bypass CORS entirely', () => {
    const d = evaluate('https://app.com', 'https://app.com/api', simpleGet, open);
    expect(d.sameOrigin).toBe(true);
    expect(d.readable).toBe(true);
    expect(d.needsPreflight).toBe(false);
  });

  it('cross-origin simple GET is readable when Allow-Origin is *', () => {
    const d = evaluate('https://app.com', 'https://api.com/data', simpleGet, open);
    expect(d.needsPreflight).toBe(false);
    expect(d.readable).toBe(true);
  });

  it('cross-origin simple GET is blocked when Allow-Origin omits the page', () => {
    const d = evaluate('https://app.com', 'https://api.com/data', simpleGet, { ...open, allowOrigin: 'https://other.com' });
    expect(d.readable).toBe(false);
    expect(d.actual.reason).toMatch(/not https:\/\/app\.com/);
  });

  it('PUT preflights and succeeds when the method is allowed', () => {
    const put: Request = { method: 'PUT', customHeaders: [], contentType: 'application/json', credentials: false };
    const d = evaluate('https://app.com', 'https://api.com/x', put, { allowOrigin: 'https://app.com', allowMethods: ['PUT'], allowHeaders: ['content-type'], allowCredentials: false });
    expect(d.needsPreflight).toBe(true);
    expect(d.preflight?.ok).toBe(true);
    expect(d.readable).toBe(true);
  });

  it('preflight fails when the method is not in Allow-Methods', () => {
    const del: Request = { method: 'DELETE', customHeaders: [], contentType: '', credentials: false };
    const d = evaluate('https://app.com', 'https://api.com/x', del, { allowOrigin: '*', allowMethods: ['GET', 'POST'], allowHeaders: ['*'], allowCredentials: false });
    expect(d.preflight?.ok).toBe(false);
    expect(d.readable).toBe(false);
  });

  it('a custom header must be listed in Allow-Headers', () => {
    const req: Request = { method: 'GET', customHeaders: ['X-Token'], contentType: '', credentials: false };
    const d = evaluate('https://app.com', 'https://api.com/x', req, { allowOrigin: '*', allowMethods: ['*'], allowHeaders: ['content-type'], allowCredentials: false });
    expect(d.preflight?.ok).toBe(false);
    expect(d.preflight?.reason).toMatch(/X-Token/);
  });

  it('credentialed requests forbid the * wildcard origin', () => {
    const req: Request = { method: 'GET', customHeaders: [], contentType: '', credentials: true };
    const d = evaluate('https://app.com', 'https://api.com/x', req, { allowOrigin: '*', allowMethods: ['*'], allowHeaders: ['*'], allowCredentials: true });
    expect(d.readable).toBe(false);
    expect(d.actual.reason).toMatch(/must be a specific origin/);
  });

  it('credentialed preflight: "*" is NOT a wildcard for methods/headers', () => {
    // specific allow-origin + allow-credentials, but Allow-Methods/Headers are "*".
    // Per the Fetch standard, "*" matches no real method/header under credentials, so
    // the credentialed PUT with a custom header must be blocked.
    const req: Request = { method: 'PUT', customHeaders: ['X-Token'], contentType: 'application/json', credentials: true };
    const d = evaluate('https://app.com', 'https://api.com/x', req,
      { allowOrigin: 'https://app.com', allowMethods: ['*'], allowHeaders: ['*'], allowCredentials: true });
    expect(d.preflight?.ok).toBe(false);
    expect(d.readable).toBe(false);
  });

  it('credentialed preflight succeeds only when method/header are listed literally', () => {
    const req: Request = { method: 'PUT', customHeaders: ['X-Token'], contentType: 'application/json', credentials: true };
    const d = evaluate('https://app.com', 'https://api.com/x', req,
      { allowOrigin: 'https://app.com', allowMethods: ['PUT'], allowHeaders: ['X-Token', 'Content-Type'], allowCredentials: true });
    expect(d.preflight?.ok).toBe(true);
    expect(d.readable).toBe(true);
  });
});
