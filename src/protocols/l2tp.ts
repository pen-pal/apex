// L2TPv2 — Layer Two Tunneling Protocol, version 2. RFC 2661 (August 1999),
// section 3.1 "L2TP Header Format".
//
// L2TP tunnels PPP frames across an IP network so that a remote user's PPP
// session can terminate on a far-away gateway (the LNS) rather than on the box
// that answered the call (the LAC). It is the workhorse under "L2TP/IPsec" VPNs:
// L2TP carries the PPP session, IPsec encrypts it. L2TPv2 runs over UDP, well-
// known port 1701 (it can also run directly over Frame Relay/ATM, but UDP/IP is
// by far the common case in this simulator).
//
// L2TP has two kinds of message that share one header format:
//   - CONTROL messages (T=1): a reliable, sequenced channel that sets up, tears
//     down, and manages tunnels and sessions (SCCRQ/SCCRP/SCCCN, ICRQ/ICRP/ICCN,
//     Hello, StopCCN, CDN, ...). Control messages MUST set L=1 and S=1.
//   - DATA messages (T=0): the actual tunneled PPP payload. Unreliable; L and S
//     are usually 0.
//
// THE HEADER (RFC 2661 section 3.1), all big-endian / network order:
//   0                   1                   2                   3
//   0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
//  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//  |T|L|x|x|S|x|O|P|x|x|x|x|  Ver  |          Length (opt)         |
//  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//  |           Tunnel ID           |           Session ID          |
//  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//  |             Ns (opt)          |             Nr (opt)          |
//  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//  |      Offset Size (opt)        |    Offset pad... (opt)
//  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//
// CRITICAL: every field AFTER the first 16 bits is CONDITIONAL on a flag bit in
// those 16 bits (Length on L, Tunnel ID / Session ID always present, Ns/Nr on S,
// Offset Size on O). Because the presence and therefore the byte offset of each
// subsequent field depends on flags we have only just read, this spec models the
// fixed 2-byte flags+version word exactly and stops: headerBytes() => 2,
// next() => null. The conditional remainder falls through as node.payload — see
// the note on the `version` field for its full layout.
import type { ProtocolSpec } from '../core/types';

const TYPE: Record<number, string> = {
  0: 'Data message',
  1: 'Control message',
};

export const l2tp: ProtocolSpec = {
  id: 'l2tp',
  name: 'L2TPv2',
  layer: 7,
  summary: 'Tunnels PPP sessions across an IP network (UDP 1701) so a dial/broadband user can terminate their PPP link on a distant gateway — the L in "L2TP/IPsec" VPNs.',
  fields: [
    {
      name: 'type', label: 'Type (T)', bits: 1, type: 'enum', enumMap: TYPE,
      note: '0 = data message (tunneled PPP), 1 = control message (tunnel/session management).',
      desc: 'The most-significant bit of the header. T=0 marks a data message carrying tunneled PPP payload; T=1 marks a control message on the reliable management channel. Control and data messages share this one header format but use different channels.',
      detail: `TYPE (T) BIT (bit 0, the MSB of the first byte), RFC 2661 §3.1:
"The T bit indicates the type of message. It is set to 0 for a data message and 1 for a control message."

TWO CHANNELS, ONE FORMAT:
- CONTROL (T=1): a reliable, in-order channel (its own Ns/Nr sequence space, with retransmission) used to set up and tear down tunnels and sessions — SCCRQ/SCCRP/SCCCN to start a tunnel, ICRQ/ICRP/ICCN to start a session, Hello to keep it alive, StopCCN/CDN to tear down. A control message MUST also set L=1 and S=1.
- DATA (T=0): the tunneled PPP frames themselves. Delivery is unreliable (L2TP does not retransmit data); reliability, if needed, is PPP's or the upper layer's problem.

The example capture byte 0xC8 = 1100 1000 has T=1, so it is a control message.`,
    },
    {
      name: 'lengthPresent', label: 'Length present (L)', bits: 1,
      decode: (v) => (v ? 'L=1 — Length field present' : 'L=0 — no Length field'),
      note: 'If 1, the optional 16-bit Length field follows the version word. MUST be 1 for control messages.',
      desc: 'The Length (L) bit. When set, a 16-bit Length field is present immediately after the flags+version word, giving the total length of the message. Control messages must set it; data messages usually omit it.',
      detail: `LENGTH (L) BIT (bit 1), RFC 2661 §3.1:
"If the Length (L) bit is 1, the Length field is present. This bit MUST be set to 1 for control messages."

The presence of this bit is exactly why this spec stops after the first 16 bits: whether the next two bytes are the Length field or the Tunnel ID depends on L. In the 0xC8 example L=1, so a Length field is the first thing in the payload that follows.`,
    },
    {
      name: 'reserved1', label: 'Reserved (x x)', bits: 2,
      note: 'Two reserved bits; MUST be 0 on send and ignored on receive.',
      desc: 'Two of the header\'s reserved (x) bits. RFC 2661 requires them to be sent as 0 and ignored on receipt, leaving room for future header extensions.',
      detail: `RESERVED (x) BITS (bits 2-3), RFC 2661 §3.1:
"The x bits are reserved for future extensions. All reserved bits MUST be set to 0 on outgoing messages and ignored on incoming messages."

Keeping these zero (rather than reusing them) is what lets the format evolve without breaking older implementations.`,
    },
    {
      name: 'sequencePresent', label: 'Sequence present (S)', bits: 1,
      decode: (v) => (v ? 'S=1 — Ns and Nr present' : 'S=0 — no Ns/Nr'),
      note: 'If 1, the Ns and Nr sequence/ack fields are present. MUST be 1 for control messages.',
      desc: 'The Sequence (S) bit. When set, both the Ns (send sequence number) and Nr (next expected / acknowledgment number) fields are present. Control messages must set it so their reliable channel can sequence and acknowledge.',
      detail: `SEQUENCE (S) BIT (bit 4), RFC 2661 §3.1:
"If the Sequence (S) bit is set to 1 the Ns and Nr fields are present. The S bit MUST be set to 1 for control messages."

Ns/Nr give the control channel a sliding-window reliable delivery just like a tiny TCP: Ns is this message's sequence number, Nr is the sequence number of the next message the sender expects (acknowledging everything before it). Data messages may also set S to detect lost/reordered data, but L2TP still does not retransmit data.`,
    },
    {
      name: 'reserved2', label: 'Reserved (x)', bits: 1,
      note: 'One reserved bit; MUST be 0 on send, ignored on receive.',
      desc: 'A single reserved (x) bit, sent as 0 and ignored on receipt.',
      detail: `RESERVED (x) BIT (bit 5), RFC 2661 §3.1: one more of the reserved bits that "MUST be set to 0 on outgoing messages and ignored on incoming messages."`,
    },
    {
      name: 'offsetPresent', label: 'Offset present (O)', bits: 1,
      decode: (v) => (v ? 'O=1 — Offset Size present' : 'O=0 — no Offset Size'),
      note: 'If 1, the Offset Size field is present (data padding before the payload). MUST be 0 for control messages.',
      desc: 'The Offset (O) bit. When set, an Offset Size field follows, specifying how many padding bytes sit between the L2TP header and the start of the payload. It must be 0 in control messages.',
      detail: `OFFSET (O) BIT (bit 6), RFC 2661 §3.1:
"If the Offset (O) bit is 1, the Offset Size field is present. ... This field, if present, specifies the number of octets past the L2TP header at which the payload data is expected to start. ... The Offset Size, if present, is a 16 bit value. ... The O bit MUST be 0 (zero) for control messages."

The offset lets an implementation align the encapsulated PPP payload on a convenient boundary; the bytes in the offset pad are undefined and skipped.`,
    },
    {
      name: 'priority', label: 'Priority (P)', bits: 1,
      decode: (v) => (v ? 'P=1 — preferential queuing' : 'P=0 — normal'),
      note: 'If 1, this DATA message should get preferential local queuing/transmission. MUST be 0 for control messages.',
      desc: 'The Priority (P) bit. When set on a data message, it asks the local queue to give the packet preferential treatment (for example LCP keepalives that must not be dropped). Control messages must clear it.',
      detail: `PRIORITY (P) BIT (bit 7, the LSB of the first byte), RFC 2661 §3.1:
"If the Priority (P) bit is 1, this data message should receive preferential treatment in its local queuing and transmission. LCP echo requests used as a keepalive for the link, for instance, should generally be sent with this bit set to 1. ... The P bit MUST be 0 for all control messages."

It is purely a local scheduling hint — it does not change anything on the wire downstream.`,
    },
    {
      name: 'reserved3', label: 'Reserved (x x x x)', bits: 4,
      note: 'Four reserved bits (high nibble of byte 2); MUST be 0 on send.',
      desc: 'The four reserved (x) bits that occupy the high nibble of the second byte, sent as 0 and ignored on receipt.',
      detail: `RESERVED (x) BITS (bits 8-11), RFC 2661 §3.1: the last group of reserved bits, sharing the second byte with the 4-bit Ver field. As with all x bits they "MUST be set to 0 on outgoing messages and ignored on incoming messages."`,
    },
    {
      name: 'version', label: 'Version (Ver)', bits: 4,
      note: 'MUST be 2 for L2TPv2 (RFC 2661). After this 2-byte word the conditional fields begin.',
      desc: 'The protocol version, occupying the low nibble of the second byte. RFC 2661 requires the value 2. This field ends the fixed 2-byte word; everything after it is conditional on the flag bits above.',
      detail: `VERSION (Ver) FIELD (bits 12-15), RFC 2661 §3.1:
"Ver MUST be 2, indicating the version of the L2TP data message header described in this document. The value 1 is reserved to permit detection of L2F [RFC2341] packets should they arrive intermixed with L2TP packets. Packets received with an unknown Ver field MUST be discarded."
(Value 1 = the older L2F; L2TPv3, RFC 3931, is a separate format not signalled by this nibble.)

WHY THE DISSECTION STOPS HERE — THE CONDITIONAL REMAINDER:
After this fixed 16-bit word, fields appear ONLY if their flag bit was set, so each field's byte offset depends on flags we just read. The full possible order (RFC 2661 §3.1) is:
  Length        16 bits   present iff L=1
  Tunnel ID     16 bits   always present
  Session ID    16 bits   always present
  Ns            16 bits   present iff S=1
  Nr            16 bits   present iff S=1
  Offset Size   16 bits   present iff O=1
  Offset Pad    Offset-Size bytes, present iff O=1
  ...then the payload (a PPP frame for data; AVPs for control).

A typical control message (L=1, S=1, O=0, the 0xC8 case) therefore continues:
  Length | Tunnel ID | Session ID | Ns | Nr | Control AVPs...
This spec models the fixed flags+version word and leaves that variable, flag-gated remainder in node.payload rather than inventing fixed offsets for it.`,
    },
  ],
  // Fixed 2-byte flags+version word. Every following field is conditional on the
  // flag bits (Length on L, Ns/Nr on S, Offset on O), so its offset cannot be
  // known until those flags are parsed — we stop here and leave the rest as
  // payload. L2TP is the top of the stack in this model (control AVPs / tunneled
  // PPP are not modelled as fixed fields).
  headerBytes: () => 2,
  next: () => null,
};
