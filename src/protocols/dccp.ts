// DCCP — Datagram Congestion Control Protocol. RFC 4340 (March 2006),
// "Datagram Congestion Control Protocol (DCCP)". DCCP is a transport-layer
// protocol that provides a congestion-controlled, UNRELIABLE flow of datagrams
// — think "UDP with congestion control and connection setup/teardown, but no
// retransmission". It is carried directly in IP as IP Protocol Number 33
// (IANA "Protocol Numbers" registry; see RFC 4340 §19).
//
// WHAT THIS SPEC MODELS
// ---------------------
// This spec transcribes the DCCP GENERIC HEADER, SHORT-SEQUENCE-NUMBER form
// (X = 0), which is exactly 12 bytes (RFC 4340 §5.1). The diagram:
//
//    0                   1                   2                   3
//    0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
//   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//   |          Source Port          |           Dest Port           |
//   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//   |  Data Offset  | CCVal | CsCov |           Checksum            |
//   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//   |     |       |X|                                               |
//   | Res | Type  |=|          Sequence Number (low bits)           |
//   |     |       |0|                                               |
//   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//
// IMPORTANT — there is NO 8-bit Reserved field after the X bit in the short
// form. After Res(3)+Type(4)+X(1) (byte 8) the 24-bit Sequence Number follows
// immediately (bytes 9-11), for a total of exactly 12 bytes. (The EXTENDED form,
// X = 1, is 16 bytes: it inserts a 16-bit Reserved + a 48-bit sequence number
// instead. This spec models the short form.)
//
// WHAT FOLLOWS THE GENERIC HEADER (not modelled as fixed fields here)
// ------------------------------------------------------------------
// Most packet types carry an additional fixed subheader and then options before
// the application data: e.g. a DCCP-Request adds a 4-byte Service Code; an
// Acknowledging packet adds an 8-byte (short) Acknowledgement Number subheader.
// Those subheaders and the options are variable/type-specific, so they are not a
// fixed bit grid and fall through as node.payload, bounded by Data Offset. The
// application data area itself begins at (Data Offset * 4) bytes from the start
// of the DCCP header. We expose Data Offset via headerBytes() so the byte view
// colours exactly the bytes up to the application data, and stop dissecting
// (next => null): the payload is unreliable application datagrams with no
// generic child protocol.
import type { ProtocolSpec, ParsedHeader } from '../core/types';

// RFC 4340 §5.1, Table: DCCP packet Type codes (4-bit field).
const TYPE: Record<number, string> = {
  0: 'DCCP-Request',
  1: 'DCCP-Response',
  2: 'DCCP-Data',
  3: 'DCCP-Ack',
  4: 'DCCP-DataAck',
  5: 'DCCP-CloseReq',
  6: 'DCCP-Close',
  7: 'DCCP-Reset',
  8: 'DCCP-Sync',
  9: 'DCCP-SyncAck',
  10: 'Reserved',
  11: 'Reserved',
  12: 'Reserved',
  13: 'Reserved',
  14: 'Reserved',
  15: 'Reserved',
};

export const dccp: ProtocolSpec = {
  id: 'dccp',
  name: 'DCCP',
  layer: 4,
  summary:
    'Datagram Congestion Control Protocol (RFC 4340), IP protocol 33: a transport that gives UDP-style unreliable datagrams a TCP-style connection and congestion control, but no retransmission. This is the 12-byte generic header, short-sequence-number form (X=0): ports, a Data Offset to the application data, a packet Type, and a 24-bit sequence number.',
  fields: [
    {
      name: 'srcPort',
      label: 'Source port',
      bits: 16,
      note: 'Sending application port.',
      desc: 'The 16-bit port of the sending application. Together with the source/destination IP addresses and the destination port it identifies the DCCP connection.',
      detail: `SOURCE PORT (16 bits, RFC 4340 §5.1): the port the sender's DCCP application is bound to. DCCP ports share the same number space concept as TCP/UDP ports (a 16-bit value, 0-65535) but live in DCCP's own IANA registry — a DCCP service on port N is distinct from a TCP or UDP service on port N because the IP Protocol field (33 for DCCP) selects the protocol first.

A DCCP connection is named by the 4-tuple (source IP, source port, destination IP, destination port), exactly like TCP.`,
    },
    {
      name: 'dstPort',
      label: 'Destination port',
      bits: 16,
      note: 'Receiving application port.',
      desc: 'The 16-bit port of the receiving application — which service on the destination host this packet is for.',
      detail: `DESTINATION PORT (16 bits, RFC 4340 §5.1): selects the listening DCCP application on the destination host. A DCCP-Request carries the port of the service the client wants to reach; the server demultiplexes incoming packets by this port (plus the connection 4-tuple).

Because DCCP is intended for media/streaming-style flows (video, online games, VoIP), well-known DCCP ports are typically registered alongside the application's existing TCP/UDP ports.`,
    },
    {
      name: 'dataOffset',
      label: 'Data offset',
      bits: 8,
      decode: (v) => `application data starts ${v * 4} bytes in (${v} x 32-bit words)`,
      note: 'Header length to the application data, in 32-bit words.',
      desc: 'The offset, in 32-bit words, from the start of the DCCP header to the start of the application data. It accounts for the generic header plus any type-specific subheader and options, so the receiver knows where the payload begins.',
      detail: `DATA OFFSET (8 bits, RFC 4340 §5.1): "the offset from the start of the packet's DCCP header to the start of its application data area, in 32-bit words." Multiply by 4 to get bytes.

WHY IT EXISTS: unlike a fixed-size header, a DCCP packet's header region is variable — it is the generic header (12 bytes here for X=0) PLUS a type-specific subheader (e.g. +4 bytes Service Code for a Request, +8 for a short Acknowledgement Number) PLUS a variable run of options. Data Offset is the single field that tells the receiver where all of that ends and the application data begins. (Analogous to TCP's 4-bit Data Offset, but 8 bits wide and counting from the very start of the DCCP header.)

EXAMPLE: a DCCP-Request with no options has a 12-byte generic header + 4-byte Service Code = 16 bytes = 4 words, so Data Offset = 4.`,
    },
    {
      name: 'ccval',
      label: 'CCVal',
      bits: 4,
      note: 'Up to 4 bits used by the sender CCID.',
      desc: 'A 4-bit field used by the HC-Sender congestion control mechanism (the CCID) to carry up to 4 bits of per-packet congestion-control information. Its meaning is defined by the negotiated CCID, not by the core protocol.',
      detail: `CCVAL (4 bits, RFC 4340 §5.1): "used by the HC-Sender CCID for storing up to 4 bits of information." The interpretation depends entirely on the Congestion Control ID negotiated for the half-connection:
- CCID 2 (TCP-like, RFC 4341): CCVal is generally unused.
- CCID 3 (TFRC, TCP-Friendly Rate Control, RFC 4342): used as part of the sender's rate/loss signalling.

CCIDs are DCCP's pluggable congestion-control modules: the two endpoints negotiate which CCID governs each direction during connection setup, and CCVal is the per-packet channel that CCID gets in the fixed header.`,
    },
    {
      name: 'cscov',
      label: 'Checksum coverage',
      bits: 4,
      decode: (v) =>
        v === 0
          ? '0 = checksum covers the whole DCCP packet (header + all data)'
          : `${v} = checksum covers header + options + ${(v - 1) * 4} bytes of data`,
      note: 'How much of the application data the Checksum covers (0 = all).',
      desc: 'Determines how much of the application data is protected by the Checksum. The header and options are always covered; CsCov lets a sender leave some or all of the payload unchecked, so a slightly corrupted media frame can still be delivered instead of dropped.',
      detail: `CHECKSUM COVERAGE / CsCov (4 bits, RFC 4340 §9.2):
- 0  => the Checksum covers the entire DCCP packet (header, options, AND all application data) — the conservative default, like UDP/TCP.
- 1  => covers the DCCP header and options only; NO application data is checksummed.
- N (2-15) => covers the header, options, and the first (N-1) * 4 bytes of application data.

WHY PARTIAL CHECKSUMS: DCCP targets real-time media. For a codec that can conceal small bit errors, dropping a whole packet because of one flipped bit in the payload is worse than delivering the slightly-damaged frame. CsCov lets the application protect the parts it needs intact (header/options always; maybe a frame header) while tolerating errors in the rest — provided lower layers (e.g. UDP-Lite-style link adaptation) also honour partial coverage.`,
    },
    {
      name: 'checksum',
      label: 'Checksum',
      bits: 16,
      type: 'hex',
      note: "Internet checksum over a pseudo-header + the bytes CsCov covers.",
      desc: "The Internet (one's-complement) checksum, computed over an IP pseudo-header, the DCCP header, options, and the portion of the application data selected by CsCov. Unlike UDP, the DCCP checksum is mandatory.",
      detail: `CHECKSUM (16 bits, RFC 4340 §9): the standard Internet checksum (RFC 1071), computed over:
  1. an IP pseudo-header (source/destination IP, protocol = 33, DCCP length), exactly like TCP/UDP;
  2. the DCCP header and all options;
  3. the application data selected by CsCov (all of it when CsCov = 0).

MANDATORY: unlike UDP (where the checksum is optional over IPv4), DCCP ALWAYS carries a checksum — the field is never 0-as-"disabled". CsCov instead controls how much of the data is included.

The checksum is set to 0 during computation, the one's-complement 16-bit sum is folded, and the complement is stored here. A receiver recomputes over the same span; the partial-coverage case requires the receiver to honour the same CsCov.`,
    },
    {
      name: 'res',
      label: 'Reserved',
      bits: 3,
      note: 'Reserved; senders MUST set to 0.',
      desc: 'Three reserved bits at the top of byte 8. Senders MUST set them to zero and receivers ignore them; they exist to byte-align the Type and X fields.',
      detail: `RES (3 bits, RFC 4340 §5.1): reserved. Per RFC 4340, senders MUST set reserved bitfields to 0 and receivers MUST ignore them (they are not an error if non-zero — this keeps the format extensible). These 3 bits sit above the 4-bit Type and the 1-bit X within byte 8 (bits, MSB-first: Res Res Res Type Type Type Type X).`,
    },
    {
      name: 'type',
      label: 'Type',
      bits: 4,
      type: 'enum',
      enumMap: TYPE,
      note: 'Which kind of DCCP packet (Request, Data, Ack, Close, …).',
      desc: 'The 4-bit packet type. It names the role of the packet in the connection: DCCP-Request/Response set up a connection, DCCP-Data/Ack/DataAck carry data and acknowledgements, and DCCP-CloseReq/Close/Reset/Sync/SyncAck manage teardown and resynchronisation.',
      detail: `TYPE (4 bits, RFC 4340 §5.1). Defined values:
0  DCCP-Request   — client -> server, opens a connection (carries a Service Code)
1  DCCP-Response  — server -> client, second leg of the handshake
2  DCCP-Data      — pure application data, no acknowledgement number
3  DCCP-Ack       — pure acknowledgement, no data
4  DCCP-DataAck   — data PLUS an acknowledgement (piggybacked)
5  DCCP-CloseReq  — server asks the client to close
6  DCCP-Close     — initiates connection teardown
7  DCCP-Reset     — abnormal/normal connection termination (carries a Reset Code)
8  DCCP-Sync      — resynchronise sequence numbers (e.g. after a burst of loss)
9  DCCP-SyncAck   — response to a DCCP-Sync
10-15 Reserved

CONNECTION SETUP differs from TCP's 3-way handshake: Request -> Response -> Ack, where the Response already validates the connection and the third packet (an Ack, often carrying data) completes it. The Type drives which additional subheader fields (Service Code, Acknowledgement Number, Reset Code) follow the generic header.`,
    },
    {
      name: 'x',
      label: 'Extended seq (X)',
      bits: 1,
      decode: (v) =>
        v === 0
          ? '0 = short form: 24-bit sequence numbers, 12-byte generic header'
          : '1 = extended form: 48-bit sequence numbers, 16-byte generic header',
      note: 'Extended sequence numbers bit. 0 = short (this form), 1 = 48-bit.',
      desc: 'The Extended Sequence Numbers bit. When 0 (this form), sequence and acknowledgement numbers are 24 bits and the generic header is 12 bytes. When 1, they are 48 bits and the header grows to 16 bytes (with an extra 16-bit Reserved field).',
      detail: `X — EXTENDED SEQUENCE NUMBERS (1 bit, RFC 4340 §5.1):
- X = 0 (short form): sequence/acknowledgement numbers are 24 bits; the generic header is 12 bytes. After this byte the 24-bit Sequence Number follows immediately — there is NO additional Reserved field.
- X = 1 (long/extended form): sequence/acknowledgement numbers are 48 bits; the generic header is 16 bytes, inserting a 16-bit Reserved field and using a 48-bit sequence number.

WHY TWO FORMS: short 24-bit numbers save header bytes on high-rate small-packet flows (games, voice), but wrap quickly; long 48-bit numbers are safer against sequence-number wrap and certain blind off-path attacks on fast/long-lived connections. DCCP-Request and DCCP-Data packets often use the short form; some implementations and CCIDs prefer long form. This spec models X = 0.`,
    },
    {
      name: 'sequenceNumberLow',
      label: 'Sequence number (low)',
      bits: 24,
      note: 'Per-PACKET 24-bit sequence number (every packet, incl. acks).',
      desc: 'The 24-bit sequence number (short form). DCCP increments the sequence number on EVERY packet it sends — including pure acknowledgements — not per byte. This lets the congestion-control machinery measure loss and round-trip time precisely.',
      detail: `SEQUENCE NUMBER, low 24 bits (RFC 4340 §5.1, §7): unlike TCP (which numbers bytes), DCCP numbers PACKETS, and EVERY packet carries a sequence number that increases by one — including DCCP-Ack and DCCP-Sync packets that carry no application data. This "number everything" design is what lets DCCP's congestion control detect loss and reordering accurately even on a stream of pure acks.

WIDTH: in this short form the field is 24 bits (X = 0). In the extended form (X = 1) it is a 48-bit field. The 24-bit space wraps after ~16.7 million packets; DCCP-Sync/SyncAck resynchronise the two endpoints' notion of the valid sequence-number window after large losses or wrap.

This 24-bit value fits within the engine's exact numeric range, so it is read as a number (big-endian / network order).`,
    },
  ],
  // RFC 4340 §5.1: the application data begins (Data Offset * 4) bytes from the
  // start of the DCCP header. Everything between the 12-byte generic header and
  // there (type-specific subheader + options) is variable and falls through as
  // payload; Data Offset bounds the header so the byte view colours it exactly.
  headerBytes: (h: ParsedHeader): number => {
    const off = h.get('dataOffset') * 4;
    // Never claim a header shorter than the 12-byte generic header we transcribed.
    return off >= 12 ? off : 12;
  },
  // The payload is unreliable application datagrams (media/game/VoIP data) with
  // no generic child protocol to dissect, so dissection stops here.
  next: (_h: ParsedHeader): string | null => null,
};
