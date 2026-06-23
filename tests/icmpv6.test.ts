import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { icmpv6 } from '../src/protocols/icmpv6';

// Hand-verified ICMPv6 Echo Request (RFC 4443 §4.1).
// IPv6 src fe80::1 -> dst fe80::2. The 4-byte header is:
//   Type=128 (0x80, Echo Request), Code=0, Checksum=0xd1df.
// The first body word is Identifier=0x1f3a, Sequence=0x0001, followed by the
// 8-byte echo Data "abcdefgh" (which is returned verbatim in the reply).
// The checksum 0xd1df was computed over the IPv6 pseudo-header + message per
// RFC 4443 §2.3 (verified by the project's own inetChecksum algorithm).
const echoRequest = [
  0x80, 0x00, 0xd1, 0xdf, // type, code, checksum
  0x1f, 0x3a, 0x00, 0x01, // identifier 0x1f3a, sequence 0x0001
  0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, // echo data "abcdefgh"
];

describe('ICMPv6 dissection', () => {
  const reg = new ProtocolRegistry();
  reg.register(icmpv6);

  it('parses the fixed ICMPv6 header of an Echo Request', () => {
    const node = dissect(echoRequest, 'icmpv6', reg);
    const h = node.header;
    expect(h.get('type')).toBe(128); // Echo Request
    expect(h.get('code')).toBe(0);
    expect(h.get('checksum')).toBe(0xd1df);
    // 4-byte ICMPv6 header + the modelled 32-bit body word = 8-byte header.
    expect(h.byteLength).toBe(8);
  });

  it('labels the type via the enum and shows the checksum as hex', () => {
    const node = dissect(echoRequest, 'icmpv6', reg);
    const typeField = node.header.fields.find((f) => f.field.name === 'type')!;
    const ckField = node.header.fields.find((f) => f.field.name === 'checksum')!;
    expect(typeField.display).toContain('Echo Request');
    expect(ckField.display.toLowerCase()).toContain('d1df');
  });

  it('exposes the first body word and leaves echo data as payload', () => {
    const node = dissect(echoRequest, 'icmpv6', reg);
    // body word = identifier(0x1f3a) << 16 | sequence(0x0001) = 0x1f3a0001
    expect(node.header.get('body')).toBe(0x1f3a0001);
    // The 8 echo-data bytes after the 8-byte header are the payload; ICMPv6
    // stops dissecting (type-specific body), so there is no child.
    expect(node.payload).toEqual([0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68]);
    expect(node.child).toBeNull();
  });
});
