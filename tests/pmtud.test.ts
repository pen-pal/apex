import { describe, it, expect } from 'vitest';
import { pmtud, type Link } from '../src/web/pmtud';

// A path that narrows then widens again: 1500 → 1400 → 1280 → 1500.
const PATH: Link[] = [
  { name: 'eth0', mtu: 1500 },
  { name: 'tunnel', mtu: 1400 },
  { name: 'vpn', mtu: 1280 },
  { name: 'core', mtu: 1500 },
];

describe('Path MTU Discovery (ICMP allowed)', () => {
  const r = pmtud(PATH, 1500);

  it('converges on the smallest link MTU', () => {
    expect(r.pathMtu).toBe(1280);
    expect(r.blackHole).toBe(false);
  });

  it('takes one attempt per narrowing, each driven by an ICMP next-hop MTU', () => {
    expect(r.attempts.map((a) => a.size)).toEqual([1500, 1400, 1280]);
    expect(r.attempts[0]).toMatchObject({ droppedAtHop: 1, icmpMtu: 1400, delivered: false });
    expect(r.attempts[1]).toMatchObject({ droppedAtHop: 2, icmpMtu: 1280, delivered: false });
    expect(r.attempts[2]).toMatchObject({ droppedAtHop: null, delivered: true });
  });

  it('a packet that already fits is delivered on the first try', () => {
    const r2 = pmtud(PATH, 1280);
    expect(r2.attempts).toHaveLength(1);
    expect(r2.attempts[0].delivered).toBe(true);
    expect(r2.pathMtu).toBe(1280);
  });
});

describe('PMTUD black hole (ICMP filtered)', () => {
  it('the sender never learns the MTU and the transfer is stuck', () => {
    const r = pmtud(PATH, 1500, true);
    expect(r.blackHole).toBe(true);
    expect(r.pathMtu).toBe(null);
    expect(r.attempts).toHaveLength(1);
    expect(r.attempts[0]).toMatchObject({ droppedAtHop: 1, icmpMtu: null, delivered: false });
  });
});
