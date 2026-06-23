import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { dtls } from '../src/protocols/dtls';

// A real DTLS 1.2 ClientHello record header (RFC 9147 §4 / RFC 6347 §4.1).
// This is the canonical first record of a DTLS handshake — epoch 0, sequence 0,
// carried in a single UDP datagram. Byte layout of the 13-byte DTLSPlaintext header:
//
//   0x16                          content type = 22 (handshake)
//   0xfe 0xfd                     legacy_record_version = 0xFEFD (DTLS 1.2)
//   0x00 0x00                     epoch = 0 (unencrypted initial flight)
//   0x00 0x00 0x00 0x00 0x00 0x00 sequence_number = 0 (48-bit, first record)
//   0x00 0x55                     length = 85 bytes of fragment follow
//   --- fragment (DTLS handshake message) begins ---
//   0x01                          msg_type = 1 (client_hello)
//   0x00 0x00 0x49                handshake body length = uint24 73
//   0x00 0x00                     message_seq = 0
//   0x00 0x00 0x00                fragment_offset = 0
//   0x00 0x00 0x49                fragment_length = uint24 73
//     -> 12-byte DTLS handshake header + 73 body = 85, matching record length.
//   0xfe 0xfd                     client_version (legacy) = DTLS 1.2 inside the body
const FRAGMENT_LEN = 0x55; // 85
const clientHello: number[] = [
  // 13-byte DTLSPlaintext record header
  0x16, 0xfe, 0xfd, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x55,
  // start of the handshake fragment (DTLS handshake header + client_version)
  0x01, 0x00, 0x00, 0x49, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x49, 0xfe, 0xfd,
  // pad the remainder of the declared 85-byte fragment so the payload is fully present
  ...new Array(FRAGMENT_LEN - 14).fill(0xab),
  // a SECOND record packed into the same UDP datagram — must NOT leak into payload
  0x16, 0xfe, 0xfd, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x02, 0xde, 0xad,
];

describe('DTLS record layer dissection', () => {
  const reg = new ProtocolRegistry();
  reg.register(dtls);

  it('parses the 13-byte DTLSPlaintext record header fields (RFC 9147 §4)', () => {
    const node = dissect(clientHello, 'dtls', reg);
    const h = node.header;
    expect(h.byteLength).toBe(13);
    expect(h.get('contentType')).toBe(22);
    expect(h.get('legacyVersion')).toBe(0xfefd);
    expect(h.get('epoch')).toBe(0);
    expect(h.get('length')).toBe(85);
  });

  it('reads the 48-bit (6-octet) sequence number', () => {
    const node = dissect(clientHello, 'dtls', reg);
    const seq = node.header.fields.find((f) => f.field.name === 'sequenceNumber')!;
    expect(seq.bits).toBe(48);
    // first record of the handshake: sequence number 0 within epoch 0
    expect(seq.value).toBe(0);
  });

  it('decodes a non-zero 48-bit sequence number big-endian', () => {
    // header layout: type(1) ver(2) epoch(2) seq(6, bytes 5..10) length(2, bytes 11..12).
    // Set the low two octets of the 6-byte sequence field to 0x01 0x02 => 0x0102 = 258.
    const frame = [...clientHello];
    frame[9] = 0x01;
    frame[10] = 0x02;
    const node = dissect(frame, 'dtls', reg);
    expect(node.header.get('sequenceNumber')).toBe(0x0102);
    expect(node.header.get('length')).toBe(85); // length (bytes 11..12) unchanged
    const seq = node.header.fields.find((f) => f.field.name === 'sequenceNumber')!;
    expect(seq.meaning).toBe('00 00 00 00 01 02 (record #258 in this epoch)');
  });

  it('formats the content type and DTLS version enums', () => {
    const node = dissect(clientHello, 'dtls', reg);
    const ct = node.header.fields.find((f) => f.field.name === 'contentType')!;
    const ver = node.header.fields.find((f) => f.field.name === 'legacyVersion')!;
    expect(ct.display).toBe('22 (handshake)');
    expect(ver.display).toBe('65277 (DTLS 1.2)'); // 0xFEFD = 65277
  });

  it('bounds the PDU to 13 + length so a second packed record does not leak into payload', () => {
    const node = dissect(clientHello, 'dtls', reg);
    // payload = the fragment only (85 bytes), header excluded
    expect(node.payload.length).toBe(85);
    // the trailing 15 bytes (next record header + body) are trailer, not payload
    expect(node.trailer.length).toBe(15);
    // the fragment starts with the handshake msg_type byte (client_hello = 0x01)
    expect(node.payload[0]).toBe(0x01);
  });

  it('stops dissecting: the fragment is opaque to this layer', () => {
    const node = dissect(clientHello, 'dtls', reg);
    expect(node.child).toBeNull();
  });
});
