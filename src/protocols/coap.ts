// CoAP — Constrained Application Protocol. RFC 7252 (2014).
//
// CoAP is a RESTful application protocol for constrained IoT nodes: it offers
// GET/POST/PUT/DELETE like HTTP, but runs over UDP (default port 5683) with a
// tiny 4-byte binary header instead of HTTP's verbose ASCII. RFC 7252 §3 lays
// out the message format:
//
//    0                   1                   2                   3
//    0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
//   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//   |Ver| T |  TKL  |      Code     |          Message ID           |
//   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//   |   Token (if any, TKL bytes) ...                               |
//   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//   |   Options (if any) ...                                        |
//   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//   |1 1 1 1 1 1 1 1|    Payload (if any) ...                       |
//   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//
// WHY THIS SPEC MODELS ONLY THE 4-BYTE FIXED HEADER
// -------------------------------------------------
// Only the first 4 bytes are at fixed bit offsets. After them come, in order
// (RFC 7252 §3):
//   * Token        — 0..8 bytes, length given by TKL. Used to match a response
//                    to its request (§5.3.1).
//   * Options      — a sequence of delta-encoded TLVs. Each option byte starts
//                    with a 4-bit Option Delta (relative to the previous option
//                    number) and a 4-bit Option Length, with 13/14 escape values
//                    that pull in 1 or 2 extra length bytes (§3.1). Their offsets
//                    therefore depend on prior options and cannot be expressed as
//                    fixed-width Fields.
//   * 0xFF marker  — one byte (§3) separating options from the payload; present
//                    only when there IS a payload.
//   * Payload      — the rest of the UDP datagram (e.g. a sensor reading, a CBOR
//                    or JSON representation), bounded by the UDP Length.
// So we transcribe the fixed 4 bytes exactly and let the Token/Options/Payload
// fall through as node.payload (documented in notes, never invented as fields).
import type { ProtocolSpec } from '../core/types';

// RFC 7252 §3 / §4.1 — Type (T), 2 bits. CON expects an ACK; NON does not; ACK
// acknowledges a CON (and may piggyback a response); RST rejects a message the
// receiver could not process.
const TYPE: Record<number, string> = {
  0: 'CON (Confirmable)',
  1: 'NON (Non-confirmable)',
  2: 'ACK (Acknowledgement)',
  3: 'RST (Reset)',
};

// RFC 7252 §12.1 — Code (8 bits), split as a 3-bit class and 5-bit detail and
// written "c.dd". Numeric value = class*32 + detail. 0.00 is the Empty message;
// class 0 is a request (method); classes 2/4/5 are responses (success / client
// error / server error). This table lists the codes registered in RFC 7252;
// the registry is extensible (e.g. RFC 7959 Block-Wise adds 2.31 Continue).
const CODE: Record<number, string> = {
  0: '0.00 Empty',
  // Request methods (class 0) — RFC 7252 §12.1.1
  1: '0.01 GET',
  2: '0.02 POST',
  3: '0.03 PUT',
  4: '0.04 DELETE',
  // Success (class 2) — RFC 7252 §12.1.2
  65: '2.01 Created',
  66: '2.02 Deleted',
  67: '2.03 Valid',
  68: '2.04 Changed',
  69: '2.05 Content',
  // Client error (class 4) — RFC 7252 §12.1.2
  128: '4.00 Bad Request',
  129: '4.01 Unauthorized',
  130: '4.02 Bad Option',
  131: '4.03 Forbidden',
  132: '4.04 Not Found',
  133: '4.05 Method Not Allowed',
  134: '4.06 Not Acceptable',
  140: '4.12 Precondition Failed',
  141: '4.13 Request Entity Too Large',
  143: '4.15 Unsupported Content-Format',
  // Server error (class 5) — RFC 7252 §12.1.2
  160: '5.00 Internal Server Error',
  161: '5.01 Not Implemented',
  162: '5.02 Bad Gateway',
  163: '5.03 Service Unavailable',
  164: '5.04 Gateway Timeout',
  165: '5.05 Proxying Not Supported',
};

// Render any Code as its canonical "c.dd" notation even if not in the table,
// so an unknown/experimental code is still shown honestly (class.detail).
function codeNotation(v: number): string {
  const cls = (v >> 5) & 0x7;
  const detail = v & 0x1f;
  const dd = detail.toString().padStart(2, '0');
  const known = CODE[v];
  return known ?? `${cls}.${dd} (unassigned)`;
}

export const coap: ProtocolSpec = {
  id: 'coap',
  name: 'CoAP',
  layer: 7,
  summary:
    'The Constrained Application Protocol: a compact, RESTful HTTP-for-IoT over UDP/5683 — a 4-byte header (version, type, token length, code, message ID) then a token, delta-encoded options, and an optional payload.',
  fields: [
    {
      name: 'version',
      label: 'Version',
      bits: 2,
      note: 'MUST be 1 (binary 01) for this version of CoAP.',
      desc: 'The 2-bit CoAP version number. RFC 7252 requires it to be set to 1 (01 in binary); a message with any other version MUST be silently ignored.',
      detail: `VERSION (Ver, 2 bits) — RFC 7252 §3:
"Indicates the CoAP version number. Implementations of this specification MUST set this field to 1 (01 binary). Other values are reserved for future versions. Messages with unknown version numbers MUST be silently ignored."

It sits in the two most-significant bits of the very first byte, so a standard CoAP request begins with byte 0x40-0x7F (version 01 in the top two bits).`,
    },
    {
      name: 'type',
      label: 'Type',
      bits: 2,
      type: 'enum',
      enumMap: TYPE,
      desc: 'The 2-bit message Type: Confirmable (0) needs an acknowledgement, Non-confirmable (1) does not, Acknowledgement (2) confirms a CON, and Reset (3) rejects a message that could not be processed.',
      detail: `TYPE (T, 2 bits) — RFC 7252 §4.1:
- 0 CON (Confirmable): reliable. The sender retransmits with exponential back-off until it gets an ACK (or RST) carrying the same Message ID.
- 1 NON (Non-confirmable): best-effort, not acknowledged (e.g. a stream of sensor readings where the odd loss is fine).
- 2 ACK (Acknowledgement): acknowledges a single CON. It MAY "piggyback" the response in the same packet (§5.2.1).
- 3 RST (Reset): says "I received your message but can't process it" — e.g. the recipient rebooted and lost state, or the message was malformed.

CON/NON is the MESSAGING layer (reliability); the method/response Code is the REQUEST/RESPONSE layer on top of it.`,
    },
    {
      name: 'tokenLength',
      label: 'Token length (TKL)',
      bits: 4,
      decode: (v) => (v <= 8 ? `${v} byte${v === 1 ? '' : 's'}` : `${v} (RESERVED — message-format error)`),
      note: '0-8 bytes of Token follow the header. Values 9-15 are reserved and are a format error.',
      desc: 'The 4-bit length, in bytes, of the variable-length Token that immediately follows the fixed header. Legal values are 0 through 8; lengths 9-15 are reserved and MUST be treated as a message-format error.',
      detail: `TOKEN LENGTH (TKL, 4 bits) — RFC 7252 §3:
"Indicates the length of the variable-length Token field (0-8 bytes). Lengths 9-15 are reserved, MUST NOT be sent, and MUST be processed as a message format error."

The Token itself (TKL bytes, right after this 4-byte header) matches a response to its request (§5.3.1): a client picks a token, and the server echoes it back. It is distinct from the Message ID, which only deduplicates/acknowledges at the messaging layer.`,
    },
    {
      name: 'code',
      label: 'Code',
      bits: 8,
      type: 'enum',
      enumMap: CODE,
      decode: codeNotation,
      note: 'Read as class.detail: top 3 bits = class, low 5 bits = detail. 1=0.01 GET, 69=2.05 Content, 132=4.04 Not Found.',
      desc: 'An 8-bit code split into a 3-bit class and 5-bit detail, written "c.dd". Class 0 is a request method (0.01 GET, 0.02 POST, 0.03 PUT, 0.04 DELETE); class 2 = success, 4 = client error, 5 = server error; 0.00 is the Empty message.',
      detail: `CODE (8 bits) — RFC 7252 §3 / §12.1:
Split as class.detail: the top 3 bits are the class (0,2,4,5) and the low 5 bits are the detail. Numeric value = class*32 + detail, so "c.dd" maps to a single byte:
  0.00 Empty   = 0*32 + 0   = 0     (0x00)  — a message with no method/response
  0.01 GET     = 0*32 + 1   = 1     (0x01)
  0.02 POST    = 0*32 + 2   = 2     (0x02)
  0.03 PUT     = 0*32 + 3   = 3     (0x03)
  0.04 DELETE  = 0*32 + 4   = 4     (0x04)
  2.05 Content = 2*32 + 5   = 69    (0x45)  — the success body of a GET
  4.04 NotFound= 4*32 + 4   = 132   (0x84)
  5.00 Internal= 5*32 + 0   = 160   (0xA0)

CLASS MEANING:
  0 = request (method)
  2 = success response
  4 = client error response
  5 = server error response
This mirrors HTTP status families (2xx/4xx/5xx). An Empty message (0.00) in a CON is a "ping"; in an ACK it is an empty acknowledgement that confirms receipt without a piggybacked response.`,
    },
    {
      name: 'messageId',
      label: 'Message ID',
      bits: 16,
      desc: 'A 16-bit identifier, in network byte order, used to detect duplicates and to match an Acknowledgement or Reset to the Confirmable (or Non-confirmable) message it answers.',
      detail: `MESSAGE ID (16 bits, network byte order) — RFC 7252 §3 / §4.4:
"Used to detect message duplication and to match messages of type Acknowledgement/Reset to messages of type Confirmable/Non-confirmable."

- The recipient of a CON replies with an ACK (or RST) carrying the SAME Message ID, so the sender knows its retransmissions can stop.
- It also deduplicates: if the same Message ID arrives twice within EXCHANGE_LIFETIME, the second copy is a retransmission and is processed only once.
- It is a messaging-layer construct and is SEPARATE from the Token: the Message ID pairs a CON with its ACK; the Token pairs a request with its (possibly much later, separate) response.`,
    },
  ],
  // The fixed header is exactly 4 bytes. The Token (TKL bytes), Options, the
  // 0xFF payload marker, and the Payload all follow and fall through as payload.
  headerBytes: () => 4,
  // Dissection stops here: after the 4-byte header comes the Token, then
  // delta-encoded Option TLVs, then (optionally) the 0xFF marker + an opaque
  // application payload — none of which is a further registered protocol.
  next: () => null,
};
