import { describe, it, expect } from 'vitest';
import { classify, evaluate } from '../src/web/ssrf';

describe('host classification', () => {
  it('the cloud metadata endpoint is its own category', () => {
    expect(classify('http://169.254.169.254/latest/meta-data/iam/security-credentials/').category).toBe('metadata');
  });
  it('loopback in its many forms', () => {
    expect(classify('http://localhost:6379').category).toBe('loopback');
    expect(classify('http://127.0.0.1/admin').category).toBe('loopback');
    expect(classify('http://[::1]:8080').category).toBe('loopback');
  });
  it('the RFC 1918 private ranges', () => {
    expect(classify('http://10.0.0.5').category).toBe('private');
    expect(classify('http://172.16.4.4').category).toBe('private');
    expect(classify('http://172.32.0.1').category).toBe('public'); // .32 is outside 16–31
    expect(classify('http://192.168.1.1').category).toBe('private');
  });
  it('an ordinary public host', () => {
    expect(classify('https://api.example.com/v1/things').category).toBe('public');
  });
});

describe('the SSRF check', () => {
  it('without protection, an attacker reaches the metadata service (credential theft)', () => {
    const r = evaluate('http://169.254.169.254/latest/meta-data/', false);
    expect(r.fetched).toBe(true);
    expect(r.blocked).toBe(false);
    expect(r.danger).toMatch(/IAM credentials/);
  });
  it('with protection, internal targets are blocked', () => {
    for (const u of ['http://169.254.169.254/', 'http://localhost:6379', 'http://10.0.0.5', 'http://192.168.1.1']) {
      const r = evaluate(u, true);
      expect(r.blocked).toBe(true);
      expect(r.fetched).toBe(false);
    }
  });
  it('public requests are allowed in both modes (the feature still works)', () => {
    expect(evaluate('https://example.com/logo.png', true).fetched).toBe(true);
    expect(evaluate('https://example.com/logo.png', false).fetched).toBe(true);
  });
  it('only internal categories are flagged internal', () => {
    expect(evaluate('https://example.com', true).internal).toBe(false);
    expect(evaluate('http://10.1.2.3', true).internal).toBe(true);
  });
});
