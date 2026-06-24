import { describe, it, expect } from 'vitest';
import { resolve, gratuitous, type Host, type Cache } from '../src/web/arp';

const A: Host = { ip: '192.168.1.10', mac: 'aa:aa:aa', name: 'A' };
const B: Host = { ip: '192.168.1.20', mac: 'bb:bb:bb', name: 'B' };
const C: Host = { ip: '192.168.1.30', mac: 'cc:cc:cc', name: 'C' };
const LAN = [A, B, C];

describe('ARP resolution', () => {
  it('a cache hit returns the MAC with NO broadcast', () => {
    const cache: Cache = { '192.168.1.20': { mac: 'bb:bb:bb', age: 0 } };
    const r = resolve(A, B.ip, cache, LAN, 5);
    expect(r.broadcast).toBe(false);
    expect(r.mac).toBe('bb:bb:bb');
    expect(r.steps.map((s) => s.kind)).toEqual(['cache-hit']);
  });

  it('a cache miss broadcasts who-has, gets is-at, and caches it', () => {
    const r = resolve(A, B.ip, {}, LAN, 7);
    expect(r.broadcast).toBe(true);
    expect(r.mac).toBe('bb:bb:bb');
    expect(r.steps.map((s) => s.kind)).toEqual(['broadcast', 'reply', 'learned']);
    expect(r.cache['192.168.1.20']).toEqual({ mac: 'bb:bb:bb', age: 7 }); // now cached
  });

  it('the next send to the same host is a cache hit (no second broadcast)', () => {
    const first = resolve(A, B.ip, {}, LAN, 7);
    const second = resolve(A, B.ip, first.cache, LAN, 8);
    expect(second.broadcast).toBe(false);
    expect(second.steps.map((s) => s.kind)).toEqual(['cache-hit']);
  });

  it('an IP nobody owns broadcasts but stays unresolved', () => {
    const r = resolve(A, '192.168.1.99', {}, LAN, 9);
    expect(r.mac).toBeNull();
    expect(r.broadcast).toBe(true);
    expect(r.steps.map((s) => s.kind)).toEqual(['broadcast', 'unresolved']);
    expect(r.cache['192.168.1.99']).toBeUndefined();
  });
});

describe('gratuitous ARP', () => {
  it('refreshes hosts that already cached the announcer’s IP (e.g. after a failover)', () => {
    const movedB: Host = { ...B, mac: 'b2:b2:b2' }; // B moved to a new MAC
    const caches: Record<string, Cache> = {
      [A.ip]: { [B.ip]: { mac: 'bb:bb:bb', age: 0 } }, // A has B's OLD mac
      [C.ip]: { [A.ip]: { mac: 'aa:aa:aa', age: 0 } }, // C has no entry for B
    };
    const out = gratuitous(movedB, caches, 12);
    expect(out[A.ip][B.ip]).toEqual({ mac: 'b2:b2:b2', age: 12 }); // A updated to the new mac
    expect(out[C.ip][B.ip]).toBeUndefined(); // C had no entry, so nothing to update
  });
});
