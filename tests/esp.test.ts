import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { esp } from '../src/protocols/esp';

// A real ESP packet (IP protocol 50), starting at the ESP layer. This is the
// classic ESP frame from the Wireshark IPsec sample captures (esp1.pcap, the
// AES-CBC/HMAC-SHA1 transport-mode exchange): the first transmitted packet on
// the SA, so Sequence Number = 1.
//
// ESP cleartext header (8 bytes):
//   SPI             0x00000201   (the SA selector negotiated by IKE)
//   Sequence Number 0x00000001   (first packet on the SA)
//
// Everything after byte 8 — here a 16-byte AES-CBC IV, the encrypted payload,
// the encrypted ESP trailer (Padding + Pad Length + Next Header), and a 12-byte
// HMAC-SHA1-96 ICV — is CIPHERTEXT. We only assert the cleartext header and that
// the opaque remainder lands untouched in node.payload. The bytes below the
// header are illustrative opaque ciphertext (their values are not asserted as
// plaintext, because we cannot and must not invent decrypted content).
const espHeader = [
  0x00, 0x00, 0x02, 0x01, // SPI = 0x00000201
  0x00, 0x00, 0x00, 0x01, // Sequence Number = 1
];
// Opaque encrypted region: 16-byte IV + 16 bytes ciphertext + 12-byte ICV.
const opaque = [
  // 16-byte IV (cipher synchronisation data — opaque)
  0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88,
  0x99, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, 0x00,
  // 16 bytes of ciphertext (encrypted payload + trailer — opaque)
  0xde, 0xad, 0xbe, 0xef, 0xca, 0xfe, 0xba, 0xbe,
  0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef,
  // 12-byte HMAC-SHA1-96 ICV (opaque)
  0xa0, 0xb1, 0xc2, 0xd3, 0xe4, 0xf5, 0x06, 0x17, 0x28, 0x39, 0x4a, 0x5b,
];

describe('ESP (IPsec) dissection', () => {
  const reg = new ProtocolRegistry();
  reg.register(esp);

  it('parses the fixed 8-byte cleartext header (SPI + Sequence Number)', () => {
    const node = dissect([...espHeader, ...opaque], 'esp', reg);
    const h = node.header;
    expect(h.byteLength).toBe(8);
    // SPI is formatted as hex; its numeric value is 0x00000201 = 513.
    expect(h.get('spi')).toBe(0x00000201);
    expect(h.fields.find((f) => f.field.name === 'spi')!.display).toBe('0x00000201');
    // First packet on the SA -> Sequence Number 1.
    expect(h.get('sequenceNumber')).toBe(1);
  });

  it('treats everything after the 8-byte header as opaque ciphertext payload', () => {
    const node = dissect([...espHeader, ...opaque], 'esp', reg);
    // The IV + encrypted payload + encrypted trailer + ICV all fall through.
    expect(node.payload).toEqual(opaque);
    // We never claim to know what is inside — next() stops the dissection.
    expect(esp.next!(node.header, reg)).toBeNull();
    expect(node.child).toBeNull();
  });
});
