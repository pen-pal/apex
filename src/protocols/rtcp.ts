// RTCP — RTP Control Protocol common header. RFC 3550 §6.4 (Sender/Receiver
// Reports) and §6.1 (the header fields shared by every RTCP packet type). RTCP
// is RTP's out-of-band control channel: it carries reception-quality feedback,
// source descriptions, and membership (join/leave) information for an RTP
// session. It runs over UDP, conventionally on the odd port one above the even
// RTP media port (RTP port + 1), or multiplexed onto the same 5-tuple as RTP
// (RFC 5761 rtcp-mux), distinguished from RTP by its packet-type byte.
//
// THE COMMON HEADER (RFC 3550 §6.4.1), big-endian. Every RTCP packet — SR, RR,
// SDES, BYE, APP — starts with these same first 4 bytes:
//
//    0                   1                   2                   3
//    0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
//   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//   |V=2|P|    RC   |   PT=SR=200   |             length            |
//   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//   |                         SSRC of sender                        |  <- body
//   +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+
//   |              NTP timestamp, RTP timestamp, ...                |  (SR-specific)
//
// WHAT THIS SPEC MODELS, AND WHAT IT DOES NOT
// -------------------------------------------
// We transcribe the 4-byte COMMON header exactly: V, P, RC/SC, PT, length. The
// type-specific body that follows — for a Sender Report: the 32-bit SSRC of the
// sender, the 20-byte sender-info block (NTP/RTP timestamps, packet/octet
// counts), then RC reception-report blocks of 24 bytes each; for SDES: chunks of
// items; for BYE: a list of SSRCs; for APP: a name + opaque data — is NOT split
// into fixed fields here, because its shape depends on PT and RC and would lie
// about the wire if hardcoded. It falls into node.payload, bounded by `length`.
// Note also that real RTCP packets are usually COMPOUND (e.g. an SR followed by
// an SDES in one UDP datagram, RFC 3550 §6.1); `length` bounds only the FIRST
// sub-packet, and the next one begins right after it.
import type { ProtocolSpec } from '../core/types';

// RFC 3550 §12.1 + registered extensions — the PT byte identifies the packet.
const PACKET_TYPE: Record<number, string> = {
  200: 'SR (Sender Report)',
  201: 'RR (Receiver Report)',
  202: 'SDES (Source Description)',
  203: 'BYE (Goodbye)',
  204: 'APP (Application-Defined)',
  205: 'RTPFB (Transport-layer FB, RFC 4585)',
  206: 'PSFB (Payload-specific FB, RFC 4585)',
  207: 'XR (Extended Report, RFC 3611)',
};

export const rtcp: ProtocolSpec = {
  id: 'rtcp',
  name: 'RTCP',
  layer: 7,
  summary:
    'The RTP Control Protocol (RFC 3550 §6): RTP\'s feedback channel. Every RTCP packet starts with a 4-byte common header — version, padding, a report/source count, an 8-bit packet type (200=SR, 201=RR, 202=SDES, 203=BYE, 204=APP), and a length in 32-bit words minus one. It reports reception quality and identifies/retires sources so endpoints can adapt rate and keep streams in sync.',
  fields: [
    {
      name: 'version',
      label: 'Version',
      bits: 2,
      note: 'Always 2 for RFC 3550 RTCP — the same version space as RTP.',
      desc: 'The 2-bit version, identical to the RTP version field. The value 2 identifies RFC 3550; it occupies the top two bits of the first byte, so an SR\'s first octet is 0x80 (V=2, P=0, RC=0).',
      detail: `VERSION (2 bits, RFC 3550 §6.4.1): "identifies the version of RTP, which is the same in RTCP packets as in RTP data packets. The version defined by this specification is two (2)."

SHARED WITH RTP: RTCP deliberately reuses RTP's version numbering and leading-bit layout so a demultiplexer on a shared port (RFC 5761 rtcp-mux, or WebRTC) can use the same V=2 test — the first byte of both RTP and RTCP falls in 0x80-0xBF.

DISTINGUISHING RTP FROM RTCP: when multiplexed, the PACKET TYPE byte (this header's second octet, 200-207) is what separates RTCP from RTP; those values are deliberately kept out of the RTP payload-type range used on the same port.

BIT POSITION: the most-significant two bits of octet 0.`,
    },
    {
      name: 'padding',
      label: 'Padding (P)',
      bits: 1,
      type: 'flags',
      flagBits: ['P'],
      note: 'If set, the last octet of this RTCP packet gives the number of trailing padding bytes to ignore (often for encryption block alignment).',
      desc: 'The padding bit. When set, this RTCP packet ends with padding octets that are not part of the control information; the last octet of the packet counts them, including itself, so the receiver can strip them.',
      detail: `PADDING (1 bit, RFC 3550 §6.4.1): "If the padding bit is set, this RTCP packet contains some additional padding octets at the end which are not part of the control information but are included in the length field. The last octet of the padding is a count of how many padding octets should be ignored, including itself."

WHERE IT GOES IN A COMPOUND PACKET: "padding should only be required on the last individual packet because the compound packet is encrypted as a whole" — so in a compound RTCP datagram only the final sub-packet carries P=1.

WHY PAD: to align the (often encrypted) compound packet to a cipher block boundary.

BOUNDED BY LENGTH: unlike RTP, the padding here IS included in this packet's length field, so the dissector's PDU bound already covers it; the padding bytes sit at the tail of node.payload along with the rest of the type-specific body.`,
    },
    {
      name: 'reportCount',
      label: 'Reception report count (RC)',
      bits: 5,
      decode: (v, h) => {
        const pt = h.get('packetType');
        if (pt === 202 || pt === 203) return `${v} (SC — source count)`;
        if (pt === 204) return `${v} (subtype — APP-defined)`;
        return v === 0
          ? '0 (no reception reports — e.g. a sender with no incoming stream)'
          : `${v} reception report block(s) of 24 bytes follow the body`;
      },
      note: 'For SR/RR: number of 24-byte reception-report blocks. For SDES/BYE this same field is SC (source count); for APP it is a 5-bit subtype.',
      desc: 'A 5-bit count whose meaning depends on the packet type. For Sender/Receiver Reports it is RC: the number of reception-report blocks that follow. For SDES and BYE the same five bits are SC, the number of sources described. For APP they are an application-defined subtype.',
      detail: `RECEPTION REPORT COUNT (5 bits, RFC 3550 §6.4.1): for SR (200) and RR (201) this is "the number of reception report blocks contained in this packet. A value of zero is valid."

EACH REPORT BLOCK is 24 bytes (RFC 3550 §6.4.1): SSRC of the reported source, fraction lost, cumulative packets lost, extended highest sequence number received, interarrival jitter, last SR timestamp (LSR), and delay since last SR (DLSR). With 5 bits, at most 31 blocks fit in one report; more sources are split across multiple RR packets.

SAME BITS, OTHER PACKET TYPES:
- SDES (202) / BYE (203): these five bits are the SOURCE COUNT (SC) — the number of SSRC/CSRC chunks (SDES) or SSRCs (BYE) that follow.
- APP (204): these five bits are a SUBTYPE, used to let one APP name define several formats.

WHY IT MATTERS HERE: the body that follows the common header is RC (or SC) repetitions of a per-source structure, so this count is what tells the body parser how many to read. This spec surfaces the count but leaves the variable body in node.payload.`,
    },
    {
      name: 'packetType',
      label: 'Packet type (PT)',
      bits: 8,
      type: 'enum',
      enumMap: PACKET_TYPE,
      decode: (v) => (PACKET_TYPE[v] ? `${v} (${PACKET_TYPE[v]})` : `${v}`),
      note: '200=SR, 201=RR, 202=SDES, 203=BYE, 204=APP. Also 205/206=RTP/PS feedback (RFC 4585), 207=XR (RFC 3611).',
      desc: 'The 8-bit packet type names the RTCP message: 200 Sender Report, 201 Receiver Report, 202 Source Description, 203 Goodbye, 204 Application-Defined. It both selects how the body is parsed and lets a shared-port demultiplexer tell RTCP from RTP.',
      detail: `PACKET TYPE (8 bits, RFC 3550 §6.4.1 and the IANA RTCP control-packet registry):
- 200 SR  — Sender Report: a source that is itself sending media reports its own send stats plus reception reports for streams it receives.
- 201 RR  — Receiver Report: a participant that only receives reports reception quality (no sender-info block).
- 202 SDES — Source Description: human-readable source metadata (CNAME canonical name, NAME, EMAIL, ...).
- 203 BYE — Goodbye: a source announces it is leaving the session; receivers can free its state.
- 204 APP — Application-Defined: experimental/app-specific data, keyed by a 4-byte ASCII name.

EXTENSIONS commonly seen on the wire: 205 RTPFB and 206 PSFB (feedback, RFC 4585 — e.g. NACK, PLI for video), 207 XR (extended reports, RFC 3611).

8-BIT, NOT 7: note RTCP's packet type is a full 8 bits, whereas RTP's payload type is 7 bits with the marker bit above it. The RTCP values (200-207) are chosen to be unambiguous against RTP payload types when the two share a UDP port.`,
    },
    {
      name: 'length',
      label: 'Length',
      bits: 16,
      decode: (v) => `${v} (= ${(v + 1) * 4} bytes incl. header${v === 0 ? '' : ' & body'})`,
      note: 'Length of this RTCP packet in 32-bit words MINUS ONE, including the header and any padding. A minimal 8-byte packet has length=1.',
      desc: 'The length of this RTCP packet measured in 32-bit words, minus one, counting the common header and any padding. Multiply by four and add four to get the byte length. Subtracting one lets a zero-length (header-only) packet be expressed, and makes a value of 0 mean "4 bytes."',
      detail: `LENGTH (16 bits, RFC 3550 §6.4.1): "The length of this RTCP packet in 32-bit words minus one, including the header and any padding. (The offset of one makes zero a valid length and avoids a possible infinite loop in scanning a compound RTCP packet, while counting 32-bit words avoids a validity check for a multiple of 4.)"

CONVERTING TO BYTES: byteLength = (length + 1) * 4. A minimal empty packet (just the 4-byte header + a 4-byte SSRC, e.g. an RR with RC=0) has length = 1, i.e. 8 bytes. An SR with no report blocks is 28 bytes -> length = 6.

BOUNDS THE PDU: this dissector uses (length+1)*4 to stop this RTCP packet exactly, so in a COMPOUND datagram (SR + SDES + ... in one UDP payload, RFC 3550 §6.1) the bytes after this packet belong to the NEXT sub-packet, not to this one's body. Here those following bytes — both this packet's type-specific body and any subsequent sub-packets — appear as node.payload; the body parser would use RC/SC and the per-type layout to split them.

WHY 32-BIT WORDS: RTCP packets are always a multiple of 4 bytes, so expressing length in words both saves a bit and lets the receiver assert 4-byte alignment for free.

ENDIANNESS: 16-bit big-endian (network order).`,
    },
  ],
  // The common header is a fixed 4 bytes (V/P/RC + PT + length).
  headerBytes: () => 4,
  // The Length field bounds this (sub-)packet: (length + 1) * 32-bit words.
  // The type-specific body (SSRC, sender info, report blocks, ...) and any
  // following sub-packets of a compound datagram fall into node.payload.
  pduBytes: (h) => (h.get('length') + 1) * 4,
  // The body is type-specific (and often compound), not a separately-registered
  // protocol, so dissection stops here and the body bytes are node.payload.
  next: () => null,
};
