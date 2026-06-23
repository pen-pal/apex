// WebSocket — RFC 6455 (The WebSocket Protocol, 2011).
//
// WebSocket gives a long-lived, full-duplex, message-oriented channel between a
// browser and a server over a single TCP connection. It starts life as an HTTP/1.1
// request carrying an "Upgrade: websocket" header (RFC 6455 §1.3, §4); once the
// server answers "101 Switching Protocols" the bytes on the wire stop being HTTP
// and become WebSocket DATA FRAMES. THIS SPEC MODELS A DATA FRAME, not the HTTP
// handshake (that text exchange is the same line-based HTTP modelled in http.ts).
//
// FRAME FORMAT (RFC 6455 §5.2). Every frame opens with a fixed 2-byte base:
//
//    0                   1
//    0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5
//   +-+-+-+-+-------+-+-------------+
//   |F|R|R|R| opcode|M| Payload len |
//   |I|S|S|S|  (4)  |A|     (7)     |
//   |N|V|V|V|       |S|             |
//   | |1|2|3|       |K|             |
//   +-+-+-+-+-------+-+-------------+
//
//   ...followed by, IN ORDER, only when present:
//     * Extended payload length: 0, 2, or 8 more bytes (see Payload len below),
//     * Masking key:             4 bytes, present iff MASK = 1,
//     * Payload data:            Extension data + Application data.
//
// Apex models the 2-byte BASE as fixed bit-fields (FIN, RSV1-3, opcode, MASK,
// Payload len) and sets headerBytes() => 2. The extended length, the 4-byte mask,
// and the payload itself are variable and/or masked, so they fall through into
// node.payload — documented on the MASK and Payload len fields below. There is no
// generic child protocol (the application data is whatever the app chose — JSON,
// text, a protobuf), so `next` returns null: dissection stops at the frame.
//
// MASKING (RFC 6455 §5.3) — security, not secrecy. A client→server frame MUST set
// MASK=1 and XOR its payload with a fresh random 32-bit key:
//     transformed-octet-i = original-octet-i XOR masking-key-octet-(i MOD 4)
// The key is sent in the clear (4 bytes right after the length), so masking adds
// NO confidentiality. Its sole purpose is to make the on-wire bytes unpredictable
// to the CLIENT's own scripting code, defeating cache-poisoning attacks against
// intermediaries that might otherwise be tricked into seeing attacker-chosen bytes
// as a forged HTTP request. Server→client frames MUST NOT be masked (MASK=0).
//
// CONTROL vs DATA FRAMES (RFC 6455 §5.5): opcodes 0x8 (Close), 0x9 (Ping), 0xA
// (Pong) are control frames — they MUST have a payload ≤ 125 bytes and MUST NOT be
// fragmented. 0x0 (Continuation), 0x1 (Text), 0x2 (Binary) are data frames; a
// message may be split across frames with FIN marking the last fragment.
import type { ProtocolSpec } from '../core/types';

const OPCODE: Record<number, string> = {
  0x0: 'Continuation',
  0x1: 'Text',
  0x2: 'Binary',
  0x8: 'Close',
  0x9: 'Ping',
  0xa: 'Pong',
};

export const websocket: ProtocolSpec = {
  id: 'websocket',
  name: 'WebSocket',
  layer: 7,
  summary:
    'A persistent, full-duplex, message channel over a single TCP connection (RFC 6455). After an HTTP "Upgrade: websocket" handshake, traffic becomes framed messages: a 2-byte base (FIN, opcode, MASK, 7-bit length) optionally followed by an extended length, a 4-byte masking key, and the payload. Client→server frames are XOR-masked for anti-cache-poisoning, not privacy.',
  fields: [
    {
      name: 'fin',
      label: 'FIN',
      bits: 1,
      type: 'flags',
      flagBits: ['FIN'],
      note: '1 = final fragment of the message; 0 = more frames follow.',
      desc: 'The high bit of byte 0. When set, this frame carries the last fragment of a message; when clear, the message continues in subsequent frames (the first of which holds the real opcode, the rest use opcode 0 Continuation).',
      detail: `FIN (1 bit, RFC 6455 §5.2) — message FRAGMENTATION control.

A single application message can be split across several WebSocket frames so a sender can begin transmitting before it knows the total length (e.g. streaming output):
  Frame 1: FIN=0, opcode=0x1 (Text)         — first fragment, declares the type
  Frame 2: FIN=0, opcode=0x0 (Continuation) — middle fragment
  Frame 3: FIN=1, opcode=0x0 (Continuation) — final fragment

The receiver reassembles fragments in order until it sees FIN=1. CONTROL frames (Close/Ping/Pong) MUST set FIN=1 and may be interleaved between the fragments of a data message — they are never themselves fragmented.

For a small, complete message (the common case) a single frame has FIN=1 and the real opcode.`,
    },
    {
      name: 'rsv1',
      label: 'RSV1',
      bits: 1,
      note: 'Reserved; 0 unless an extension (e.g. permessage-deflate) defines it.',
      desc: 'Reserved bit 1. Must be 0 unless a negotiated extension gives it meaning; receiving a nonzero value without such an extension is a protocol error and the connection MUST fail.',
      detail: `RSV1 (1 bit, RFC 6455 §5.2). Reserved for extensions negotiated during the opening handshake.

The most common user of RSV1 is permessage-deflate (RFC 7692): when that extension is in effect, RSV1=1 on the first frame of a message marks the payload as DEFLATE-compressed. Absent a negotiated extension that defines it, RSV1 MUST be 0; a receiver that sees it set MUST Fail the WebSocket Connection.`,
    },
    {
      name: 'rsv2',
      label: 'RSV2',
      bits: 1,
      note: 'Reserved; must be 0 unless an extension defines it.',
      desc: 'Reserved bit 2. Must be 0 unless a negotiated extension defines it.',
      detail: `RSV2 (1 bit, RFC 6455 §5.2). Reserved for future extensions. No widely deployed extension uses it. Must be 0 absent negotiation; a nonzero value without a defining extension MUST fail the connection.`,
    },
    {
      name: 'rsv3',
      label: 'RSV3',
      bits: 1,
      note: 'Reserved; must be 0 unless an extension defines it.',
      desc: 'Reserved bit 3. Must be 0 unless a negotiated extension defines it.',
      detail: `RSV3 (1 bit, RFC 6455 §5.2). Reserved for future extensions. No widely deployed extension uses it. Must be 0 absent negotiation; a nonzero value without a defining extension MUST fail the connection.`,
    },
    {
      name: 'opcode',
      label: 'Opcode',
      bits: 4,
      type: 'enum',
      enumMap: OPCODE,
      note: '1=Text, 2=Binary, 0=Continuation, 8=Close, 9=Ping, 10=Pong.',
      desc: 'The low nibble of byte 0. Defines how to interpret the payload and whether this is a data frame (Continuation/Text/Binary) or a control frame (Close/Ping/Pong).',
      detail: `OPCODE (4 bits, RFC 6455 §5.2 / §11.8 IANA registry):

DATA FRAMES:
- 0x0 Continuation — a non-first fragment of a message; inherits the type of the frame that opened the message
- 0x1 Text         — payload is UTF-8 text (the receiver MUST validate it as UTF-8)
- 0x2 Binary       — payload is arbitrary binary application data

CONTROL FRAMES (RFC 6455 §5.5) — payload MUST be ≤ 125 bytes and MUST NOT be fragmented:
- 0x8 Close — begins the closing handshake; an optional 2-byte status code (e.g. 1000 normal) may lead the payload
- 0x9 Ping  — a heartbeat/keepalive; the peer MUST reply with a Pong
- 0xA Pong  — answer to a Ping (an unsolicited Pong is allowed as a one-way heartbeat)

RESERVED: 0x3–0x7 for future data frames, 0xB–0xF for future control frames. A frame with a reserved opcode MUST fail the connection.`,
    },
    {
      name: 'mask',
      label: 'MASK',
      bits: 1,
      type: 'flags',
      flagBits: ['MASK'],
      note: '1 = payload is XOR-masked and a 4-byte key follows the length. Client→server MUST be 1.',
      desc: 'The high bit of byte 1. When set, a 4-byte masking key follows the (extended) length and the payload is XOR-masked with it. Every client→server frame MUST set this; every server→client frame MUST clear it.',
      detail: `MASK (1 bit, RFC 6455 §5.2–§5.3) — and what comes AFTER this base header.

If MASK=1, the bytes that follow the 2-byte base (and any extended length) are:
  Masking-key (4 bytes)  then  Masked payload (Payload len bytes)
If MASK=0, the payload follows immediately with no key.

Apex parses only the 2-byte base; the masking key and the (possibly masked)
payload fall into the byte view's PAYLOAD. To recover the real bytes:
  for i in 0..len-1:  plaintext[i] = masked[i] XOR key[i MOD 4]

WHY MASK AT ALL — it is NOT encryption. The 4-byte key travels in cleartext just
before the data, so anyone on the wire can trivially unmask it. Masking exists so
that the EXACT on-wire byte sequence is not under the control of the client's
JavaScript: a fresh random key per frame randomizes the ciphertext, preventing an
attacker from steering a frame's bytes to look like a valid request to a poisoned
intermediary proxy/cache (RFC 6455 §10.3). A server MUST close the connection if a
client sends an unmasked frame, and MUST NOT mask its own frames.`,
    },
    {
      name: 'payloadLength',
      label: 'Payload length',
      bits: 7,
      decode: (v) =>
        v === 126
          ? '126 → real length in next 2 bytes (16-bit)'
          : v === 127
            ? '127 → real length in next 8 bytes (64-bit)'
            : `${v} bytes`,
      note: '0–125 = length directly; 126 = next 2 bytes; 127 = next 8 bytes.',
      desc: 'The low 7 bits of byte 1: the payload length in bytes, with two escape values. 0–125 is the length itself; 126 means a 16-bit length follows in the next 2 bytes; 127 means a 64-bit length follows in the next 8 bytes (its top bit MUST be 0).',
      detail: `PAYLOAD LENGTH (7 bits, RFC 6455 §5.2) — a variable-width length encoding:

- 0–125  : this IS the payload length, in bytes. No extra length bytes.
- 126    : the real length is the next 2 bytes, a 16-bit unsigned big-endian int
           (used for 126 .. 65535 bytes).
- 127    : the real length is the next 8 bytes, a 64-bit unsigned big-endian int
           with the most-significant bit set to 0 (used for ≥ 65536 bytes).
"The minimal number of bytes MUST be used to encode the length" — you cannot, for
example, send a length of 100 using the 126 form.

This length counts ONLY the payload (Extension data + Application data); it does
NOT include the 2-byte base, the extended-length bytes, or the 4-byte masking key.

In Apex the base header is fixed at 2 bytes; when this field is 126/127 the extra
length bytes (and then the optional 4-byte key and the payload) appear in the
byte view's payload region, since they are variable-width and cannot be a fixed
bit-field at a known offset.`,
    },
  ],
  // The base frame header is exactly 2 bytes (RFC 6455 §5.2). The extended length,
  // the optional 4-byte masking key, and the (possibly masked) payload are
  // variable/encoded and fall through into node.payload — see the MASK and
  // Payload length field detail above.
  headerBytes: () => 2,
  // The application data is opaque (JSON / text / binary chosen by the app) and a
  // client→server payload is XOR-masked, so there is no generic child protocol to
  // dissect. Dissection stops at the WebSocket frame.
  next: () => null,
};
