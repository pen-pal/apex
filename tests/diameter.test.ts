import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { diameter } from '../src/protocols/diameter';

// A hand-verified Diameter Capabilities-Exchange-Request (CER), dissected from
// the Diameter layer. Built per RFC 6733 §3 (header) and §5.3.1 (CER).
//
// 20-byte Diameter header (RFC 6733 §3):
//   Version        = 0x01                    (1)
//   Message Length = 0x00006c = 108 bytes    (20 header + 88 bytes of AVPs)
//   Command Flags  = 0x80                     (R set -> a Request)
//   Command Code   = 0x000101 = 257           (Capabilities-Exchange -> CER)
//   Application-Id = 0x00000000               (0 = Diameter base/common)
//   Hop-by-Hop Id  = 0x53caff21
//   End-to-End Id  = 0x7ddf9e6a
const header = [
  0x01, // Version = 1
  0x00, 0x00, 0x6c, // Message Length = 108
  0x80, // Command Flags = R (Request)
  0x00, 0x01, 0x01, // Command Code = 257 (CER)
  0x00, 0x00, 0x00, 0x00, // Application-Id = 0
  0x53, 0xca, 0xff, 0x21, // Hop-by-Hop Identifier
  0x7d, 0xdf, 0x9e, 0x6a, // End-to-End Identifier
];

// The AVPs a CER carries (RFC 6733 §4: AVP = Code(4) Flags(1) Length(3) Data,
// padded to a 4-byte boundary; 0x40 = M/Mandatory flag):
//   Origin-Host (264)     = "client.example.com"
//   Origin-Realm (296)    = "example.com"
//   Host-IP-Address (257) = AddressType 1 (IPv4) + 192.0.2.1
//   Vendor-Id (266)       = 0
//   Product-Name (269)    = "Apex"
// 88 bytes total, so Message Length = 20 + 88 = 108. Verified byte-by-byte.
const avps = [
  // Origin-Host (264 = 0x108), M, AVP Length 26, "client.example.com" + 2 pad
  0x00, 0x00, 0x01, 0x08, 0x40, 0x00, 0x00, 0x1a,
  0x63, 0x6c, 0x69, 0x65, 0x6e, 0x74, 0x2e, 0x65,
  0x78, 0x61, 0x6d, 0x70, 0x6c, 0x65, 0x2e, 0x63,
  0x6f, 0x6d, 0x00, 0x00,
  // Origin-Realm (296 = 0x128), M, AVP Length 19, "example.com" + 1 pad
  0x00, 0x00, 0x01, 0x28, 0x40, 0x00, 0x00, 0x13,
  0x65, 0x78, 0x61, 0x6d, 0x70, 0x6c, 0x65, 0x2e,
  0x63, 0x6f, 0x6d, 0x00,
  // Host-IP-Address (257 = 0x101), M, AVP Length 14, AddrType 1 + 192.0.2.1 + 2 pad
  0x00, 0x00, 0x01, 0x01, 0x40, 0x00, 0x00, 0x0e,
  0x00, 0x01, 0xc0, 0x00, 0x02, 0x01, 0x00, 0x00,
  // Vendor-Id (266 = 0x10a), M, AVP Length 12, value 0
  0x00, 0x00, 0x01, 0x0a, 0x40, 0x00, 0x00, 0x0c,
  0x00, 0x00, 0x00, 0x00,
  // Product-Name (269 = 0x10d), AVP Length 12, "Apex"
  0x00, 0x00, 0x01, 0x0d, 0x00, 0x00, 0x00, 0x0c,
  0x41, 0x70, 0x65, 0x78,
];

describe('Diameter (RFC 6733) dissection', () => {
  const reg = new ProtocolRegistry();
  reg.register(diameter);

  it('parses the fixed 20-byte header (Version, Length, Flags, Code, IDs)', () => {
    const node = dissect([...header, ...avps], 'diameter', reg);
    const h = node.header;
    expect(h.byteLength).toBe(20);

    // Version = 1 (RFC 6733 fixes Version to 1).
    expect(h.get('version')).toBe(1);

    // Message Length = 108 (24-bit field, total message incl. header).
    expect(h.get('messageLength')).toBe(108);

    // Command Flags = 0x80 -> only R (Request) set.
    expect(h.get('commandFlags')).toBe(0x80);
    expect(h.fields.find((f) => f.field.name === 'commandFlags')!.meaning).toBe(
      'R (Request) (0x80)',
    );

    // Command Code = 257 -> Capabilities-Exchange (CER with R set).
    expect(h.get('commandCode')).toBe(257);
    expect(h.fields.find((f) => f.field.name === 'commandCode')!.meaning).toBe(
      'Capabilities-Exchange (CER/CEA)',
    );

    // Application-Id = 0 (Diameter base/common message).
    expect(h.get('applicationId')).toBe(0);

    // The two identifiers (32-bit each), read big-endian.
    expect(h.get('hopByHopId')).toBe(0x53caff21);
    expect(h.get('endToEndId')).toBe(0x7ddf9e6a);
  });

  it('the R flag distinguishes a request (CER) from an answer (CEA)', () => {
    // Clear the R bit (0x80) in the flags byte -> the same Command Code 257
    // now names a Capabilities-Exchange-ANSWER (CEA), per RFC 6733 §3.
    const cea = [...header];
    cea[4] = 0x00; // command flags: R cleared
    const node = dissect([...cea, ...avps], 'diameter', reg);
    expect(node.header.get('commandCode')).toBe(257); // same code...
    expect(node.header.get('commandFlags') & 0x80).toBe(0); // ...but R clear => answer
    expect(node.header.fields.find((f) => f.field.name === 'commandFlags')!.meaning).toBe(
      'none (0x00)',
    );
  });

  it('bounds the PDU at Message Length and leaves the AVPs as opaque payload', () => {
    // Append trailing bytes that must NOT leak into the payload (Length = 108).
    const node = dissect([...header, ...avps, 0xde, 0xad, 0xbe, 0xef], 'diameter', reg);
    // pduBytes = Message Length = 108, so payload is exactly the 88 AVP bytes.
    expect(node.payload).toEqual(avps);
    // The AVP list is a variable TLV stream, not a separable child protocol.
    expect(diameter.next!(node.header, reg)).toBeNull();
    expect(node.child).toBeNull();
  });
});
