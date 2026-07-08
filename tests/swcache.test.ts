import { describe, it, expect } from 'vitest';
import { handle, type Env } from '../src/web/swcache';

// Independent oracle: the five caching strategies. cache-first serves the cache when present else goes to network (or
// errors offline); network-first prefers the network and falls back to cache offline; stale-while-revalidate serves the
// cache and revalidates in the background when online; network-only always hits the network (errors offline);
// cache-only serves the cache or errors. Expected outcomes follow from those rules.

const env = (online: boolean, cached: boolean): Env => ({ online, cached });

describe('cache-first', () => {
  it('serves the cache when present (fast)', () => {
    const o = handle('cache-first', env(true, true));
    expect(o.served).toBe('cache');
    expect(o.fast).toBe(true);
  });
  it('falls to the network on a miss, and errors offline with no cache', () => {
    expect(handle('cache-first', env(true, false)).served).toBe('network');
    expect(handle('cache-first', env(false, false)).served).toBe('error');
  });
});

describe('network-first', () => {
  it('prefers the network, falls back to cache offline', () => {
    expect(handle('network-first', env(true, true)).served).toBe('network');
    expect(handle('network-first', env(false, true)).served).toBe('cache');
    expect(handle('network-first', env(false, false)).served).toBe('error');
  });
});

describe('stale-while-revalidate', () => {
  it('serves the cache and revalidates in the background when online', () => {
    const o = handle('stale-while-revalidate', env(true, true));
    expect(o.served).toBe('cache');
    expect(o.revalidates).toBe(true);
  });
  it('serves the cache offline without revalidating', () => {
    const o = handle('stale-while-revalidate', env(false, true));
    expect(o.served).toBe('cache');
    expect(o.revalidates).toBe(false);
  });
});

describe('network-only and cache-only', () => {
  it('network-only is fresh online, dead offline', () => {
    expect(handle('network-only', env(true, true)).served).toBe('network');
    expect(handle('network-only', env(false, true)).served).toBe('error'); // even with a cache, it won't use it
  });
  it('cache-only serves the cache or errors', () => {
    expect(handle('cache-only', env(true, true)).served).toBe('cache');
    expect(handle('cache-only', env(true, false)).served).toBe('error'); // even online, it won't hit the network
  });
});
