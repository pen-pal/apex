import { describe, it, expect } from 'vitest';
import { Nat } from '../src/web/nat';

describe('NAT / PAT translation', () => {
  it('overloads one public IP across multiple internal hosts with unique ports', () => {
    const nat = new Nat('203.0.113.7', 50000);
    const a = nat.outbound({ ip: '192.168.1.10', port: 33333 }, { ip: '93.184.216.34', port: 443 });
    const b = nat.outbound({ ip: '192.168.1.20', port: 33333 }, { ip: '93.184.216.34', port: 443 });
    expect(a.rewritten.ip).toBe('203.0.113.7');
    expect(b.rewritten.ip).toBe('203.0.113.7'); // same public IP
    expect(a.rewritten.port).not.toBe(b.rewritten.port); // distinct public ports
    expect(a.created && b.created).toBe(true);
    expect(nat.mappings).toHaveLength(2);
  });

  it('reuses the mapping for the same flow (no duplicate entry)', () => {
    const nat = new Nat('203.0.113.7');
    const first = nat.outbound({ ip: '192.168.1.10', port: 40000 }, { ip: '1.1.1.1', port: 53 });
    const again = nat.outbound({ ip: '192.168.1.10', port: 40000 }, { ip: '1.1.1.1', port: 53 });
    expect(again.created).toBe(false);
    expect(again.rewritten.port).toBe(first.rewritten.port);
    expect(nat.mappings).toHaveLength(1);
  });

  it('demuxes a return packet back to the correct internal host', () => {
    const nat = new Nat('203.0.113.7', 50000);
    const a = nat.outbound({ ip: '192.168.1.10', port: 33333 }, { ip: '93.184.216.34', port: 443 });
    const b = nat.outbound({ ip: '192.168.1.20', port: 44444 }, { ip: '93.184.216.34', port: 443 });
    const back = nat.inbound(b.rewritten.port, { ip: '93.184.216.34', port: 443 });
    expect(back.delivered).toBe(true);
    expect(back.to).toEqual({ ip: '192.168.1.20', port: 44444 }); // the right host, not host A
    // and host A's reply still routes to A
    expect(nat.inbound(a.rewritten.port, { ip: '93.184.216.34', port: 443 }).to).toEqual({ ip: '192.168.1.10', port: 33333 });
  });

  it('drops an unsolicited inbound packet with no matching entry', () => {
    const nat = new Nat('203.0.113.7', 50000);
    nat.outbound({ ip: '192.168.1.10', port: 33333 }, { ip: '93.184.216.34', port: 443 });
    const evil = nat.inbound(51234, { ip: '6.6.6.6', port: 1337 });
    expect(evil.delivered).toBe(false);
    expect(evil.reason).toMatch(/dropped/);
  });

  it('rejects a reply from the wrong remote even on a live public port', () => {
    const nat = new Nat('203.0.113.7', 50000);
    const a = nat.outbound({ ip: '192.168.1.10', port: 33333 }, { ip: '93.184.216.34', port: 443 });
    // correct public port, but the packet claims to come from a different server
    const spoof = nat.inbound(a.rewritten.port, { ip: '10.20.30.40', port: 443 });
    expect(spoof.delivered).toBe(false); // address-restricted: source must match the mapping
  });
});
