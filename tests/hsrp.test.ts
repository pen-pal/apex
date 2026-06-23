import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { hsrp } from '../src/protocols/hsrp';

// A hand-verified HSRP version 0 Hello (RFC 2281 section 5.1) — the 20-byte UDP
// payload (UDP src/dst port 1985, to multicast 224.0.0.2). This matches the
// canonical HSRP Hello seen in real captures (e.g. the Wireshark sample
// captures): an Active router, group 1, default timers, default "cisco"
// password, virtual IP 192.168.0.10.
//
//   0x00        Version = 0 (RFC 2281)
//   0x00        Op Code = 0 (Hello)
//   0x10        State = 16 (Active)
//   0x03        Hellotime = 3 seconds (default)
//   0x0A        Holdtime = 10 seconds (default)
//   0x64        Priority = 100 (default)
//   0x01        Group = 1
//   0x00        Reserved = 0
//   0x63 69 73 63 6F 00 00 00   Authentication Data = "cisco" (RFC 2281 default)
//   0xC0 A8 00 0A               Virtual IP Address = 192.168.0.10
const hsrpHello = [
  0x00, 0x00, 0x10, 0x03,
  0x0a, 0x64, 0x01, 0x00,
  0x63, 0x69, 0x73, 0x63, 0x6f, 0x00, 0x00, 0x00, // "cisco" + NUL padding
  192, 168, 0, 10, // virtual IP 192.168.0.10
];

describe('HSRP (RFC 2281) dissection', () => {
  const reg = new ProtocolRegistry();
  reg.register(hsrp);

  it('parses the fixed 20-byte Hello header', () => {
    const node = dissect(hsrpHello, 'hsrp', reg);
    const h = node.header;
    expect(h.byteLength).toBe(20);
    expect(h.get('version')).toBe(0);
    expect(h.get('opCode')).toBe(0); // Hello
    expect(h.get('state')).toBe(16); // Active
    expect(h.get('helloTime')).toBe(3);
    expect(h.get('holdTime')).toBe(10);
    expect(h.get('priority')).toBe(100);
    expect(h.get('group')).toBe(1);
    expect(h.get('reserved')).toBe(0);
  });

  it('decodes the enum meanings per RFC 2281', () => {
    const node = dissect(hsrpHello, 'hsrp', reg);
    const h = node.header;
    expect(h.fields.find((f) => f.field.name === 'opCode')!.meaning).toBe('Hello');
    expect(h.fields.find((f) => f.field.name === 'state')!.meaning).toBe('Active');
  });

  it('reads Authentication Data as the 8-byte "cisco" default', () => {
    const node = dissect(hsrpHello, 'hsrp', reg);
    const auth = node.header.fields.find((f) => f.field.name === 'authenticationData')!;
    expect(auth.bytes).toEqual([0x63, 0x69, 0x73, 0x63, 0x6f, 0x00, 0x00, 0x00]);
    // The default password is the ASCII string "cisco" (RFC 2281 section 5.1).
    const ascii = String.fromCharCode(...auth.bytes!.filter((b) => b !== 0));
    expect(ascii).toBe('cisco');
  });

  it('reads the virtual IP and stops dissecting (HSRP is top of stack)', () => {
    const node = dissect(hsrpHello, 'hsrp', reg);
    const vip = node.header.fields.find((f) => f.field.name === 'virtualIpAddress')!;
    expect(vip.display).toBe('192.168.0.10');
    expect(node.child).toBe(null);
    expect(hsrp.next!(node.header, reg)).toBe(null);
    expect(node.payload.length).toBe(0); // fixed 20-byte message, nothing trails
  });
});
