import { describe, it, expect } from 'vitest';
import { classify, providerOf, type DnsRecord } from '../src/web/subdomaintakeover';

describe('provider detection', () => {
  it('recognizes shared claim-anyone providers', () => {
    expect(providerOf('myorg.github.io')).toMatchObject({ name: 'GitHub Pages', reclaimable: true });
    expect(providerOf('app123.herokuapp.com')).toMatchObject({ reclaimable: true });
    expect(providerOf('bucket.s3.amazonaws.com')).toMatchObject({ name: 'AWS S3' });
  });
  it('recognizes verified providers as NOT reclaimable', () => {
    expect(providerOf('shop.myshopify.com')).toMatchObject({ reclaimable: false });
    expect(providerOf('d123.cloudfront.net')).toMatchObject({ reclaimable: false });
  });
  it('returns null for an unknown / own-infra target', () => {
    expect(providerOf('10.0.0.5')).toBeNull();
    expect(providerOf('origin.mycorp.internal')).toBeNull();
  });
});

const rec = (target: string, live: boolean): DnsRecord => ({ subdomain: 'blog.example.com', target, live });

describe('takeover classification', () => {
  it('a LIVE resource is safe', () => {
    expect(classify(rec('myorg.github.io', true)).status).toBe('safe');
  });
  it('a dangling CNAME to a claim-anyone provider is a TAKEOVER', () => {
    const v = classify(rec('myorg.github.io', false));
    expect(v.status).toBe('takeover');
    expect(v.provider).toBe('GitHub Pages');
    expect(v.reason).toMatch(/anyone can register/);
  });
  it('a dangling CNAME to a VERIFIED provider is dangling but not takeover-able', () => {
    expect(classify(rec('shop.myshopify.com', false)).status).toBe('dangling');
    expect(classify(rec('d123.cloudfront.net', false)).status).toBe('dangling');
  });
  it('a dead target on no known provider is just a broken link (dangling, not takeover)', () => {
    expect(classify(rec('origin.mycorp.internal', false)).status).toBe('dangling');
  });
  it('the danger is specifically dead-resource + reclaimable-provider', () => {
    // same provider, only the live flag differs → safe vs takeover
    expect(classify(rec('app.herokuapp.com', true)).status).toBe('safe');
    expect(classify(rec('app.herokuapp.com', false)).status).toBe('takeover');
  });
});
