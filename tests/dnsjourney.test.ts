import { describe, it, expect } from 'vitest';
import { resolve } from '../src/web/dnsjourney';

describe('DNS resolution journey (RFC 1034 §4.3)', () => {
  it('walks stub → recursive → root → TLD → authoritative → stub on a cold cache', () => {
    const j = resolve('www.example.com', 'A');
    expect(j.hops.map((h) => `${h.from}->${h.to}`)).toEqual([
      'stub->recursive',     // the only query the client makes
      'recursive->root',     // referral to .com servers
      'recursive->tld',      // referral to example.com servers
      'authoritative->recursive', // the real answer
      'recursive->stub',     // delivered back + cached
    ]);
  });

  it('classifies the hop kinds (query, two referrals, two answers)', () => {
    const kinds = resolve('www.example.com').hops.map((h) => h.kind);
    expect(kinds).toEqual(['query', 'referral', 'referral', 'answer', 'answer']);
  });

  it('referrals carry NS records pointing one tier closer', () => {
    const j = resolve('www.example.com');
    const root = j.hops[1];
    expect(root.to).toBe('root');
    expect(root.records.some((r) => r.type === 'NS' && r.value.includes('gtld-servers'))).toBe(true);
    const tld = j.hops[2];
    expect(tld.records[0]).toMatchObject({ type: 'NS', value: 'ns1.example.com' });
  });

  it('returns the right record type and value', () => {
    expect(resolve('www.example.com', 'A').answer).toMatchObject({ type: 'A', value: '93.184.216.34' });
    const v6 = resolve('www.example.com', 'AAAA').answer!;
    expect(v6.type).toBe('AAAA');
    expect(v6.value).toContain(':'); // an IPv6 literal
  });

  it('short-circuits to a single round trip on a warm cache (TTL not expired)', () => {
    const j = resolve('www.example.com', 'A', true);
    expect(j.hops).toHaveLength(2); // stub->recursive, recursive->stub
    expect(j.hops[1].cached).toBe(true);
    expect(j.answer).toMatchObject({ type: 'A', value: '93.184.216.34' });
  });

  it('every answer/referral record carries a TTL', () => {
    for (const h of resolve('www.example.com').hops) {
      for (const r of h.records) expect(r.ttl).toBeGreaterThan(0);
    }
  });
});
