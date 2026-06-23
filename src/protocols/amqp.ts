// AMQP 0-9-1 — Advanced Message Queuing Protocol, version 0-9-1 (the dialect
// implemented by RabbitMQ and standardised as ISO/IEC 19464 for the 1.0 line;
// 0-9-1 itself is the AMQP Working Group specification "AMQP 0-9-1", November
// 2008). AMQP is a binary, connection-oriented messaging protocol that runs over
// TCP, by default on port 5672 (5671 for AMQPS/TLS). Reference: the AMQP 0-9-1
// specification, §2.3 "The wire-level format" / §4.2.3 "General Frame Format".
//
// NOTE: AMQP 0-9-1 (this spec) and AMQP 1.0 (the later OASIS/ISO 19464 wire
// protocol) are DIFFERENT wire formats. RabbitMQ speaks 0-9-1 natively; this
// file models 0-9-1.
//
// CONNECTION START — THE PROTOCOL HEADER HANDSHAKE
// ------------------------------------------------
// Before any frames flow, the client sends an 8-byte literal protocol header so
// the broker can confirm the version it supports:
//
//     'A' 'M' 'Q' 'P'  0x00 0x00 0x09 0x01
//      41  4D  51  50    00   00   09   01
//
// i.e. the ASCII letters "AMQP", a 0 byte, then the protocol class/version
// triple (0, 9, 1 = AMQP 0-9-1). If the broker cannot speak that version it
// replies with its own 8-byte header and closes the connection. THIS 8-BYTE
// HANDSHAKE IS NOT A FRAME (it has no type/channel/size/frame-end); it is a
// one-time preface. This spec models the GENERAL FRAME that follows it.
//
// THE GENERAL FRAME FORMAT (AMQP 0-9-1 §4.2.3), big-endian:
//
//   0      1         3                   7                 size+7   size+8
//   +------+---------+-------------------+--------- ... ---+--------+
//   | type | channel |      size         |     payload     |  0xCE  |
//   +------+---------+-------------------+--------- ... ---+--------+
//    octet   short        long              size octets      octet
//   (8 bit) (16 bit)     (32 bit)         (size bytes)      (frame-end)
//
// - type    (1 byte) : frame type — 1 METHOD, 2 HEADER, 3 BODY, 4 HEARTBEAT.
// - channel (2 bytes): the channel this frame belongs to; 0 is the special
//                      "connection" channel (used by connection.* methods and
//                      heartbeats). Many logical channels are multiplexed over
//                      one TCP connection.
// - size    (4 bytes): the length IN BYTES of the payload that follows — it does
//                      NOT include the 7-byte header or the 1-byte frame-end.
// - payload (size bytes): type-specific (a method's class/method id + arguments,
//                      a content header's properties, raw body bytes, or — for a
//                      heartbeat — empty).
// - frame-end (1 byte): the constant 0xCE (206 decimal). A receiver that does not
//                      find exactly 0xCE at offset 7+size knows its framing has
//                      desynchronised and MUST close the connection — a cheap,
//                      self-checking frame delimiter.
//
// WHAT THIS SPEC MODELS
// ---------------------
// We transcribe the fixed 7-byte frame header (type, channel, size). The payload
// (size bytes) is type-specific and variable — a METHOD frame begins with a
// 16-bit class id + 16-bit method id, then AMQP-typed arguments; we do NOT model
// that as a fixed bit grid (it would lie about the wire), so it falls through as
// node.payload. We DO bound the whole PDU with pduBytes = 7 + size + 1 so that the
// start of any FOLLOWING frame never leaks into this frame's payload. The 0xCE
// frame-end is itself part of this PDU, so (like RTP trailing padding) it sits at
// the tail of node.payload rather than being trimmed. There is no encapsulated
// child protocol, so next is null.
import type { ProtocolSpec, ParsedHeader } from '../core/types';

// AMQP 0-9-1 §4.2.3 — frame type constants.
const FRAME_TYPE: Record<number, string> = {
  1: 'METHOD',
  2: 'HEADER',
  3: 'BODY',
  4: 'HEARTBEAT',
};

export const amqp: ProtocolSpec = {
  id: 'amqp',
  name: 'AMQP 0-9-1',
  layer: 7,
  summary:
    'The Advanced Message Queuing Protocol 0-9-1 (RabbitMQ): a binary messaging protocol over TCP/5672. After an 8-byte "AMQP\\0\\0\\9\\1" version handshake, everything is a frame with a 7-byte header — type (method/header/body/heartbeat), channel, and payload size — followed by the payload and a self-checking 0xCE frame-end octet.',
  fields: [
    {
      name: 'type',
      label: 'Frame type',
      bits: 8,
      type: 'enum',
      enumMap: FRAME_TYPE,
      decode: (v) => (FRAME_TYPE[v] ? `${v} (${FRAME_TYPE[v]})` : `${v} (unknown/invalid frame type)`),
      note: '1=METHOD, 2=HEADER (content properties), 3=BODY (message bytes), 4=HEARTBEAT.',
      desc: 'The 1-byte frame type, which determines the meaning and layout of the payload. METHOD (1) carries an RPC call such as Basic.Publish; HEADER (2) carries a message’s content properties and body size; BODY (3) carries raw message bytes; HEARTBEAT (4) is an empty keep-alive.',
      detail: `FRAME TYPE (1 byte, AMQP 0-9-1 §4.2.3):
  1  METHOD    — an RPC method: class id (2B) + method id (2B) + typed arguments. This is how the client and broker talk (Connection.Start, Channel.Open, Queue.Declare, Basic.Publish, Basic.Deliver, …).
  2  HEADER    — a content header: class id (2B), weight (2B, always 0), 64-bit body size, then a property flags word and the present properties (content-type, delivery-mode, …). Sent right after a Basic.Publish/Basic.Deliver method.
  3  BODY      — opaque message body bytes. A message larger than the negotiated frame-max is split across several BODY frames; concatenating their payloads reconstructs the message.
  4  HEARTBEAT — a keep-alive with an EMPTY payload (size 0), always on channel 0, exchanged at the negotiated heartbeat interval so each peer can detect a dead connection.

PUBLISHING ONE MESSAGE therefore takes at least three frames: a METHOD (Basic.Publish) + a HEADER (properties + body size) + one or more BODY frames.

A receiver that reads a type outside 1–4 (or that fails to find 0xCE where size says the frame ends) MUST treat the connection as corrupt and close it.`,
    },
    {
      name: 'channel',
      label: 'Channel',
      bits: 16,
      decode: (v) => (v === 0 ? '0 (connection-global: connection.* methods & heartbeats)' : `${v} (a logical channel)`),
      note: 'Logical channel multiplexed over the one TCP connection. Channel 0 is the connection itself.',
      desc: 'The 2-byte channel number. AMQP multiplexes many independent logical channels over a single TCP connection; each frame names the channel it belongs to. Channel 0 is reserved for connection-wide methods (Connection.Start/Tune/Open/Close) and for heartbeats.',
      detail: `CHANNEL (2 bytes, big-endian, AMQP 0-9-1 §4.2.3 / §2.2.4):
- A "channel" is a lightweight, independent conversation multiplexed onto one TCP connection — analogous to a virtual connection. Opening a channel (Channel.Open) is far cheaper than opening a TCP connection, so a client uses many: typically one per thread/consumer.
- CHANNEL 0 is special: it carries the connection-scope methods (Connection.Start, Connection.Tune, Connection.Open, Connection.Close) and all HEARTBEAT frames. Real channels are numbered 1..N.
- Frames on different channels may interleave on the wire, but BODY frames of a given content must not be interrupted on their channel by another frame on that same channel.

ENDIANNESS: 16-bit big-endian (network order).`,
    },
    {
      name: 'size',
      label: 'Payload size',
      bits: 32,
      decode: (v) => `${v} byte${v === 1 ? '' : 's'} of payload (header is 7 bytes; a 0xCE frame-end follows)`,
      note: 'Length in bytes of the payload only — excludes the 7-byte header and the trailing 0xCE.',
      desc: 'The 4-byte payload size: the number of bytes in the payload that follows the header. It does NOT count the 7-byte frame header itself, nor the single 0xCE frame-end octet after the payload. A HEARTBEAT frame has size 0.',
      detail: `SIZE (4 bytes, big-endian, AMQP 0-9-1 §4.2.3): the payload length in octets.

WHAT IT BOUNDS: the total frame on the wire is 7 (header) + size (payload) + 1 (the 0xCE frame-end) bytes. The dissector uses pduBytes = 7 + size + 1 so the first byte of any FOLLOWING frame never leaks in; the 0xCE frame-end, being part of this PDU, sits at the very tail of the payload.

FRAME-MAX NEGOTIATION: Connection.Tune negotiates a maximum frame size (frame-max) between client and broker; a payload may not exceed frame-max minus the 8 framing bytes. Messages larger than that are split across multiple BODY frames. RabbitMQ’s default frame-max is 131072 bytes (128 KiB).

HEARTBEAT: size is 0 — the payload is empty; the frame is just type(4) + channel(0) + size(0) + 0xCE, i.e. 8 bytes total.

ENDIANNESS: 32-bit big-endian (network order). A value of e.g. 0x000001CB is 459 bytes.`,
    },
  ],
  // Fixed 7-byte frame header: type(1) + channel(2) + size(4).
  headerBytes: (): number => 7,
  // The whole frame is 7-byte header + `size` payload bytes + 1 frame-end (0xCE).
  // Bounding the PDU here keeps any FOLLOWING frame out of this payload; the 0xCE
  // frame-end is part of this PDU so it remains at the tail of node.payload. The
  // type-specific payload itself is not further dissected.
  pduBytes: (h: ParsedHeader): number => 7 + h.get('size') + 1,
  // The payload is AMQP-typed, frame-type-specific content (method arguments,
  // content properties, or raw body bytes) — not an encapsulated sub-protocol —
  // so dissection stops here and the payload bytes are node.payload.
  next: (_h: ParsedHeader): string | null => null,
};
