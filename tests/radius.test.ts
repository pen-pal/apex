import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { radius } from '../src/protocols/radius';

// A hand-verified RADIUS Access-Request, dissected starting at the RADIUS layer.
// It is modelled on the canonical example user "nemo" from RFC 2865 §7.1.
//
// 20-byte RADIUS header (RFC 2865 §3):
//   Code          = 0x01  (1 = Access-Request)
//   Identifier    = 0x00
//   Length        = 0x0020 = 32 octets (20 header + 12 attributes)
//   Authenticator = 16 random octets (the Request Authenticator)
//
// Then the Attribute-Value Pairs (RFC 2865 §5), each Type/Length/Value:
//   User-Name (Type 1):       01 06 'n' 'e' 'm' 'o'        -> Length 6
//   NAS-IP-Address (Type 4):  04 06 0a 00 00 01            -> Length 6, value 10.0.0.1
// 12 bytes of attributes total, so header Length = 20 + 12 = 32. Correct.
const header = [
  0x01, // Code = 1 (Access-Request)
  0x00, // Identifier = 0
  0x00, 0x20, // Length = 32
  // 16-octet Request Authenticator (random; values not asserted as meaningful)
  0x0f, 0x40, 0x3f, 0x94, 0x73, 0x97, 0x80, 0x57,
  0xbd, 0x83, 0xd5, 0xcb, 0x98, 0xf4, 0x22, 0x7a,
];
const avps = [
  0x01, 0x06, 0x6e, 0x65, 0x6d, 0x6f, // User-Name = "nemo"
  0x04, 0x06, 0x0a, 0x00, 0x00, 0x01, // NAS-IP-Address = 10.0.0.1
];

describe('RADIUS (RFC 2865) dissection', () => {
  const reg = new ProtocolRegistry();
  reg.register(radius);

  it('parses the fixed 20-byte header (Code, Identifier, Length, Authenticator)', () => {
    const node = dissect([...header, ...avps], 'radius', reg);
    const h = node.header;
    expect(h.byteLength).toBe(20);

    // Code = 1 = Access-Request.
    expect(h.get('code')).toBe(1);
    expect(h.fields.find((f) => f.field.name === 'code')!.meaning).toBe('Access-Request');

    // Identifier = 0.
    expect(h.get('identifier')).toBe(0);

    // Length = 32 octets (20 header + 12 attributes).
    expect(h.get('length')).toBe(32);

    // Authenticator is a 16-octet byte-oriented field.
    const auth = h.fields.find((f) => f.field.name === 'authenticator')!;
    expect(auth.bits).toBe(128);
    expect(auth.bytes).toEqual(header.slice(4, 20));
  });

  it('bounds the PDU at Length and leaves the AVPs as opaque payload', () => {
    // Append trailing padding that must NOT leak into the payload (Length = 32).
    const node = dissect([...header, ...avps, 0xff, 0xff], 'radius', reg);
    // pduBytes = Length = 32, so payload is exactly the 12 attribute bytes.
    expect(node.payload).toEqual(avps);
    // The AVP list is not a separable child protocol — dissection stops here.
    expect(radius.next!(node.header, reg)).toBeNull();
    expect(node.child).toBeNull();
  });
});
