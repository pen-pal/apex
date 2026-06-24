import { describe, it, expect } from 'vitest';
import { gather, pairWorks, negotiate, type Peer } from '../src/web/nattraversal';

const peer = (name: string, nat: Peer['nat'], lan = `10.0.${name}.5`, sameLanAs?: string): Peer => ({ name, nat, lan, sameLanAs });

describe('candidate gathering', () => {
  it('gathers host + srflx + relay behind a NAT', () => {
    const c = gather(peer('A', 'cone'));
    expect(c.map((x) => x.type)).toEqual(['host', 'srflx', 'relay']); // sorted by priority
  });
  it('an open peer has no server-reflexive candidate (already public)', () => {
    const c = gather(peer('A', 'open'));
    expect(c.map((x) => x.type)).toEqual(['host', 'relay']);
  });
});

describe('connectivity checks pick the best working pair', () => {
  it('same-LAN peers connect host↔host directly', () => {
    const a = peer('A', 'cone', '192.168.1.10');
    const b = peer('B', 'cone', '192.168.1.10'); // same LAN
    const r = negotiate(a, b);
    expect(r.selected).toBe('host');
    expect(r.relayed).toBe(false);
  });

  it('two cone NATs hole-punch a direct srflx pair via STUN (no relay)', () => {
    const r = negotiate(peer('A', 'cone'), peer('B', 'cone'));
    expect(r.checks.find((c) => c.type === 'host')!.works).toBe(false); // different LANs
    expect(r.checks.find((c) => c.type === 'srflx')!.works).toBe(true);
    expect(r.selected).toBe('srflx');
    expect(r.relayed).toBe(false);
  });

  it('a symmetric NAT on EITHER side forces the TURN relay', () => {
    const r1 = negotiate(peer('A', 'symmetric'), peer('B', 'cone'));
    expect(r1.selected).toBe('relay');
    expect(r1.relayed).toBe(true);
    expect(r1.checks.find((c) => c.type === 'srflx')!.reason).toMatch(/SYMMETRIC/);

    const r2 = negotiate(peer('A', 'cone'), peer('B', 'symmetric'));
    expect(r2.selected).toBe('relay');
  });

  it('an open peer can still go direct (srflx) with a cone peer', () => {
    expect(pairWorks('srflx', peer('A', 'open'), peer('B', 'cone'))).toBe(true);
    expect(negotiate(peer('A', 'open'), peer('B', 'cone')).selected).toBe('srflx');
  });

  it('relay always works as the last resort', () => {
    expect(pairWorks('relay', peer('A', 'symmetric'), peer('B', 'symmetric'))).toBe(true);
    expect(negotiate(peer('A', 'symmetric'), peer('B', 'symmetric')).selected).toBe('relay');
  });
});
