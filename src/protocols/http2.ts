// HTTP/2 — Hypertext Transfer Protocol Version 2. RFC 7540 (2015).
//
// HTTP/2 keeps the SAME semantics as HTTP/1.1 (methods, status codes, header
// fields) but changes the WIRE FORMAT completely: instead of the text,
// line-oriented messages of HTTP/1.1 (see src/protocols/http.ts), HTTP/2 is a
// BINARY, framed protocol. A single TCP (usually TLS) connection is multiplexed
// into many independent "streams", and every message is chopped into binary
// frames that interleave on the wire. That is why this spec, unlike http.ts,
// HAS a fixed bit grid: the 9-byte frame header is identical for every frame.
//
// CONNECTION PREFACE (RFC 7540 §3.5)
// ----------------------------------
// Before any frames, a client opens an HTTP/2 connection by sending a fixed
// 24-byte magic string:
//   "PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n"
//   = 50 52 49 20 2a 20 48 54 54 50 2f 32 2e 30 0d 0a 0d 0a 53 4d 0d 0a 0d 0a
// This preface (chosen to make an HTTP/1.x server choke rather than
// misinterpret it) is IMMEDIATELY followed by a SETTINGS frame. The server, in
// turn, sends its own SETTINGS frame as the first thing on the connection. The
// preface is connection setup, not a frame, so this spec models the frame
// header (which is what repeats for every subsequent frame).
//
// FRAME HEADER (RFC 7540 §4.1) — fixed 9 octets, big-endian (network order):
//   +-----------------------------------------------+
//   |                 Length (24)                   |
//   +---------------+---------------+---------------+
//   |   Type (8)    |   Flags (8)   |
//   +-+-------------+---------------+-------------------------------+
//   |R|                 Stream Identifier (31)                     |
//   +=+=============================================================+
//   |                   Frame Payload (0...)                     ...
//   +---------------------------------------------------------------+
//
// Length is the payload length ONLY — "The 9 octets of the frame header are not
// included in this value" (§4.1). So the full frame on the wire is 9 + Length
// bytes, which is exactly what pduBytes returns.
//
// WHY next() RETURNS null
// -----------------------
// The frame payload is type-specific and (for HEADERS/PUSH_PROMISE/CONTINUATION)
// HPACK-COMPRESSED (RFC 7541) — a stateful Huffman + dynamic-table encoding that
// cannot be dissected as a fixed bit grid, and (for DATA frames) is opaque
// application data. There is no generic child protocol, so dissection stops at
// the frame header and the payload falls through as node.payload.
import type { ProtocolSpec, ParsedHeader } from '../core/types';

// RFC 7540 §6: registered frame type codes.
const FRAME_TYPE: Record<number, string> = {
  0: 'DATA',
  1: 'HEADERS',
  2: 'PRIORITY',
  3: 'RST_STREAM',
  4: 'SETTINGS',
  5: 'PUSH_PROMISE',
  6: 'PING',
  7: 'GOAWAY',
  8: 'WINDOW_UPDATE',
  9: 'CONTINUATION',
};

export const http2: ProtocolSpec = {
  id: 'http2',
  name: 'HTTP/2',
  layer: 7,
  summary:
    'A BINARY, multiplexed framing for HTTP semantics over a single TCP/TLS connection (RFC 7540). After a fixed 24-byte connection preface, every message is carried as one or more 9-byte-header frames (DATA, HEADERS, SETTINGS, …) that interleave across independent streams. Header blocks are HPACK-compressed, so unlike text HTTP/1.1 the wire is a true byte grid.',
  fields: [
    {
      name: 'length',
      label: 'Length',
      bits: 24,
      note: 'Payload length in bytes — does NOT include the 9-byte frame header.',
      desc: 'A 24-bit unsigned big-endian count of the frame payload that follows this header, in octets. RFC 7540 §4.1 is explicit that "the 9 octets of the frame header are not included in this value", so the whole frame occupies 9 + Length bytes on the wire.',
      detail: `LENGTH (24 bits, RFC 7540 §4.1):
- Counts ONLY the frame payload, never the 9-byte header. A SETTINGS frame with no settings has Length = 0 (the frame is just its 9-byte header).
- Default ceiling is 2^14 = 16,384 bytes. A peer may raise this via the SETTINGS_MAX_FRAME_SIZE setting (range 16,384 .. 2^24-1). Sending a frame larger than the receiver's advertised maximum is a FRAME_SIZE_ERROR.
- Because it is 24 bits, the absolute maximum payload is 16,777,215 bytes.`,
    },
    {
      name: 'type',
      label: 'Type',
      bits: 8,
      type: 'enum',
      enumMap: FRAME_TYPE,
      note: 'Frame type: it determines how the payload and the Flags byte are interpreted.',
      desc: 'An 8-bit code identifying the frame type (RFC 7540 §6). The type governs the meaning of both the payload and the Flags byte — for example flag 0x4 means END_HEADERS on a HEADERS frame but ACK on a SETTINGS frame.',
      detail: `TYPE (8 bits, RFC 7540 §6) — the ten frame types this protocol defines:
- 0x0 DATA: stream payload (request/response body bytes).
- 0x1 HEADERS: opens a stream and carries an HPACK-compressed header block.
- 0x2 PRIORITY: (re)assigns a stream's priority/dependency.
- 0x3 RST_STREAM: abruptly terminates one stream (carries an error code).
- 0x4 SETTINGS: connection-level configuration; sent at start and acknowledged.
- 0x5 PUSH_PROMISE: server announces a stream it intends to push.
- 0x6 PING: liveness / round-trip measurement (8-byte opaque payload).
- 0x7 GOAWAY: connection shutdown; names the last processed stream + error code.
- 0x8 WINDOW_UPDATE: flow-control credit for a stream or the whole connection.
- 0x9 CONTINUATION: continues a header block too large for one HEADERS frame.
An endpoint MUST ignore and discard any frame whose type it does not recognise.`,
    },
    {
      name: 'flags',
      label: 'Flags',
      bits: 8,
      type: 'hex',
      note: 'Boolean flags whose meaning depends on Type (e.g. END_STREAM 0x1, END_HEADERS 0x4, ACK 0x1 on SETTINGS/PING).',
      desc: 'An 8-bit field of boolean flags whose meaning is specific to the frame Type (RFC 7540 §4.1). Common bits: END_STREAM = 0x1 (last frame of a stream, also ACK = 0x1 on SETTINGS/PING), END_HEADERS = 0x4 (header block complete), PADDED = 0x8, PRIORITY = 0x20. Flags with no defined meaning for a given type are sent as 0 and ignored.',
      detail: `FLAGS (8 bits, RFC 7540 §4.1) — meaning is per-type, so it is shown as hex rather than fixed flag names:
- DATA:    END_STREAM 0x1, PADDED 0x8
- HEADERS: END_STREAM 0x1, END_HEADERS 0x4, PADDED 0x8, PRIORITY 0x20
- SETTINGS / PING: ACK 0x1 (the frame acknowledges a previously received frame)
- PUSH_PROMISE: END_HEADERS 0x4, PADDED 0x8
- CONTINUATION: END_HEADERS 0x4
PRIORITY, RST_STREAM, GOAWAY and WINDOW_UPDATE define no flags (Flags = 0x00).
Undefined bits MUST be set to 0 when sending and ignored when receiving.`,
    },
    {
      name: 'reserved',
      label: 'R',
      bits: 1,
      note: 'Reserved bit; MUST be 0 when sending and ignored on receipt.',
      desc: 'A single reserved bit preceding the Stream Identifier. RFC 7540 §4.1 requires it be unset (0x0) when sending and ignored when receiving — it has no defined semantics.',
      detail: `RESERVED (1 bit, RFC 7540 §4.1): "This bit MUST remain unset (0x0) when sending and MUST be ignored when receiving."
It exists so the Stream Identifier is exactly 31 bits, fitting the remaining 32-bit word. Because receivers ignore it, an implementation must NOT assume it is zero — it masks it off before reading the 31-bit stream ID.`,
    },
    {
      name: 'streamIdentifier',
      label: 'Stream Identifier',
      bits: 31,
      note: '31-bit stream the frame belongs to; 0 = the whole connection (used by SETTINGS, PING, GOAWAY, connection WINDOW_UPDATE).',
      desc: 'A 31-bit unsigned big-endian stream identifier (RFC 7540 §4.1, §5.1.1). Stream 0 is the connection control stream — SETTINGS, PING, GOAWAY and connection-level WINDOW_UPDATE use it. Client-initiated streams are odd, server-initiated (pushed) streams are even; IDs only increase.',
      detail: `STREAM IDENTIFIER (31 bits, RFC 7540 §5.1.1):
- 0x0 is reserved for connection-level frames (SETTINGS, PING, GOAWAY, and WINDOW_UPDATE applied to the whole connection). A frame that requires a stream MUST NOT use 0.
- Streams a CLIENT opens use ODD identifiers (1, 3, 5, …); streams a SERVER opens (PUSH_PROMISE) use EVEN identifiers (2, 4, …). Stream 1 may be used by an upgraded HTTP/1.1 request.
- Identifiers are monotonically increasing for the initiating endpoint and are never reused; this multiplexing of many streams over one TCP connection is the core feature HTTP/2 adds over HTTP/1.1.
Combined with the reserved R bit this forms the final 32-bit word of the frame header.`,
    },
  ],
  // Fixed 9-octet frame header (RFC 7540 §4.1).
  headerBytes: () => 9,
  // The whole frame is the 9-byte header plus the payload counted by Length.
  // pduBytes bounds the PDU so trailing bytes (e.g. the next frame on the same
  // connection) do not leak into this frame's payload.
  pduBytes: (h: ParsedHeader) => 9 + h.get('length'),
  // The payload is type-specific: HPACK-compressed header blocks, opaque DATA,
  // or fixed binary structures (SETTINGS pairs, PING data, …). There is no
  // generic child protocol to dissect, so we stop and let it fall to payload.
  next: () => null,
};
