import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { ah } from '../src/protocols/ah';

// A hand-verified AH header (RFC 4302 §2) in transport mode protecting TCP,
// with a 96-bit (12-byte) ICV — the size produced by HMAC-SHA1-96 / AES-XCBC-96,
// the classic AH integrity algorithms.
//
// Fixed 12-byte AH header:
//   Next Header     0x06        = 6   -> TCP (the protected upper layer)
//   Payload Length  0x04        = 4   -> total AH = (4+2)*4 = 24 bytes
//                                        => ICV = 24 - 12 = 12 bytes (96-bit tag)
//   Reserved        0x0000      = 0   (MUST be zero)
//   SPI             0x12345678        (Security Association selector)
//   Sequence Number 0x00000001  = 1   (first packet on the SA)
//
// Then the 12-byte ICV (an opaque authentication tag here) followed by the
// protected TCP segment — both land in node.payload.
const ahHeader = [
  0x06, // Next Header = TCP
  0x04, // Payload Length = 4
  0x00, 0x00, // Reserved
  0x12, 0x34, 0x56, 0x78, // SPI
  0x00, 0x00, 0x00, 0x01, // Sequence Number = 1
];
const icv = [0xaa, 0xbb, 0xcc, 0xdd, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88]; // 96-bit ICV
// A stand-in protected TCP segment start (srcPort 0x0050 = 80).
const protectedTcp = [0x00, 0x50, 0xc1, 0x23, 0x00, 0x00, 0x00, 0x00];

describe('AH (IPsec) dissection', () => {
  const reg = new ProtocolRegistry();
  reg.register(ah);

  it('parses the fixed 12-byte header', () => {
    const node = dissect([...ahHeader, ...icv, ...protectedTcp], 'ah', reg);
    const h = node.header;
    expect(h.byteLength).toBe(12);
    expect(h.get('nextHeader')).toBe(6);
    expect(h.get('payloadLen')).toBe(4);
    expect(h.get('reserved')).toBe(0);
    expect(h.get('spi')).toBe(0x12345678);
    expect(h.get('sequenceNumber')).toBe(1);
  });

  it('formats SPI as hex and decodes Next Header to TCP', () => {
    const node = dissect([...ahHeader, ...icv, ...protectedTcp], 'ah', reg);
    const fields = node.header.fields;
    expect(fields.find((f) => f.field.name === 'spi')!.display).toBe('0x12345678');
    expect(fields.find((f) => f.field.name === 'nextHeader')!.meaning).toBe('TCP');
  });

  it('PayloadLen decodes total AH and ICV size per RFC 4302 (words minus 2)', () => {
    const node = dissect([...ahHeader, ...icv, ...protectedTcp], 'ah', reg);
    // (4 + 2) * 4 = 24 bytes total; ICV = 24 - 12 = 12 bytes.
    const pl = node.header.fields.find((f) => f.field.name === 'payloadLen')!;
    expect(pl.meaning).toBe('AH is 24 bytes total (ICV = 12 bytes)');
  });

  it('leaves the ICV + protected payload in node.payload (ICV first)', () => {
    const node = dissect([...ahHeader, ...icv, ...protectedTcp], 'ah', reg);
    // No pduBytes: everything after the 12-byte header is payload.
    expect(node.payload.length).toBe(icv.length + protectedTcp.length);
    expect(node.payload.slice(0, 12)).toEqual(icv);
  });

  it('dispatches to the TCP child via the Next Header field', () => {
    const node = dissect([...ahHeader, ...icv, ...protectedTcp], 'ah', reg);
    expect(ah.next!(node.header, reg)).toBe('tcp');
  });
});
