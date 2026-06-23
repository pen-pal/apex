import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { vlan } from '../src/protocols/vlan';

// A hand-verified 802.1Q tag, modelled starting AFTER the 0x8100 TPID (which a
// NIC reads as the Ethernet EtherType to recognise the tag — in Apex it is
// consumed by the Ethernet layer). So these bytes are the 2-byte TCI + 2-byte
// inner EtherType, followed by the start of an inner IPv4 header.
//
// TCI = 0xA064:
//   byte 0 = 1010 0000  -> PCP = 101 (=5, Voice), DEI = 0, VID high nibble = 0000
//   byte 1 = 0110 0100  -> VID low byte = 0x64
//   => PCP=5, DEI=0, VID = 0x064 = 100
// Inner EtherType = 0x0800 (IPv4).
const tci = [0xa0, 0x64];
const innerEtherType = [0x08, 0x00];
// First bytes of an inner IPv4 header (0x45 = v4/IHL5, 0x00 DSCP/ECN, total len...)
const ipv4Start = [0x45, 0x00, 0x00, 0x3c];

describe('802.1Q VLAN tag dissection', () => {
  const reg = new ProtocolRegistry();
  reg.register(vlan);

  it('parses the 4-byte tag (TCI + inner EtherType)', () => {
    const node = dissect([...tci, ...innerEtherType, ...ipv4Start], 'vlan', reg);
    const h = node.header;
    expect(h.byteLength).toBe(4);
    expect(h.get('pcp')).toBe(5);
    expect(h.get('dei')).toBe(0);
    expect(h.get('vid')).toBe(100);
    expect(h.get('innerEtherType')).toBe(0x0800);
  });

  it('formats PCP and inner EtherType via their enums', () => {
    const node = dissect([...tci, ...innerEtherType, ...ipv4Start], 'vlan', reg);
    const pcp = node.header.fields.find((f) => f.field.name === 'pcp')!;
    const et = node.header.fields.find((f) => f.field.name === 'innerEtherType')!;
    expect(pcp.meaning).toContain('Voice');
    expect(et.meaning).toBe('IPv4');
  });

  it('leaves the inner Layer-3 bytes in the payload', () => {
    const node = dissect([...tci, ...innerEtherType, ...ipv4Start], 'vlan', reg);
    // 4-byte tag consumed; the rest is the inner protocol's bytes.
    expect(node.payload).toEqual(ipv4Start);
    expect(node.payload[0]).toBe(0x45); // start of the IPv4 header
  });

  it('dispatches to the inner Layer-3 protocol by inner EtherType', () => {
    const node = dissect([...tci, ...innerEtherType, ...ipv4Start], 'vlan', reg);
    expect(vlan.next!(node.header, reg)).toBe('ipv4');

    // VID 200, inner type IPv6 -> dispatch to ipv6.
    // TCI for PCP=0,DEI=0,VID=200(0x0C8) = 0x00C8; inner type 0x86DD.
    const v6 = dissect([0x00, 0xc8, 0x86, 0xdd, 0x60, 0x00], 'vlan', reg);
    expect(v6.header.get('vid')).toBe(200);
    expect(vlan.next!(v6.header, reg)).toBe('ipv6');
  });
});
