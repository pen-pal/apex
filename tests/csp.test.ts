import { describe, it, expect } from 'vitest';
import { parsePolicy, evaluate, type Load } from '../src/web/csp';

const PAGE = 'app.example.com';
const ev = (policy: string, load: Load) => evaluate(parsePolicy(policy), load, PAGE);

describe('CSP source matching for URLs', () => {
  it("'self' allows same-host, blocks others", () => {
    const inline = "script-src 'self'";
    expect(ev(inline, { type: 'script', kind: 'url', url: 'https://app.example.com/a.js' }).allowed).toBe(true);
    expect(ev(inline, { type: 'script', kind: 'url', url: 'https://evil.com/x.js' }).allowed).toBe(false);
  });

  it('a host allowlist and wildcard subdomain match', () => {
    expect(ev('script-src cdn.example.com', { type: 'script', kind: 'url', url: 'https://cdn.example.com/lib.js' }).allowed).toBe(true);
    expect(ev('script-src *.example.com', { type: 'script', kind: 'url', url: 'https://a.example.com/x.js' }).allowed).toBe(true);
    expect(ev('script-src cdn.example.com', { type: 'script', kind: 'url', url: 'https://other.com/x.js' }).allowed).toBe(false);
  });

  it("'none' blocks everything", () => {
    expect(ev("img-src 'none'", { type: 'img', kind: 'url', url: 'https://app.example.com/p.png' }).allowed).toBe(false);
  });
});

describe('inline scripts and eval (the XSS-relevant cases)', () => {
  it("inline <script> is blocked unless 'unsafe-inline' or a matching nonce", () => {
    expect(ev("script-src 'self'", { type: 'script', kind: 'inline' }).allowed).toBe(false);
    expect(ev("script-src 'self' 'unsafe-inline'", { type: 'script', kind: 'inline' }).allowed).toBe(true);
    expect(ev("script-src 'nonce-abc123'", { type: 'script', kind: 'inline', nonce: 'abc123' }).allowed).toBe(true);
    expect(ev("script-src 'nonce-abc123'", { type: 'script', kind: 'inline', nonce: 'wrong' }).allowed).toBe(false);
  });

  it("eval() is blocked unless 'unsafe-eval'", () => {
    expect(ev("script-src 'self'", { type: 'script', kind: 'eval' }).allowed).toBe(false);
    expect(ev("script-src 'self' 'unsafe-eval'", { type: 'script', kind: 'eval' }).allowed).toBe(true);
  });
});

describe('default-src fallback', () => {
  it('default-src applies when no specific directive exists', () => {
    const p = "default-src 'self'";
    expect(ev(p, { type: 'img', kind: 'url', url: 'https://app.example.com/p.png' }).allowed).toBe(true);
    expect(ev(p, { type: 'img', kind: 'url', url: 'https://cdn.other.com/p.png' }).allowed).toBe(false);
    expect(ev(p, { type: 'script', kind: 'inline' }).allowed).toBe(false); // inherits no unsafe-inline
  });

  it('a resource type with no directive and no default-src is unrestricted', () => {
    const d = ev("script-src 'self'", { type: 'font', kind: 'url', url: 'https://anywhere.com/f.woff' });
    expect(d.allowed).toBe(true);
    expect(d.directive).toBe('(none)');
  });

  it('a specific directive overrides default-src for its type', () => {
    const p = "default-src 'none'; img-src *";
    expect(ev(p, { type: 'img', kind: 'url', url: 'https://anywhere.com/p.png' }).allowed).toBe(true);
    expect(ev(p, { type: 'script', kind: 'url', url: 'https://app.example.com/a.js' }).allowed).toBe(false);
  });
});
