// MQTT 3.1.1 — MQTT Version 3.1.1, OASIS Standard (29 October 2014).
// Authoritative reference: "MQTT Version 3.1.1" OASIS Standard,
// http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html
// (also published as ISO/IEC 20922:2016). MQTT is a lightweight publish/
// subscribe messaging transport for IoT, running over TCP, by convention on
// port 1883 (cleartext) or 8883 (over TLS).
//
// WHAT THIS SPEC MODELS
// ---------------------
// Every MQTT Control Packet begins with a FIXED HEADER (OASIS 3.1.1 §2.2):
//
//   byte 0:  bits 7-4 = MQTT Control Packet type (unsigned 4-bit)
//            bits 3-0 = flags specific to that packet type
//   bytes 1..: Remaining Length (a 1-to-4-byte variable-length integer)
//
// This spec models BYTE 0 only — the one fixed bit-grid byte that is identical
// in shape across all packet types. We split it into the 4-bit packet type
// (an enum) and the 4-bit flags. headerBytes() => 1, so everything from the
// Remaining Length onward (the variable-length integer, the variable header,
// and the payload) falls through as node.payload. There is no inner protocol
// to dissect generically, so next() => null.
//
// THE REMAINING LENGTH VARINT (OASIS 3.1.1 §2.2.3) — documented, not parsed
// ------------------------------------------------------------------------
// Remaining Length is the number of bytes in the rest of the packet (variable
// header + payload), NOT including byte 0 or the Remaining Length bytes
// themselves. It is encoded as a base-128 variable-length integer, low byte
// first: each byte carries 7 data bits in its low bits, and the high bit (0x80)
// is a CONTINUATION flag meaning "another length byte follows."
//   1 byte  encodes 0 .. 127
//   2 bytes encodes 128 .. 16,383
//   3 bytes encodes 16,384 .. 2,097,151
//   4 bytes encodes 2,097,152 .. 268,435,455 (the maximum; 256 MB)
// Decoding: value = sum over bytes of (byte & 0x7F) * 128^i.
// This length is not a fixed-width field at a fixed bit offset, so it cannot be
// transcribed honestly as a Field; it lives in node.payload (its first 1-4
// bytes) and is documented here instead. See the note on the `flags` field.
//
// FLAG BITS (OASIS 3.1.1 §2.2.2 / Table 2.2)
// ------------------------------------------
// For most packet types the 4 flag bits are RESERVED and MUST be 0. Three types
// carry the fixed value 0b0010 (PUBREL, SUBSCRIBE, UNSUBSCRIBE). Only PUBLISH
// uses the flag bits meaningfully: DUP (bit 3), QoS (bits 2-1), RETAIN (bit 0).
import type { ProtocolSpec, ParsedHeader } from '../core/types';

// OASIS 3.1.1 Table 2.1 — Control Packet types (the high nibble of byte 0).
// 0 and 15 are Reserved/Forbidden.
const PACKET_TYPE: Record<number, string> = {
  0: 'Reserved',
  1: 'CONNECT',
  2: 'CONNACK',
  3: 'PUBLISH',
  4: 'PUBACK',
  5: 'PUBREC',
  6: 'PUBREL',
  7: 'PUBCOMP',
  8: 'SUBSCRIBE',
  9: 'SUBACK',
  10: 'UNSUBSCRIBE',
  11: 'UNSUBACK',
  12: 'PINGREQ',
  13: 'PINGRESP',
  14: 'DISCONNECT',
  15: 'Reserved',
};

// Decode the 4 flag bits in the context of the packet type (OASIS 3.1.1 §2.2.2).
function decodeFlags(flags: number, h: ParsedHeader): string {
  const type = h.get('packetType');
  if (type === 3) {
    // PUBLISH: DUP (bit3), QoS (bits2-1), RETAIN (bit0).
    const dup = (flags >> 3) & 1;
    const qos = (flags >> 1) & 3;
    const retain = flags & 1;
    return `PUBLISH: DUP=${dup}, QoS=${qos}, RETAIN=${retain}`;
  }
  // PUBREL/SUBSCRIBE/UNSUBSCRIBE carry the mandatory value 0b0010.
  if (type === 6 || type === 8 || type === 10) {
    return flags === 0b0010 ? 'reserved value 0b0010 (required)' : `0b${flags.toString(2).padStart(4, '0')} (MUST be 0b0010)`;
  }
  // Everything else: reserved, MUST be 0.
  return flags === 0 ? 'reserved (MUST be 0)' : `0b${flags.toString(2).padStart(4, '0')} (MUST be 0)`;
}

export const mqtt: ProtocolSpec = {
  id: 'mqtt',
  name: 'MQTT 3.1.1',
  layer: 7,
  summary:
    'A lightweight publish/subscribe IoT messaging protocol over TCP/1883. Every packet starts with a 1-byte fixed header: a 4-bit packet type (CONNECT, PUBLISH, SUBSCRIBE, …) and 4 type-specific flag bits, followed by a 1-4 byte variable-length Remaining Length. Apex shows byte 0; the Remaining Length and the variable header/payload fall through as raw bytes.',
  fields: [
    {
      name: 'packetType',
      label: 'Control Packet type',
      bits: 4,
      type: 'enum',
      enumMap: PACKET_TYPE,
      note: 'High nibble of byte 0. Identifies the control packet (1=CONNECT, 3=PUBLISH, 8=SUBSCRIBE, …).',
      desc: 'The 4 most-significant bits of the first byte name the MQTT Control Packet type as an unsigned value. This is what tells a broker whether the client is connecting, publishing a message, subscribing to topics, or just keeping the connection alive.',
      detail: `MQTT CONTROL PACKET TYPE (OASIS 3.1.1 §2.2.1, Table 2.1) — bits 7-4 of byte 0:
 1  CONNECT      Client -> Server   Client requests a connection
 2  CONNACK      Server -> Client   Connection acknowledgement
 3  PUBLISH      both ways          Publish a message (uses the flag bits)
 4  PUBACK       both ways          QoS 1 publish acknowledgement
 5  PUBREC       both ways          QoS 2 publish received (part 1)
 6  PUBREL       both ways          QoS 2 publish release (part 2)
 7  PUBCOMP      both ways          QoS 2 publish complete (part 3)
 8  SUBSCRIBE    Client -> Server   Subscribe to topic filters
 9  SUBACK       Server -> Client   Subscribe acknowledgement
10  UNSUBSCRIBE  Client -> Server   Unsubscribe from topics
11  UNSUBACK     Server -> Client   Unsubscribe acknowledgement
12  PINGREQ      Client -> Server   Keep-alive ping
13  PINGRESP     Server -> Client   Keep-alive pong
14  DISCONNECT   Client -> Server   Clean disconnect notification
 0 and 15 are RESERVED / forbidden.

A new TCP connection always opens with a CONNECT (type 1) as its first packet;
the server MUST reply with CONNACK (type 2) before any other packet flows.`,
    },
    {
      name: 'flags',
      label: 'Flags',
      bits: 4,
      type: 'flags',
      // flagBits[0] = MSB of this 4-bit nibble = DUP (PUBLISH). The names below
      // are the PUBLISH meanings; for other packet types these bits are reserved.
      flagBits: ['DUP', 'QoS-hi', 'QoS-lo', 'RETAIN'],
      decode: decodeFlags,
      note: 'Low nibble of byte 0. Reserved (MUST be 0) for most packets; 0b0010 for PUBREL/SUBSCRIBE/UNSUBSCRIBE; for PUBLISH: DUP(bit3) QoS(bits2-1) RETAIN(bit0). The Remaining Length varint follows in byte 1+ and is part of the payload here.',
      desc: 'The 4 least-significant bits of byte 0 are flags specific to the packet type. For PUBLISH they carry DUP (duplicate-delivery), QoS (delivery guarantee 0/1/2), and RETAIN (the broker keeps the last message). For other packet types they are reserved fixed values.',
      detail: `FLAG BITS (OASIS 3.1.1 §2.2.2, Table 2.2) — bits 3-0 of byte 0:

PUBLISH (type 3) is the only packet that uses these bits meaningfully:
  bit 3  DUP    — set if this is a re-delivery of an earlier PUBLISH. MUST be 0
                  for QoS 0 messages; set by sender on retransmission of QoS 1/2.
  bits 2-1 QoS  — Quality of Service level of the message:
                  0 = at most once  (fire and forget, no ack)
                  1 = at least once (PUBACK; may duplicate)
                  2 = exactly once  (PUBREC/PUBREL/PUBCOMP handshake)
                  the value 3 is forbidden — a malformed packet.
  bit 0  RETAIN — if set, the server stores this message and delivers it to any
                  future subscriber to the topic as the "last known good" value.

OTHER PACKET TYPES:
  PUBREL (6), SUBSCRIBE (8), UNSUBSCRIBE (10) — flags MUST be 0b0010 (bit 1 set).
  All other types — flags are RESERVED and MUST be 0b0000.
A server MUST treat a packet whose reserved flag bits are wrong as malformed.

WHAT FOLLOWS THIS BYTE — the REMAINING LENGTH (OASIS 3.1.1 §2.2.3):
Byte 1 onward holds a 1-4 byte variable-length integer giving the number of
bytes remaining (variable header + payload), low byte first. Each byte uses its
low 7 bits for data and its top bit (0x80) as a "more bytes follow" continuation
flag. value = Σ (byte_i & 0x7F) * 128^i. Ranges: 1 byte 0-127, 2 bytes up to
16,383, 3 bytes up to 2,097,151, 4 bytes up to 268,435,455. These length bytes
are not a fixed-offset field, so Apex leaves them (and the rest of the packet)
in the payload rather than inventing a bit grid for them.`,
    },
  ],
  // Only the 1-byte fixed-header first byte is a fixed bit grid. The Remaining
  // Length varint and the variable header + payload fall through as payload.
  headerBytes: () => 1,
  // The body is MQTT variable-header + payload (text topics, opaque app bytes);
  // there is no generic child protocol to dissect, so dissection stops here.
  next: () => null,
};
