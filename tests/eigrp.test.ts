import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { inetChecksum } from '../src/core/checksum';
import { eigrp } from '../src/protocols/eigrp';

// A hand-verified EIGRP HELLO packet (RFC 7868 §6.5 header + a typical Hello
// body of TLVs), the bytes that follow IP protocol 88 to multicast 224.0.0.10.
// A periodic multicast HELLO requires no acknowledgment, so Sequence and Ack are
// both 0 and the Flags word is 0.
//
// EIGRP header (20 bytes, RFC 7868 §6.5):
//   0x02            Header Version = 2 (current format)
//   0x05            Opcode = 5 (Hello/Ack)
//   0xee68          Checksum (RFC 1071 ones'-complement over the whole packet)
//   0x00000000      Flags = 0 (no INIT/CR/RS/EOT)
//   0x00000000      Sequence Number = 0 (no ack required)
//   0x00000000      Acknowledgment Number = 0 (none present -> a true HELLO)
//   0x0000          Virtual Router ID = 0x0000 (Unicast Address Family)
//   0x0064          Autonomous System Number = 100
const eigrpHeader = [
  0x02, 0x05, 0xee, 0x68, // version=2 opcode=5 checksum=0xee68
  0x00, 0x00, 0x00, 0x00, // flags = 0
  0x00, 0x00, 0x00, 0x00, // sequence number = 0
  0x00, 0x00, 0x00, 0x00, // acknowledgment number = 0
  0x00, 0x00, 0x00, 0x64, // VRID = 0x0000, AS = 100
];
// Hello body (TLVs, RFC 7868 §6.6, falls through as node.payload):
//   Parameters TLV (type 0x0001, len 12): K1=1 K2=0 K3=1 K4=0 K5=0 K6=0, Hold=15
//   Software Version TLV (type 0x0004, len 8): IOS 12.4, EIGRP 1.2
const helloBody = [
  0x00, 0x01, 0x00, 0x0c, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x0f, // Parameters TLV
  0x00, 0x04, 0x00, 0x08, 0x0c, 0x04, 0x01, 0x02, // Software Version TLV
];

describe('EIGRP dissection', () => {
  const reg = new ProtocolRegistry();
  reg.register(eigrp);

  it('parses the fixed 20-byte header (RFC 7868 §6.5)', () => {
    const node = dissect([...eigrpHeader, ...helloBody], 'eigrp', reg);
    const h = node.header;
    expect(h.byteLength).toBe(20);
    expect(h.get('version')).toBe(2);
    expect(h.get('opcode')).toBe(5); // Hello/Ack
    expect(h.get('sequenceNumber')).toBe(0);
    expect(h.get('acknowledgeNumber')).toBe(0);
    expect(h.get('virtualRouterId')).toBe(0x0000);
    expect(h.get('autonomousSystemNumber')).toBe(100);
    expect(h.fields.find((f) => f.field.name === 'checksum')!.display).toBe('0xEE68');
  });

  it('decodes the Opcode enum and the VRID / Flags meanings', () => {
    const node = dissect([...eigrpHeader, ...helloBody], 'eigrp', reg);
    const h = node.header;
    expect(h.fields.find((f) => f.field.name === 'opcode')!.display).toBe('5 (Hello/Ack)');
    expect(h.fields.find((f) => f.field.name === 'virtualRouterId')!.meaning).toBe(
      '0x0000 (Unicast Address Family)',
    );
    // No flag bits set in a plain periodic HELLO.
    expect(h.fields.find((f) => f.field.name === 'flags')!.display).toBe('none');
  });

  it('sets the INIT flag bit (0x01) at the least-significant bit of the 32-bit word', () => {
    // Same header but Flags = 0x00000001 (INIT). MSB-first flagBits puts INIT at
    // the last position, so the low bit of the word must decode to INIT.
    const withInit = eigrpHeader.slice();
    withInit[7] = 0x01; // low byte of the 32-bit Flags word
    const node = dissect([...withInit, ...helloBody], 'eigrp', reg);
    const flags = node.header.fields.find((f) => f.field.name === 'flags')!;
    expect(node.header.get('flags')).toBe(1);
    expect(flags.display).toBe('INIT');
  });

  it('bounds the header at 20 bytes and exposes the TLV body as payload', () => {
    const node = dissect([...eigrpHeader, ...helloBody], 'eigrp', reg);
    expect(node.payload.length).toBe(helloBody.length);
    // The body starts with the Parameters TLV (type 0x0001).
    expect(node.payload.slice(0, 2)).toEqual([0x00, 0x01]);
  });

  it('stops dissecting (the TLV body is opcode-specific, no generic child)', () => {
    const node = dissect([...eigrpHeader, ...helloBody], 'eigrp', reg);
    expect(eigrp.next!(node.header, reg)).toBeNull();
    expect(node.child).toBeNull();
  });

  it('checksum is the RFC 1071 Internet checksum over the entire packet', () => {
    // Recompute over the full packet with the checksum field zeroed; it must
    // equal the 0xEE68 on the wire. RFC 7868 §6.5: the checksum covers the whole
    // packet (header + TLV body), with NO IP pseudo-header.
    const pkt = [...eigrpHeader, ...helloBody];
    const zeroed = pkt.slice();
    zeroed[2] = 0;
    zeroed[3] = 0;
    expect(inetChecksum(zeroed)).toBe(0xee68);
  });
});
