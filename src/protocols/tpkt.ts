// TPKT — ISO Transport Service on top of the TCP. RFC 1006 ("ISO Transport
// Service on top of the TCP, Version 3"), section 6. Authoritative reference:
// https://www.rfc-editor.org/rfc/rfc1006
//
// TPKT is a tiny 4-byte framing header that lets the connection-oriented ISO
// transport protocol (COTP / ISO 8073 / ITU-T X.224) run over the TCP byte
// stream. Because TCP has no message boundaries, TPKT prepends a length so the
// receiver can find where each TPKT PDU (= one COTP TPDU) ends. It is used by
// the Siemens S7 industrial stack (TCP/102): TCP -> TPKT -> COTP -> S7comm.
//
// PACKET STRUCTURE (RFC 1006 §6)
// ------------------------------
//   byte 0:  vrsn      Version, always 3 for this RFC
//   byte 1:  reserved  Reserved, always 0
//   bytes 2-3: packet length (big-endian) — the length of the ENTIRE TPKT PDU
//             including these 4 header bytes (so the COTP+S7 payload length is
//             packet length - 4).
//
//     0                   1                   2                   3
//     +-----------+-----------+-------------------------------+
//     |  vrsn (3) | reserved  |        packet length          |
//     +-----------+-----------+-------------------------------+
//     |                  TPKT user data (a COTP TPDU)         |
//     +------------------------------------------------------ +
//
// ENDIANNESS: the 2-byte length is big-endian (network order). The header is a
// fixed 4 bytes; its child is always COTP, so next() returns 'cotp'.
import type { ProtocolSpec, BuildCtx } from '../core/types';

export const tpkt: ProtocolSpec = {
  id: 'tpkt',
  name: 'TPKT',
  layer: 5,
  summary:
    'A 4-byte framing header (RFC 1006) that carries an ISO transport TPDU over the TCP byte stream. It is version (=3), a reserved byte (=0), and a 2-byte total length including the header. It lets the COTP/S7 industrial stack (TCP/102) mark message boundaries on a stream that has none. Its payload is always a COTP TPDU.',
  fields: [
    {
      name: 'version',
      label: 'Version',
      bits: 8,
      decode: (v) => (v === 3 ? '3 (RFC 1006)' : `${v} (expected 3)`),
      desc: 'The TPKT version. RFC 1006 defines version 3, and this byte is always 0x03 on the wire; any other value means the stream is not RFC 1006 TPKT.',
      detail: `VERSION (1 byte, RFC 1006 §6):
- Always 3 for "ISO Transport Service on top of the TCP, Version 3" — the only version in use.
- A receiver that does not see 0x03 in the first byte of a TCP/102 stream is not talking TPKT and should drop the connection.`,
    },
    {
      name: 'reserved',
      label: 'Reserved',
      bits: 8,
      decode: (v) => (v === 0 ? '0' : `${v} (expected 0)`),
      desc: 'A reserved byte that is always 0x00. It pads the header out so the 2-byte length field lands on a 16-bit boundary.',
      detail: `RESERVED (1 byte, RFC 1006 §6):
- Defined as reserved and set to 0. It exists only to byte-align the following 16-bit length field.`,
    },
    {
      name: 'length',
      label: 'Packet length',
      bits: 16,
      decode: (v) => `${v} bytes (incl. 4-byte TPKT header; ${v - 4}-byte COTP payload)`,
      desc: 'The total length of the whole TPKT PDU in bytes, INCLUDING these 4 header bytes. The receiver uses it to find where this message ends in the TCP byte stream, so the next message in a coalesced stream cannot leak in.',
      detail: `PACKET LENGTH (2 bytes, big-endian, RFC 1006 §6):
- "Packet length, including this header (max 65535 bytes)." It counts the 4 TPKT header bytes plus the encapsulated COTP TPDU and everything inside it.
- Because TCP delivers a boundary-less byte stream, this is the only way a peer knows where one TPKT PDU ends and the next begins. Apex uses it as pduBytes so trailing bytes of a coalesced stream are clipped as trailer, not folded into the COTP payload.
- The COTP TPDU that follows therefore occupies (packet length - 4) bytes.`,
    },
  ],
  // Fixed 4-byte header.
  headerBytes: () => 4,
  // The length field bounds the whole PDU (header + COTP TPDU), so a coalesced
  // TCP stream's following frame is clipped off as trailer.
  pduBytes: (h) => h.get('length'),
  // TPKT always wraps an ISO transport (COTP) TPDU.
  next: () => 'cotp',
  // Build a TPKT header for a given payload (the COTP TPDU). The length is the
  // payload length plus the 4-byte header.
  encode: ({ payload }: BuildCtx) => {
    const len = payload.length + 4;
    return [0x03, 0x00, (len >> 8) & 0xff, len & 0xff];
  },
};
