import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { rtp } from '../src/protocols/rtp';

// A hand-verified RTP audio packet: a G.711 µ-law (PCMU) voice packet, the kind
// a SIP phone sends every 20 ms. Byte values cross-checked against RFC 3550 §5.1
// and the RFC 3551 static payload-type table.
//
// Fixed header (12 bytes), big-endian:
//   byte 0  = 0x80  -> V=2 (10), P=0, X=0, CC=0           (10 0 0 0000)
//   byte 1  = 0x00  -> M=0, PT=0 (PCMU / G.711 µ-law)     (0 0000000)
//   bytes 2-3 = 0x1A2B = 6699        sequence number
//   bytes 4-7 = 0x00015F90 = 90000   timestamp (8 kHz clock)
//   bytes 8-11 = 0xDEADBEEF          SSRC
// Then 160 bytes of µ-law samples (20 ms at 8000 Hz) as the opaque payload.
const rtpHeader = [
  0x80, 0x00, 0x1a, 0x2b, 0x00, 0x01, 0x5f, 0x90, 0xde, 0xad, 0xbe, 0xef,
];
const muLawPayload = new Array(160).fill(0xff); // 20 ms of G.711 µ-law samples

describe('RTP dissection', () => {
  const reg = new ProtocolRegistry();
  reg.register(rtp);

  it('parses the fixed 12-byte header', () => {
    const node = dissect([...rtpHeader, ...muLawPayload], 'rtp', reg);
    const h = node.header;
    expect(h.byteLength).toBe(12);
    expect(h.get('version')).toBe(2);
    expect(h.get('padding')).toBe(0);
    expect(h.get('extension')).toBe(0);
    expect(h.get('csrcCount')).toBe(0);
    expect(h.get('marker')).toBe(0);
    expect(h.get('payloadType')).toBe(0); // PCMU
    expect(h.get('sequenceNumber')).toBe(6699);
    expect(h.get('timestamp')).toBe(90000);
  });

  it('shows SSRC as a 32-bit hex identifier', () => {
    const node = dissect([...rtpHeader, ...muLawPayload], 'rtp', reg);
    const ssrc = node.header.fields.find((f) => f.field.name === 'ssrc')!;
    expect(ssrc.display).toBe('0xDEADBEEF');
  });

  it('decodes payload type 0 as PCMU via the RFC 3551 static map', () => {
    const node = dissect([...rtpHeader, ...muLawPayload], 'rtp', reg);
    const pt = node.header.fields.find((f) => f.field.name === 'payloadType')!;
    expect(pt.meaning).toContain('PCMU');
  });

  it('leaves the codec media as an opaque payload (no child protocol)', () => {
    const node = dissect([...rtpHeader, ...muLawPayload], 'rtp', reg);
    expect(node.payload.length).toBe(160);
    expect(node.child).toBeNull();
  });

  it('consumes a CSRC list (CC>0) into the header so it does not leak into payload', () => {
    // CC=2: first byte becomes 0x82; two 32-bit CSRC ids follow the fixed header.
    const withCsrc = [
      0x82, 0x00, 0x1a, 0x2b, 0x00, 0x01, 0x5f, 0x90, 0xde, 0xad, 0xbe, 0xef,
      0x11, 0x11, 0x11, 0x11, 0x22, 0x22, 0x22, 0x22, // 2 CSRC ids
      ...muLawPayload,
    ];
    const node = dissect(withCsrc, 'rtp', reg);
    expect(node.header.get('csrcCount')).toBe(2);
    expect(node.header.byteLength).toBe(12 + 2 * 4); // 20 bytes
    expect(node.payload.length).toBe(160); // CSRC list did not leak in
  });
});
