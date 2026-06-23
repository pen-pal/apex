// RDP framing — TPKT (ISO Transport Service on top of TCP).
// RFC 1006 (ISO Transport Service on top of the TCP, Version 3) defines the
// 4-byte TPKT header. RDP (the Remote Desktop Protocol) uses TPKT as its outer
// framing on TCP port 3389; the connection sequence is specified in
// [MS-RDPBCGR] (Remote Desktop Protocol: Basic Connectivity and Graphics
// Remoting). Inside each TPKT packet sits an ITU-T X.224 (ISO 8073) Class 0
// transport PDU, and inside that the actual RDP data.
//
// WHY ONLY THE TPKT HEADER IS A BIT-GRID HERE
// -------------------------------------------
// TPKT (RFC 1006 §6) is a clean fixed 4-byte binary header — exactly the kind of
// structure Apex models as a Field[]:
//
//   +--------+--------+----------------+
//   | vrsn=3 | rsvd=0 |  length (16)   |
//   +--------+--------+----------------+
//      8 b      8 b         16 b
//
//   * version  (8 bits): always 3 for this protocol version (RFC 1006 §6).
//   * reserved (8 bits): always 0.
//   * length   (16 bits, big-endian): length of the ENTIRE packet in octets,
//     INCLUDING this 4-byte header. Minimum 7, maximum 65535. This is what
//     delimits one RDP PDU on the byte stream, so it bounds the whole PDU.
//
// WHAT FOLLOWS (carried as this layer's payload, not dissected here)
// ------------------------------------------------------------------
// After the TPKT header comes an X.224 / ISO 8073 Class 0 TPDU. For the very
// first packet of an RDP session — the Client X.224 Connection Request
// ([MS-RDPBCGR] §2.2.1.1) — that TPDU is 7 fixed bytes:
//
//   x224Crq (7 bytes):
//     LI  (1 byte)  — Length Indicator: number of octets in the rest of the
//                     TPDU header AFTER this LI byte (i.e. it does NOT count
//                     itself, and does NOT count the TPKT header). For a CR it
//                     also covers any trailing routingToken / cookie / rdpNegReq.
//     code(1 byte)  — X.224 TPDU code. 0xE0 = Connection Request (CR) with
//                     CDT=0 (ITU-T X.224 §13.3). Related codes: 0xD0 = CC
//                     (Connection Confirm), 0xF0 = DT (Data).
//     dst-ref (2 bytes) — destination reference, 0x0000 in a CR.
//     src-ref (2 bytes) — source reference.
//     class option (1 byte) — class/options; 0x00 = Class 0.
//
// A real client then appends an optional cookie ("Cookie: mstshash=<user>\r\n")
// and an 8-byte RDP Negotiation Request, all counted by the X.224 LI. Those are
// variable / text, so we do not model them as bit-fields; they fall through as
// payload and are visible as raw bytes in the byte view. Dissection stops at the
// TPKT layer (next => null) because the X.224 + RDP content above it is its own
// (largely variable, later encrypted) structure.
import type { ProtocolSpec } from '../core/types';

export const rdp: ProtocolSpec = {
  id: 'rdp',
  name: 'RDP (TPKT)',
  layer: 7,
  summary:
    'Remote Desktop framing over TCP/3389. Each RDP PDU is wrapped in a 4-byte TPKT header (RFC 1006): version=3, a reserved 0 byte, and a 16-bit total length that delimits the packet on the stream. Inside sits an X.224 Class 0 transport PDU and then the RDP data, carried here as the payload.',
  fields: [
    {
      name: 'version', label: 'Version', bits: 8,
      decode: (v) => (v === 3 ? '3 (TPKT, RFC 1006)' : `${v} (unexpected — TPKT requires 3)`),
      note: 'Always 3 for TPKT.',
      desc: 'The TPKT version. RFC 1006 fixes this to 3; a receiver uses it to recognise that what follows is a TPKT-framed packet (and not, say, a raw X.224 PDU over a real OSI stack).',
      detail: `VERSION (8 bits) = 3 (RFC 1006 §6, "ISO Transport Service on top of the TCP, Version 3").

TPKT exists because ISO transport (X.224) was designed to run over a reliable connection-mode network service, not directly over a byte stream like TCP. RFC 1006 inserts this tiny 4-byte shim so an X.224 implementation can run unchanged on top of TCP: the shim turns TCP's undelimited byte stream back into discrete, length-delimited packets.

The very first byte of every RDP PDU on the wire is therefore 0x03. Seeing 03 00 at the start of a TCP/3389 segment is the classic fingerprint of an RDP / TPKT connection.`,
    },
    {
      name: 'reserved', label: 'Reserved', bits: 8,
      note: 'Always 0.',
      desc: 'A reserved byte, defined by RFC 1006 to be 0. It pads the version up to a 16-bit boundary so the length field that follows is naturally aligned.',
      detail: `RESERVED (8 bits) = 0 (RFC 1006 §6).

It carries no information in this version of the protocol; senders set it to 0 and receivers ignore it. Its only real job is alignment — it makes the header a clean 4 bytes (version, reserved, length-hi, length-lo) so the 16-bit length is byte-pair aligned.`,
    },
    {
      name: 'length', label: 'Packet length', bits: 16, type: 'uint',
      decode: (v) => `${v} bytes total, including this 4-byte TPKT header`,
      note: 'Length of the entire packet in octets, INCLUDING the 4-byte header.',
      desc: 'The total length of this TPKT packet in octets, counting the 4-byte TPKT header itself plus everything it carries (the X.224 TPDU and the RDP data). Big-endian. This is what tells the receiver where one RDP PDU ends and the next begins inside the TCP byte stream.',
      detail: `PACKET LENGTH (16 bits, big-endian, RFC 1006 §6): the length of the ENTIRE packet in octets, INCLUDING the 4-byte TPKT header.
- Minimum 7 (4-byte TPKT header + at least a 3-byte X.224 PDU).
- Maximum 65535 (a single 16-bit field), giving a max TPDU of 65531 octets.

WHY IT MATTERS: TCP delivers an undelimited byte stream — a single read() may return half a PDU or several PDUs glued together. The TPKT length is the framing that re-imposes message boundaries: read 4 bytes, learn the length, read (length - 4) more bytes, and you have exactly one complete X.224/RDP PDU. This is why Apex uses it as the PDU bound (pduBytes), so trailing bytes from the next PDU don't leak into this one's payload.

EXAMPLE: 0x002C = 44 bytes — a 4-byte TPKT header followed by a 40-byte X.224 Connection Request (the 7-byte CR TPDU plus an optional cookie and 8-byte RDP Negotiation Request).`,
    },
  ],
  // Fixed 4-byte header (RFC 1006 §6).
  headerBytes: () => 4,
  // The 16-bit length counts the whole packet including this header, so it bounds
  // the PDU and keeps a following pipelined PDU out of this one's payload.
  pduBytes: (h) => h.get('length'),
  // What follows is an X.224 Class 0 TPDU and then the RDP content. That structure
  // is variable (and, after the handshake, encrypted), so we stop here and let the
  // X.224 + RDP bytes appear as this layer's payload.
  next: () => null,
};
