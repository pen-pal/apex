import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { isis } from '../src/protocols/isis';

// A real IS-IS Level 1 LAN Hello (IIH) PDU as captured on a broadcast LAN, as it
// appears immediately after the 802.2 LLC header (DSAP=SSAP=0xFE). IS-IS runs
// directly on the data link — there is NO IP header — so dissection of the link
// frame hands these bytes straight to IS-IS. Layout per ISO/IEC 10589 clause 9.5.
//
// COMMON HEADER (8 bytes, the part Apex models):
//   0x83  Intradomain Routing Protocol Discriminator = 0x83 (IS-IS)
//   0x1b  Length Indicator = 27 (fixed header length for an L1 LAN IIH)
//   0x01  Version/Protocol ID Extension = 1
//   0x00  ID Length = 0  (special value → 6-octet system IDs)
//   0x0f  R/PDU Type byte: 0b000_01111 → reserved=0, PDU Type=15 (L1 LAN IIH)
//   0x01  Version = 1
//   0x00  Reserved = 0
//   0x01  Maximum Area Addresses = 1
const isisCommonHeader = [
  0x83, 0x1b, 0x01, 0x00, 0x0f, 0x01, 0x00, 0x01,
];

// TYPE-SPECIFIC fixed header for an L1 LAN Hello (ISO/IEC 10589 clause 9.5),
// followed by TLVs. Apex does not model these — they fall through as payload.
//   Circuit Type   0x01  → Level 1 only
//   Source ID      6 bytes (system ID 1921.6800.1001)
//   Holding Time   0x001e = 30 seconds
//   PDU Length     0x0036 = 54 bytes total
//   Priority       0x40   = 64 (DIS election priority; high bit reserved)
//   LAN ID         7 bytes (DIS system ID + pseudonode circuit id)
const typeSpecific = [
  0x01,                               // Circuit Type = L1 only
  0x19, 0x21, 0x68, 0x00, 0x10, 0x01, // Source ID
  0x00, 0x1e,                         // Holding Time = 30
  0x00, 0x36,                         // PDU Length = 54
  0x40,                               // Priority = 64
  0x19, 0x21, 0x68, 0x00, 0x10, 0x01, 0x02, // LAN ID
];
// A couple of TLV bytes (Area Addresses TLV, code 1) to stand in for the rest.
const tlvs = [0x01, 0x04, 0x03, 0x49, 0x00, 0x01];

describe('IS-IS L1 LAN Hello dissection', () => {
  const reg = new ProtocolRegistry();
  reg.register(isis);

  it('parses the fixed 8-byte common header', () => {
    const node = dissect([...isisCommonHeader, ...typeSpecific, ...tlvs], 'isis', reg);
    const h = node.header;
    expect(h.byteLength).toBe(8);
    expect(h.get('irpDiscriminator')).toBe(0x83);
    expect(h.get('lengthIndicator')).toBe(27);
    expect(h.get('versionProtocolIdExtension')).toBe(1);
    expect(h.get('idLength')).toBe(0);
    expect(h.get('version')).toBe(1);
    expect(h.get('reserved')).toBe(0);
    expect(h.get('maximumAreaAddresses')).toBe(1);
  });

  it('reads the PDU Type from the low 5 bits, reserved in the high 3 bits', () => {
    const node = dissect([...isisCommonHeader, ...typeSpecific, ...tlvs], 'isis', reg);
    const f = node.header.fields.find((x) => x.field.name === 'reservedPduType')!;
    // Raw byte 0x0f: type = 15, reserved bits = 0.
    expect(node.header.get('reservedPduType')).toBe(0x0f);
    expect(node.header.get('reservedPduType') & 0x1f).toBe(15); // PDU type = 15
    expect(node.header.get('reservedPduType') >> 5).toBe(0); // reserved high bits clear
    expect(f.meaning).toBe('L1 LAN IS-IS Hello (IIH)');
  });

  it('flags the discriminator and special-value fields with their meaning', () => {
    const node = dissect([...isisCommonHeader, ...typeSpecific, ...tlvs], 'isis', reg);
    const get = (name: string) => node.header.fields.find((x) => x.field.name === name)!;
    expect(get('irpDiscriminator').display).toBe('0x83');
    expect(get('irpDiscriminator').meaning).toBe('0x83 (IS-IS / ISO 10589)');
    // ID Length 0 is the special "6-octet IDs" encoding.
    expect(get('idLength').meaning).toBe('0 (means 6-octet system IDs)');
  });

  it('stops dissecting: the type-specific header and TLVs are the payload', () => {
    const node = dissect([...isisCommonHeader, ...typeSpecific, ...tlvs], 'isis', reg);
    expect(isis.next!(node.header, reg)).toBeNull();
    expect(node.child).toBeNull();
    // Everything after the 8-byte common header is exposed as payload.
    expect(node.payload).toEqual([...typeSpecific, ...tlvs]);
    // The type-specific header begins with the Circuit Type byte (L1 only = 1).
    expect(node.payload[0]).toBe(0x01);
  });
});
