// LDP — the MPLS Label Distribution Protocol. RFC 5036 (LDP Specification),
// which obsoletes RFC 3036. LDP lets Label Switching Routers (LSRs) tell each
// other which MPLS label to use for which Forwarding Equivalence Class (FEC),
// building the label-switched paths that carry MPLS traffic.
//
// TRANSPORT
// ---------
// LDP uses two channels, both on port 646 (RFC 5036 §2.5.1, §2.4):
//   - UDP/646 for the Hello discovery exchange (multicast to 224.0.0.2 for the
//     Basic mechanism, or unicast for Extended/Targeted Hellos).
//   - TCP/646 for the LDP session itself: Initialization, KeepAlive, Address,
//     Label Mapping/Request/Withdraw/Release, and Notification messages.
// Either way the LDP PDU on the wire has the same shape.
//
// THE LDP PDU HEADER (RFC 5036 §3.5.2)
// ------------------------------------
// Every LDP PDU begins with a fixed 10-octet part, then one or more messages:
//
//   0                   1                   2                   3
//   0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
//  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//  |  Version (16)                 |     PDU Length (16)           |
//  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//  |                         LSR Id (32)                           |  \
//  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+   } LDP Id
//  |  Label Space Id (16)          |                                  /
//  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//
//   Version       2 octets, = 1 for this specification.
//   PDU Length    2 octets, "the total length of this PDU in octets, excluding
//                 the Version and PDU Length fields" (RFC 5036 §3.5.2). So it
//                 counts the 6-octet LDP Identifier plus all the messages.
//   LDP Identifier 6 octets: a 4-octet LSR Id (a globally unique value, by
//                 convention a 32-bit router ID rendered as a dotted quad) plus
//                 a 2-octet Label Space Id (0 = the LSR's platform-wide label
//                 space).
//
// THE LDP MESSAGE (RFC 5036 §3.4)
// -------------------------------
// After the header comes one or more messages, each with this common structure:
//
//   0                   1                   2                   3
//   0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
//  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//  |U|   Message Type (15)         |      Message Length (16)      |
//  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//  |                       Message ID (32)                         |
//  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//  |                  Mandatory + Optional Parameters (TLVs)       |
//  ~                                                               ~
//
//   U-bit          1 bit. On an unknown message: U=0 -> return a Notification to
//                  the originator; U=1 -> silently ignore (RFC 5036 §3.4).
//   Message Type   15 bits. The codes below (RFC 5036 §3.5.x / IANA).
//   Message Length 2 octets. "the cumulative length in octets of the Message ID,
//                  Mandatory Parameters, and Optional Parameters" (RFC 5036
//                  §3.4) — i.e. everything AFTER the Message Length field.
//   Message ID     4 octets, identifies the message (so a Notification can
//                  reference it).
//
// WHY THE PARAMETER TLVs FALL THROUGH AS PAYLOAD
// ----------------------------------------------
// The parameters after the Message ID are a variable set of TLVs (RFC 5036 §3.3:
// U|F|Type(14)|Length(16)|Value) whose contents differ per message type — the
// Common Hello Parameters and Transport Address of a Hello, the Common Session
// Parameters of an Initialization, the FEC + Label of a Label Mapping. That is a
// different structure per message and cannot be transcribed honestly as one
// fixed Field grid, so it falls through as node.payload (next => null), bounded
// by PDU Length so a following message in the same TCP stream cannot leak in.
import type { ProtocolSpec, ParsedHeader } from '../core/types';

// LDP message type codes (RFC 5036 §3.5.x and the IANA "Label Distribution
// Protocol (LDP) Parameters" registry). Values are the 15-bit type code.
const MSG_TYPE: Record<number, string> = {
  0x0001: 'Notification',
  0x0100: 'Hello',
  0x0200: 'Initialization',
  0x0201: 'KeepAlive',
  0x0300: 'Address',
  0x0301: 'Address Withdraw',
  0x0400: 'Label Mapping',
  0x0401: 'Label Request',
  0x0403: 'Label Withdraw',
  0x0404: 'Label Release',
};

export const ldp: ProtocolSpec = {
  id: 'ldp',
  name: 'LDP',
  layer: 7,
  summary:
    'The MPLS Label Distribution Protocol (RFC 5036). LSRs use it to tell each other which label to use for which FEC, building label-switched paths. Hello discovery runs over UDP/646 (multicast); the session — Initialization, KeepAlive, Label Mapping/Request/Withdraw/Release, Notification — runs over TCP/646. Every PDU starts with a Version, a PDU Length, and a 6-octet LDP Identifier, followed by one or more messages.',
  fields: [
    {
      name: 'version',
      label: 'Version',
      bits: 16,
      decode: (v) => (v === 1 ? '1 (RFC 5036)' : String(v)),
      note: 'Protocol version; 1 for RFC 5036.',
      desc: 'A 2-octet protocol version number. RFC 5036 defines version 1; this is the only value currently in use.',
      detail: `VERSION (2 octets, RFC 5036 §3.5.2): "Two octet unsigned integer containing the version number of the protocol. This version of the specification specifies LDP protocol version 1."

LDP has had one wire version across RFC 3036 and its successor RFC 5036, so in practice this field is always 0x0001.`,
    },
    {
      name: 'pduLength',
      label: 'PDU Length',
      bits: 16,
      decode: (v) => `${v} bytes after this field (6-byte LDP Id + ${Math.max(0, v - 6)} bytes of messages)`,
      note: 'Length in octets of everything AFTER this field (LDP Id + messages).',
      desc: 'A 2-octet length covering everything that follows it: the 6-octet LDP Identifier plus all the messages in this PDU. It explicitly EXCLUDES the Version and PDU Length fields themselves.',
      detail: `PDU LENGTH (2 octets, RFC 5036 §3.5.2): "Two octet integer specifying the total length of this PDU in octets, excluding the Version and PDU Length fields."

BOUNDS THE PDU: because it excludes the first 4 octets, the full PDU on the wire is PDU Length + 4 octets. The dissector adds those 4 back to stop the PDU exactly, so a following PDU in the same TCP byte stream — or Ethernet padding under a small UDP Hello — cannot leak into this PDU's messages.

CONTENTS: the 6-octet LDP Identifier followed by one or more messages. A single PDU may carry several messages (e.g. a batch of Label Mappings), so PDU Length minus 6 is the total of all message bytes, not just one message.`,
    },
    {
      name: 'lsrId',
      label: 'LSR Id',
      bits: 32,
      type: 'ipv4',
      note: 'The router ID half of the LDP Identifier; rendered as a dotted quad.',
      desc: 'The first 4 octets of the 6-octet LDP Identifier: a value that uniquely identifies the sending LSR. By convention it is a 32-bit router ID, so it is rendered here as an IPv4 dotted quad.',
      detail: `LSR Id (4 octets, the first part of the LDP Identifier, RFC 5036 §2.2.1 / §3.5.2): "the first four octets identify the LSR and are a globally unique value, an LSR Id."

By long-standing convention the LSR Id is the router's 32-bit Router ID (often a loopback address), which is why it reads naturally as a dotted quad — but formally it is an opaque 32-bit identifier, not an address you can route to.`,
    },
    {
      name: 'labelSpaceId',
      label: 'Label Space Id',
      bits: 16,
      decode: (v) => (v === 0 ? '0 (platform-wide label space)' : String(v)),
      note: 'The 2-octet label-space half of the LDP Identifier; 0 = platform-wide.',
      desc: 'The last 2 octets of the LDP Identifier: which label space within the LSR this PDU concerns. Zero means the LSR\'s single platform-wide label space; non-zero identifies a per-interface label space.',
      detail: `LABEL SPACE Id (2 octets, the second part of the LDP Identifier, RFC 5036 §2.2.1): "the last two octets identify a specific label space within the LSR."

PLATFORM-WIDE vs PER-INTERFACE: a value of 0 denotes the platform-wide label space — one shared label space for the whole LSR, used for frame-mode MPLS. Non-zero values denote per-interface label spaces, used where labels are only meaningful on a particular interface (e.g. cell-mode / LC-ATM). Together the LSR Id and Label Space Id form the 6-octet LDP Identifier "LSR-Id:label-space" written as 1.1.1.1:0.`,
    },
    {
      name: 'uBit',
      label: 'U-bit',
      bits: 1,
      decode: (v) => (v ? '1 (silently ignore if unknown)' : '0 (notify originator if unknown)'),
      note: 'Unknown-message handling: 0 = send Notification, 1 = silently ignore.',
      desc: 'The most-significant bit of the first message. It tells a receiver what to do if it does not recognise the Message Type: 0 means return a Notification to the originator, 1 means silently ignore the message.',
      detail: `U-BIT (1 bit, RFC 5036 §3.4): "Upon receipt of an unknown message, if U is clear (=0), a notification is returned to the message originator; if U is set (=1), the unknown message is silently ignored."

This is the MSB of the 16-bit word that also holds the 15-bit Message Type, so the two are read together from the first two octets of the message.`,
    },
    {
      name: 'messageType',
      label: 'Message Type',
      bits: 15,
      type: 'enum',
      enumMap: MSG_TYPE,
      note: '0x0100 Hello, 0x0200 Init, 0x0201 KeepAlive, 0x0400 Label Mapping, …',
      desc: 'A 15-bit code identifying the first message in this PDU. It selects which parameters follow the Message ID. The values cover discovery (Hello), session setup (Initialization, KeepAlive), address exchange, and the label-distribution messages.',
      detail: `MESSAGE TYPE (15 bits, RFC 5036 §3.4, codes from §3.5.x / IANA):
- 0x0001 Notification — signals an event or error; may reference a prior message by its Message ID.
- 0x0100 Hello — the discovery message, sent over UDP/646, carrying Common Hello Parameters (hold time) and a transport address.
- 0x0200 Initialization — first message on a new TCP session; negotiates Common Session Parameters (keepalive time, label distribution mode, PDU/label ranges).
- 0x0201 KeepAlive — heartbeat that keeps the session's keepalive timer from expiring.
- 0x0300 Address / 0x0301 Address Withdraw — advertise or withdraw the interface addresses an LSR uses, so peers can map next-hops to LDP Identifiers.
- 0x0400 Label Mapping — the workhorse: binds a label to a FEC ("use label L to reach prefix P").
- 0x0401 Label Request — asks a peer for a label binding (Downstream-on-Demand).
- 0x0403 Label Withdraw / 0x0404 Label Release — revoke a binding / tell a peer a label is no longer needed.

The receiver dispatches on this code to choose the parameter parser for the rest of the message.`,
    },
    {
      name: 'messageLength',
      label: 'Message Length',
      bits: 16,
      decode: (v) => `${v} bytes (4-byte Message ID + ${Math.max(0, v - 4)} bytes of parameter TLVs)`,
      note: 'Cumulative length of Message ID + Mandatory + Optional Parameters.',
      desc: 'A 2-octet length for the first message: the cumulative length of the Message ID plus the mandatory and optional parameter TLVs. It counts everything after the Message Length field for this one message.',
      detail: `MESSAGE LENGTH (2 octets, RFC 5036 §3.4): "Specifies the cumulative length in octets of the Message ID, Mandatory Parameters, and Optional Parameters."

So Message Length - 4 is the total size of the parameter TLVs that follow the Message ID. Because a PDU can hold several messages, this length bounds just THIS message; the next message (if any) begins right after these parameters and is itself bounded by the PDU Length.`,
    },
    {
      name: 'messageId',
      label: 'Message ID',
      bits: 32,
      type: 'hex',
      note: '32-bit id the sender assigns, so a Notification can reference this message.',
      desc: 'A 4-octet identifier the sending LSR assigns to this message. A later Notification can carry this value to say which message it refers to.',
      detail: `MESSAGE ID (4 octets, RFC 5036 §3.4): "32-bit value used to identify this message. Used by the sending LSR to facilitate identifying Notification messages that may apply to this message."

It is opaque to the receiver — only the sender needs to make it unique enough to correlate a Notification back to the message that triggered it.`,
    },
  ],
  // Fixed dissectable part: Version(2) + PDU Length(2) + LSR Id(4) + Label Space
  // Id(2) + first message's U/Type(2) + Message Length(2) + Message ID(4) = 18.
  // The parameter TLVs after the Message ID are message-type-specific and fall
  // through as payload.
  headerBytes: (): number => 18,
  // PDU Length excludes the Version and PDU Length fields, so the whole PDU is
  // PDU Length + 4 octets. Bounding by this keeps a following PDU in the TCP
  // stream — or Ethernet padding under a UDP Hello — out of the payload.
  pduBytes: (h: ParsedHeader): number => h.get('pduLength') + 4,
  // LDP is the application leaf: the message parameters are TLVs, not a nested
  // protocol, so there is nothing further to dissect.
  next: (_h: ParsedHeader): string | null => null,
};
