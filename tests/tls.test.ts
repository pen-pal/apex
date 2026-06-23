import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { tls } from '../src/protocols/tls';

// A real TLS ClientHello record header followed by the start of its fragment.
// Byte layout (RFC 8446 §5.1 record + §4 handshake):
//   0x16             content type = 22 (handshake)
//   0x03 0x01        legacy_record_version = 0x0301 (TLS 1.0) — the value
//                    RFC 8446 SHOULD-uses on the very first ClientHello record
//   0x00 0xa5        length = 165 bytes of fragment follow
//   --- fragment (handshake message) begins ---
//   0x01             HandshakeType = 1 (client_hello)
//   0x00 0x00 0xa1   handshake body length = uint24 161  (== 165 - 4, the 4
//                    being the handshake type + 24-bit length header). Internally
//                    consistent, confirming our record length is correct.
//   0x03 0x03        client_version (legacy) = TLS 1.2 inside the handshake
// This is the canonical ClientHello framing seen in any TLS 1.2/1.3 capture.
const FRAGMENT_LEN = 0xa5; // 165
const clientHello: number[] = [
  0x16, 0x03, 0x01, 0x00, 0xa5, // 5-byte record header
  0x01, 0x00, 0x00, 0xa1, 0x03, 0x03, // start of the handshake fragment
  // pad the rest of the declared fragment so the payload is fully present,
  // then add 7 extra "next record / TCP" bytes that must NOT leak into payload.
  ...new Array(FRAGMENT_LEN - 6).fill(0xab),
  0x17, 0x03, 0x03, 0x00, 0x02, 0xde, 0xad, // a following application_data record header + 2 body bytes
];

describe('TLS record layer dissection', () => {
  const reg = new ProtocolRegistry();
  reg.register(tls);

  it('parses the 5-byte record header fields (RFC 8446 §5.1)', () => {
    const node = dissect(clientHello, 'tls', reg);
    const h = node.header;
    expect(h.byteLength).toBe(5);
    expect(h.get('contentType')).toBe(22);
    expect(h.get('legacyVersion')).toBe(0x0301);
    expect(h.get('length')).toBe(165);
  });

  it('formats the content type and version enums', () => {
    const node = dissect(clientHello, 'tls', reg);
    const ct = node.header.fields.find((f) => f.field.name === 'contentType')!;
    const ver = node.header.fields.find((f) => f.field.name === 'legacyVersion')!;
    expect(ct.display).toBe('22 (handshake)');
    expect(ver.display).toBe('769 (TLS 1.0)'); // 0x0301 = 769
  });

  it('bounds the PDU to 5 + length so the next record does not leak into payload', () => {
    const node = dissect(clientHello, 'tls', reg);
    // payload = the fragment only (165 bytes), header excluded
    expect(node.payload.length).toBe(165);
    // the trailing 7 bytes (next record header + body) are trailer, not payload
    expect(node.trailer.length).toBe(7);
    // the fragment starts with the handshake type byte (client_hello = 0x01)
    expect(node.payload[0]).toBe(0x01);
  });

  it('stops dissecting: the fragment is opaque to this layer', () => {
    const node = dissect(clientHello, 'tls', reg);
    expect(node.child).toBeNull();
  });
});
