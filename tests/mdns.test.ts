import { describe, it, expect } from 'vitest';
import { SERVICES, serviceTypes, browse, resolve, target, isLocal, MDNS_GROUP, MDNS_PORT } from '../src/web/mdns';

describe('mDNS facts', () => {
  it('uses the multicast group and port from RFC 6762', () => {
    expect(MDNS_GROUP).toBe('224.0.0.251');
    expect(MDNS_PORT).toBe(5353);
  });
  it('recognises .local names', () => {
    expect(isLocal('laserjet.local')).toBe(true);
    expect(isLocal('example.com')).toBe(false);
  });
});

describe('DNS-SD browsing (PTR)', () => {
  it('lists the distinct service types on the link', () => {
    expect(serviceTypes(SERVICES)).toEqual(['_airplay._tcp.local', '_googlecast._tcp.local', '_http._tcp.local', '_ipp._tcp.local'].sort());
  });
  it('a PTR query returns every instance of a type', () => {
    const airplay = browse(SERVICES, '_airplay._tcp.local');
    expect(airplay.map((s) => s.instance).sort()).toEqual(['Kitchen', 'Living Room']);
    expect(browse(SERVICES, '_ipp._tcp.local')).toHaveLength(1);
  });
});

describe('the DNS-SD resolution chain', () => {
  const printer = browse(SERVICES, '_ipp._tcp.local')[0];

  it('resolves PTR → SRV → TXT → A down to a connectable address', () => {
    const chain = resolve(printer);
    expect(chain.map((r) => r.kind)).toEqual(['PTR', 'SRV', 'TXT', 'A']);
    expect(chain.find((r) => r.kind === 'SRV')!.value).toBe('laserjet.local:631');
    expect(chain.find((r) => r.kind === 'A')!.value).toBe('192.168.1.20');
    expect(chain.find((r) => r.kind === 'TXT')!.value).toContain('ty=HP LaserJet Pro');
    expect(target(printer)).toBe('192.168.1.20:631');
  });

  it('SRV names the instance, A names the host', () => {
    const chain = resolve(printer);
    expect(chain.find((r) => r.kind === 'SRV')!.name).toBe('Office LaserJet._ipp._tcp.local');
    expect(chain.find((r) => r.kind === 'A')!.name).toBe('laserjet.local');
  });
});
