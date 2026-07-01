import { describe, it, expect } from 'vitest';
import { distance, bucketIndex, sharedPrefix, routingTable, lookup, nearest, BITS } from '../src/web/kademlia';

describe('XOR distance metric', () => {
  it('is the bitwise XOR, symmetric, and zero to itself', () => {
    expect(distance(10, 9)).toBe(3);          // 1010 ^ 1001 = 0011
    expect(distance(10, 9)).toBe(distance(9, 10));
    expect(distance(42, 42)).toBe(0);
  });
  it('close means a long shared prefix', () => {
    expect(sharedPrefix(0xf0, 0xf1)).toBe(7); // differ only in the last bit
    expect(sharedPrefix(0xf0, 0x70)).toBe(0); // differ in the first bit
    expect(sharedPrefix(200, 200)).toBe(BITS);
    // a closer node (by XOR) shares at least as long a prefix
    expect(sharedPrefix(0b11000000, 0b11000001)).toBeGreaterThan(sharedPrefix(0b11000000, 0b10000000));
  });
  it('bucket index is the high bit of the distance', () => {
    expect(bucketIndex(0, 1)).toBe(0);
    expect(bucketIndex(0, 0b10000000)).toBe(7);
    expect(bucketIndex(5, 5)).toBe(-1);       // same node → no bucket
  });
});

describe('routing tables are small (O(log n))', () => {
  it('a 24-node network needs far fewer than 24 contacts', () => {
    let s = 1; const rnd = (n: number) => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s % n; };
    const set = new Set<number>(); while (set.size < 24) set.add(rnd(256));
    const net = [...set];
    const rt = routingTable(net[0], net, 3);
    expect(rt.length).toBeLessThan(net.length);          // sublinear
    expect(rt.length).toBeLessThanOrEqual(3 * BITS);     // at most k per bucket
    expect(rt).not.toContain(net[0]);                    // never itself
  });
});

describe('iterative lookup converges on the nearest node', () => {
  it('finds the true closest node over 4000 random networks', () => {
    let s = 1; const rnd = (n: number) => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s % n; };
    const randNet = (size: number) => { const set = new Set<number>(); while (set.size < size) set.add(rnd(256)); return [...set]; };
    let hops = 0;
    for (let t = 0; t < 4000; t++) {
      const net = randNet(8 + rnd(40)), target = rnd(256), start = net[rnd(net.length)];
      const r = lookup(net, target, start, 3);
      expect(distance(r.result, target)).toBe(distance(nearest(net, target), target)); // reached the nearest
      hops += r.hops;
    }
    expect(hops / 4000).toBeLessThan(BITS * 2); // O(log n)-ish, well under the ID bit-width
  });
});
