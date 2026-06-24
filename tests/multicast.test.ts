import { describe, it, expect } from 'vitest';
import { join, leave, memberPorts, forward, isMulticast, type Host, type Membership } from '../src/web/multicast';

const HOSTS: Host[] = [
  { id: 0, name: 'A', port: 1 },
  { id: 1, name: 'B', port: 2 },
  { id: 2, name: 'C', port: 3 },
  { id: 3, name: 'D', port: 4 },
];
const G = '239.1.1.1';

describe('isMulticast', () => {
  it('recognises the 224–239 range', () => {
    expect(isMulticast('239.1.1.1')).toBe(true);
    expect(isMulticast('224.0.0.1')).toBe(true);
    expect(isMulticast('192.168.1.1')).toBe(false);
  });
});

describe('multicast delivery reaches only members', () => {
  it('a frame reaches exactly the joined hosts, not the others', () => {
    let m: Membership = {};
    m = join(m, G, 0); // A joins
    m = join(m, G, 2); // C joins
    const d = forward(m, G, HOSTS, 'multicast');
    expect(d.delivered.sort()).toEqual([0, 2]); // A and C only
    expect(d.ports).toEqual([1, 3]); // forwarded out their ports only
    expect(d.pruned).toBe(false);
  });

  it('a non-member receives nothing', () => {
    let m: Membership = join({}, G, 0);
    expect(forward(m, G, HOSTS, 'multicast').delivered).toEqual([0]); // B/C/D get nothing
  });

  it('leaving the group stops delivery to that host', () => {
    let m: Membership = join(join({}, G, 0), G, 1);
    m = leave(m, G, 0); // A leaves
    const d = forward(m, G, HOSTS, 'multicast');
    expect(d.delivered).toEqual([1]); // only B now
    expect(d.delivered).not.toContain(0);
  });

  it('the last member leaving PRUNES the group (nothing forwarded)', () => {
    let m: Membership = join({}, G, 0);
    m = leave(m, G, 0); // last member gone
    expect(m[G]).toBeUndefined(); // group removed
    const d = forward(m, G, HOSTS, 'multicast');
    expect(d.delivered).toEqual([]);
    expect(d.ports).toEqual([]);
    expect(d.pruned).toBe(true);
  });
});

describe('multicast vs broadcast contrast', () => {
  it('broadcast hits every host regardless of membership', () => {
    const d = forward({}, G, HOSTS, 'broadcast');
    expect(d.delivered.sort()).toEqual([0, 1, 2, 3]); // everyone, even with no joins
  });
  it('memberPorts dedups when two members share a port (e.g. behind a hub)', () => {
    const sharedPort: Host[] = [{ id: 0, name: 'A', port: 1 }, { id: 1, name: 'B', port: 1 }];
    const m = join(join({}, G, 0), G, 1);
    expect(memberPorts(m, G, sharedPort)).toEqual([1]); // one port, not two
  });
});
