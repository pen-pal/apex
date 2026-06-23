import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { dhcp } from '../src/protocols/dhcp';

// A real DHCP DISCOVER, taken from the widely distributed Wireshark sample
// capture "dhcp.pcap" (the canonical Nominum/ISC trace). Below are the UDP
// payload bytes starting at the DHCP `op` field. The exchange uses:
//   client MAC 00:0b:82:01:fc:42, xid 0x00003d1d, flags 0x0000 (unicast),
//   all addr fields 0.0.0.0, magic cookie 63 82 53 63, then DHCP options
//   (53=DISCOVER, ...) which fall through as payload.
//
// Layout (RFC 2131 sec 2):
//   op htype hlen hops | xid(4) | secs(2) flags(2) | ciaddr(4) | yiaddr(4)
//   | siaddr(4) | giaddr(4) | chaddr(16) | sname(64) | file(128)
//   | magic(4) | options...
//
// prettier-ignore
const dhcpDiscover = [
  // op=1 htype=1 hlen=6 hops=0
  0x01, 0x01, 0x06, 0x00,
  // xid = 0x00003d1d
  0x00, 0x00, 0x3d, 0x1d,
  // secs = 0x0000, flags = 0x0000 (unicast preferred)
  0x00, 0x00, 0x00, 0x00,
  // ciaddr 0.0.0.0
  0x00, 0x00, 0x00, 0x00,
  // yiaddr 0.0.0.0
  0x00, 0x00, 0x00, 0x00,
  // siaddr 0.0.0.0
  0x00, 0x00, 0x00, 0x00,
  // giaddr 0.0.0.0
  0x00, 0x00, 0x00, 0x00,
  // chaddr: 00:0b:82:01:fc:42 then 10 bytes of padding (16 total)
  0x00, 0x0b, 0x82, 0x01, 0xfc, 0x42,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  // sname: 64 zero bytes
  ...new Array(64).fill(0x00),
  // file: 128 zero bytes
  ...new Array(128).fill(0x00),
  // magic cookie 63 82 53 63
  0x63, 0x82, 0x53, 0x63,
  // ----- options (fall through as payload) -----
  // 53,1,1 = DHCP Message Type: DISCOVER
  0x35, 0x01, 0x01,
  // 61,7,01,00:0b:82:01:fc:42 = Client Identifier
  0x3d, 0x07, 0x01, 0x00, 0x0b, 0x82, 0x01, 0xfc, 0x42,
  // 55,3,01,03,06 = Parameter Request List (subnet, router, DNS)
  0x37, 0x03, 0x01, 0x03, 0x06,
  // 255 = End
  0xff,
];

describe('DHCP (RFC 2131) dissection', () => {
  const reg = new ProtocolRegistry();
  reg.register(dhcp);

  it('parses the fixed BOOTP fields of a DISCOVER', () => {
    const node = dissect(dhcpDiscover, 'dhcp', reg);
    const h = node.header;

    expect(h.get('op')).toBe(1); // BOOTREQUEST
    expect(h.get('htype')).toBe(1); // Ethernet
    expect(h.get('hlen')).toBe(6); // MAC length
    expect(h.get('hops')).toBe(0);
    expect(h.get('xid')).toBe(0x00003d1d);
    expect(h.get('secs')).toBe(0);
    expect(h.get('flags')).toBe(0x0000); // unicast preferred
  });

  it('shows op and htype enum meanings from the RFC', () => {
    const node = dissect(dhcpDiscover, 'dhcp', reg);
    const op = node.header.fields.find((f) => f.field.name === 'op')!;
    const htype = node.header.fields.find((f) => f.field.name === 'htype')!;
    expect(op.display).toContain('BOOTREQUEST');
    expect(htype.display).toContain('Ethernet');
  });

  it('all four address fields are 0.0.0.0 in a from-scratch DISCOVER', () => {
    const node = dissect(dhcpDiscover, 'dhcp', reg);
    for (const name of ['ciaddr', 'yiaddr', 'siaddr', 'giaddr']) {
      const f = node.header.fields.find((x) => x.field.name === name)!;
      expect(f.display).toBe('0.0.0.0');
    }
  });

  it('reads chaddr as a 16-byte blob whose first 6 bytes are the MAC', () => {
    const node = dissect(dhcpDiscover, 'dhcp', reg);
    const chaddr = node.header.fields.find((f) => f.field.name === 'chaddr')!;
    expect(chaddr.bytes!.length).toBe(16);
    expect(chaddr.bytes!.slice(0, 6)).toEqual([0x00, 0x0b, 0x82, 0x01, 0xfc, 0x42]);
    expect(chaddr.bytes!.slice(6)).toEqual(new Array(10).fill(0));
  });

  it('sname (64) and file (128) are present and zeroed', () => {
    const node = dissect(dhcpDiscover, 'dhcp', reg);
    const sname = node.header.fields.find((f) => f.field.name === 'sname')!;
    const file = node.header.fields.find((f) => f.field.name === 'file')!;
    expect(sname.bytes!.length).toBe(64);
    expect(file.bytes!.length).toBe(128);
    expect(sname.bytes!.every((b) => b === 0)).toBe(true);
    expect(file.bytes!.every((b) => b === 0)).toBe(true);
  });

  it('carries the fixed magic cookie 0x63825363', () => {
    const node = dissect(dhcpDiscover, 'dhcp', reg);
    expect(node.header.get('magicCookie')).toBe(0x63825363);
  });

  it('header is exactly 240 bytes; options fall through as payload', () => {
    const node = dissect(dhcpDiscover, 'dhcp', reg);
    // op..file = 236 bytes, + 4 magic cookie = 240
    expect(node.header.byteLength).toBe(240);
    // remaining bytes (the TLV options) are the payload, not parsed fields
    const optionBytes = dhcpDiscover.length - 240;
    expect(node.payload.length).toBe(optionBytes);
    // first option byte is tag 53 (DHCP Message Type)
    expect(node.payload[0]).toBe(0x35);
    // last option byte is the End option (255)
    expect(node.payload[node.payload.length - 1]).toBe(0xff);
    // no child layer
    expect(node.child).toBeNull();
  });
});
