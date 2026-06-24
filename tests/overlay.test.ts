import { describe, it, expect } from 'vitest';
import { encapsulate, learn, lookup, VXLAN_PORT, VXLAN_OVERHEAD, type Frame, type MacTable } from '../src/web/overlay';

const frame: Frame = { dstMac: '02:00:00:00:00:0b', srcMac: '02:00:00:00:00:0a', payload: 'ping' };

describe('VXLAN encapsulation (RFC 7348)', () => {
  const p = encapsulate(frame, 5000, '10.0.0.1', '10.0.0.2');

  it('carries the VNI with the I flag set and tunnels over UDP port 4789', () => {
    expect(p.vxlan.vni).toBe(5000);
    expect(p.vxlan.flagsHex).toBe('0x08'); // I flag → VNI valid
    expect(p.udp.dstPort).toBe(VXLAN_PORT);
    expect(VXLAN_PORT).toBe(4789);
  });

  it('builds the outer IP header VTEP→VTEP and preserves the inner frame', () => {
    expect(p.outerIp.src).toBe('10.0.0.1');
    expect(p.outerIp.dst).toBe('10.0.0.2');
    expect(p.inner).toEqual(frame); // inner frame untouched
  });

  it('adds 50 bytes of overhead (Eth+IP+UDP+VXLAN)', () => {
    expect(p.overheadBytes).toBe(VXLAN_OVERHEAD);
    expect(VXLAN_OVERHEAD).toBe(50);
  });

  it('derives a deterministic ephemeral source port for ECMP entropy', () => {
    const a = encapsulate(frame, 5000, '10.0.0.1', '10.0.0.2');
    const b = encapsulate(frame, 5000, '10.0.0.1', '10.0.0.2');
    expect(a.udp.srcPort).toBe(b.udp.srcPort);
    expect(a.udp.srcPort).toBeGreaterThanOrEqual(49152);
    expect(a.udp.srcPort).toBeLessThanOrEqual(65535);
  });
});

describe('VTEP MAC learning and tenant isolation', () => {
  let t: MacTable = {};
  t = learn(t, 5000, '02:00:00:00:00:0a', '10.0.0.1'); // VM A on VNI 5000 behind VTEP1

  it('unicasts to the learned VTEP, floods an unknown MAC', () => {
    expect(lookup(t, 5000, '02:00:00:00:00:0a')).toBe('10.0.0.1'); // known → unicast
    expect(lookup(t, 5000, '02:00:00:00:00:0b')).toBeNull(); // unknown → flood (BUM)
  });

  it('isolates VNIs: the same MAC in a different tenant network is unknown', () => {
    expect(lookup(t, 6000, '02:00:00:00:00:0a')).toBeNull(); // same MAC, VNI 6000 → not found
  });

  it('the same MAC can live in two VNIs behind different VTEPs without collision', () => {
    const t2 = learn(t, 6000, '02:00:00:00:00:0a', '10.0.0.9');
    expect(lookup(t2, 5000, '02:00:00:00:00:0a')).toBe('10.0.0.1');
    expect(lookup(t2, 6000, '02:00:00:00:00:0a')).toBe('10.0.0.9'); // independent entry per VNI
  });
});
