import { describe, it, expect } from 'vitest';
import { send, INTERNET_IP, type Topology } from '../src/web/bridgenet';

// Independent oracle: the routing rules of container networking, not the implementation. (1) Two containers on the
// same bridge share an L2 domain → delivered directly with private IPs unchanged (no NAT). (2) Containers on different
// bridges are isolated → dropped. (3) Egress to the internet succeeds iff MASQUERADE rewrites the private source to a
// routable address (else the reply can't route back). Expected hops/verdicts are derived from those rules.

const topo = (masquerade: boolean, bBridge = 'docker0'): Topology => ({
  hostPublicIp: '203.0.113.5',
  masquerade,
  containers: [
    { name: 'web', ip: '172.17.0.2', bridge: 'docker0' },
    { name: 'db', ip: '172.17.0.3', bridge: bBridge },
  ],
});

describe('same bridge — direct L2, no NAT', () => {
  it('web → db on docker0 is delivered with private IPs unchanged', () => {
    const r = send(topo(true), 'web', 'db');
    expect(r.ok).toBe(true);
    const last = r.hops[r.hops.length - 1];
    expect(last.where).toBe('db:eth0');
    expect(last.src).toBe('172.17.0.2');   // source never rewritten
    expect(last.dst).toBe('172.17.0.3');
    expect(r.hops.some((h) => h.rewrite)).toBe(false); // no NAT anywhere on the path
  });
  it('addressing the target by IP works the same as by name', () => {
    expect(send(topo(true), 'web', '172.17.0.3').ok).toBe(true);
  });
});

describe('different bridge — isolated', () => {
  it('web → db is dropped when db is on another bridge', () => {
    const r = send(topo(true, 'br1'), 'web', 'db');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/different bridge/i);
    expect(r.hops.some((h) => h.where === 'db:eth0')).toBe(false); // never reaches the target
  });
});

describe('internet egress — needs MASQUERADE', () => {
  it('with MASQUERADE, the private source is SNATed to the host IP and it succeeds', () => {
    const r = send(topo(true), 'web', INTERNET_IP);
    expect(r.ok).toBe(true);
    const snat = r.hops.find((h) => h.rewrite);
    expect(snat).toBeTruthy();
    expect(snat!.src).toBe('203.0.113.5');   // rewritten to the host's routable IP
    const last = r.hops[r.hops.length - 1];
    expect(last.where).toBe('the internet');
    expect(last.src).toBe('203.0.113.5');     // internet sees the host, not the container
    expect(last.dst).toBe(INTERNET_IP);
  });
  it('without MASQUERADE the private source leaks out and the reply is stranded', () => {
    const r = send(topo(false), 'web', INTERNET_IP);
    expect(r.ok).toBe(false);
    expect(r.hops.some((h) => h.rewrite)).toBe(false);       // no rewrite happened
    const last = r.hops[r.hops.length - 1];
    expect(last.src).toBe('172.17.0.2');                     // the private source reached the internet unchanged
    expect(r.reason).toMatch(/RFC1918|stranded|route back|reply/i);
  });
});
