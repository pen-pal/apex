import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { isakmp } from '../src/protocols/isakmp';

// A real IKE_SA_INIT *request* header as seen at the start of any IKEv2
// negotiation (e.g. a strongSwan / Wireshark capture on UDP port 500).
// Byte layout per RFC 7296 §3.1 (the fixed 28-byte IKE header):
//
//   offset 0-7   Initiator's SPI  = 0x90 9d ... (8 octets, MUST be non-zero)
//   offset 8-15  Responder's SPI  = 00 00 00 00 00 00 00 00
//                                   (all-zero: the responder is not yet known
//                                    in the very first message of the exchange)
//   offset 16    Next Payload     = 0x21 = 33 (SA — the first payload)
//   offset 17    Version          = 0x20 (major 2, minor 0 -> IKEv2.0)
//   offset 18    Exchange Type    = 0x22 = 34 (IKE_SA_INIT)
//   offset 19    Flags            = 0x08 (I = Initiator set; R clear -> request)
//   offset 20-23 Message ID       = 0x00000000 (first message uses ID 0)
//   offset 24-27 Length           = 0x000000f4 = 244 bytes total
//
// The Length (244) bounds the whole IKE message: a 28-byte header plus 216
// bytes of payload chain (SA, KE, Nonce, …). We append exactly 216 payload
// bytes and then 6 extra "trailing" bytes that MUST NOT leak into the payload.
const INITIATOR_SPI = [0x90, 0x9d, 0x3a, 0x2f, 0x1c, 0x77, 0xb4, 0x05];
const TOTAL_LEN = 0xf4; // 244

const header28: number[] = [
  ...INITIATOR_SPI, // 0-7   Initiator's SPI
  0, 0, 0, 0, 0, 0, 0, 0, // 8-15  Responder's SPI (all zero in first message)
  0x21, // 16  Next Payload = 33 (SA)
  0x20, // 17  Version = IKEv2.0
  0x22, // 18  Exchange Type = 34 (IKE_SA_INIT)
  0x08, // 19  Flags = I (Initiator)
  0x00, 0x00, 0x00, 0x00, // 20-23 Message ID = 0
  0x00, 0x00, 0x00, 0xf4, // 24-27 Length = 244
];

const PAYLOAD_LEN = TOTAL_LEN - 28; // 216 bytes of payload chain
const message: number[] = [
  ...header28,
  ...new Array(PAYLOAD_LEN).fill(0xab), // the (in-the-clear) SA/KE/Nonce payload chain
  // 6 extra bytes after the IKE message — e.g. UDP padding or a following
  // datagram. Length=244 must keep these OUT of the payload.
  0xde, 0xad, 0xbe, 0xef, 0x00, 0x11,
];

describe('IKE / ISAKMP header dissection (RFC 7296 §3.1)', () => {
  const reg = new ProtocolRegistry();
  reg.register(isakmp);

  it('parses the fixed 28-byte IKE header fields', () => {
    const node = dissect(message, 'isakmp', reg);
    const h = node.header;
    expect(h.byteLength).toBe(28);
    expect(h.get('nextPayload')).toBe(33);
    expect(h.get('version')).toBe(0x20);
    expect(h.get('exchangeType')).toBe(34);
    expect(h.get('flags')).toBe(0x08);
    expect(h.get('messageId')).toBe(0);
    expect(h.get('length')).toBe(244);
  });

  it('reads the 8-octet SPIs as raw bytes', () => {
    const node = dissect(message, 'isakmp', reg);
    const iSpi = node.header.fields.find((f) => f.field.name === 'initiatorSPI')!;
    const rSpi = node.header.fields.find((f) => f.field.name === 'responderSPI')!;
    expect(iSpi.bytes).toEqual(INITIATOR_SPI);
    // Responder SPI is all-zero in the very first message (no responder yet).
    expect(rSpi.bytes).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('decodes the enums and flags to their RFC meanings', () => {
    const node = dissect(message, 'isakmp', reg);
    const get = (n: string) => node.header.fields.find((f) => f.field.name === n)!;
    expect(get('nextPayload').display).toBe('33 (SA (Security Association))');
    expect(get('exchangeType').display).toBe('34 (IKE_SA_INIT)');
    // Version byte 0x20 -> IKEv2.0.
    expect(get('version').meaning).toBe('IKEv2.0 (major 2, minor 0)');
    // Flags 0x08 -> only the Initiator bit set, this is a request.
    expect(get('flags').meaning).toBe('I (Initiator) (0x08)');
  });

  it('bounds the PDU to the Length field so trailing bytes do not leak', () => {
    const node = dissect(message, 'isakmp', reg);
    // payload = total length (244) minus the 28-byte header = 216 bytes
    expect(node.payload.length).toBe(216);
    // the 6 bytes after the IKE message are trailer, not payload
    expect(node.trailer.length).toBe(6);
  });

  it('stops dissecting: the payload chain is IKE-internal / opaque', () => {
    const node = dissect(message, 'isakmp', reg);
    expect(node.child).toBeNull();
  });
});
