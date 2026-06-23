import { describe, it, expect } from 'vitest';
import { CacheHierarchy } from '../src/web/cachehierarchy';

describe('CDN cache hierarchy', () => {
  it('a cold object misses all the way to the origin', () => {
    const c = new CacheHierarchy();
    const r = c.request('/logo.png', 0);
    expect(r.servedBy).toBe('origin');
    expect(r.path.map((p) => p.outcome)).toEqual(['miss', 'miss', 'miss']);
    expect(r.latencyMs).toBe(200);
  });

  it('the next request is a fast browser hit (populated on the way back)', () => {
    const c = new CacheHierarchy();
    c.request('/logo.png', 0); // cold → origin, now cached everywhere
    const r = c.request('/logo.png', 1);
    expect(r.servedBy).toBe('browser');
    expect(r.path).toEqual([{ tier: 'browser', outcome: 'hit' }]);
    expect(r.latencyMs).toBe(0);
  });

  it('serves from the edge when the browser copy has expired but the edge is fresh', () => {
    const c = new CacheHierarchy();
    c.request('/app.js', 0); // cached everywhere (browser TTL 30s, edge TTL 120s)
    const r = c.request('/app.js', 45); // browser expired (>30s), edge still fresh (<120s)
    expect(r.servedBy).toBe('edge');
    expect(r.path).toEqual([{ tier: 'browser', outcome: 'miss' }, { tier: 'edge', outcome: 'hit' }]);
    expect(r.latencyMs).toBe(20);
  });

  it('revalidates at the origin when every cache copy has expired', () => {
    const c = new CacheHierarchy();
    c.request('/data.json', 0);
    const r = c.request('/data.json', 200); // both browser (30s) and edge (120s) expired
    expect(r.servedBy).toBe('origin');
    expect(r.revalidated).toBe(true); // a 304 refresh, not a cold fetch
    expect(r.path[r.path.length - 1].outcome).toBe('revalidated');
    // and it re-cached, so the very next request is a browser hit again
    expect(c.request('/data.json', 201).servedBy).toBe('browser');
  });

  it('hit ratio climbs as objects warm up', () => {
    const c = new CacheHierarchy();
    expect(c.hitRatio).toBe(0);
    c.request('/a', 0); // miss (origin)
    c.request('/a', 1); // hit (browser)
    c.request('/a', 2); // hit
    c.request('/a', 3); // hit
    expect(c.hitRatio).toBeCloseTo(3 / 4, 5); // 1 cold miss, 3 hits
    expect(c.requests).toBe(4);
  });

  it('snapshot reports TTL remaining per tier', () => {
    const c = new CacheHierarchy();
    c.request('/x', 10);
    const snap = c.snapshot(20); // 10s after caching
    expect(snap.browser[0]).toMatchObject({ object: '/x', ttlLeft: 20 }); // 30 - 10
    expect(snap.edge[0].ttlLeft).toBe(110); // 120 - 10
    expect(snap.origin[0].ttlLeft).toBe(Infinity);
  });
});
