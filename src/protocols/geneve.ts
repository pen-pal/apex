// Geneve — Generic Network Virtualization Encapsulation. RFC 8926 (2020).
//
// Geneve is a network-virtualization overlay, like VXLAN (RFC 7348): it tunnels
// an inner Layer-2/Layer-3 PDU across a routed IP underlay, inside UDP. The
// IANA-assigned well-known destination UDP port is 6081. Where VXLAN's header is
// rigidly fixed and Ethernet-only, Geneve was designed to be EXTENSIBLE: after
// the 8-byte base header it carries a variable list of Type-Length-Value (TLV)
// options, and a Protocol Type field lets it tunnel Ethernet, IPv4, IPv6, etc.
//
// Encapsulation stack on the wire (RFC 8926 §3):
//   Outer Ethernet | Outer IP | Outer UDP (dst 6081) | GENEVE (8B + options) |
//   INNER frame (Ethernet / IPv4 / ... selected by Protocol Type)
//
// The endpoints that add/strip this header are tunnel endpoints (NVE/VTEP).
//
// The Geneve base header is a fixed 8 bytes (RFC 8926 §3.1):
//   0                   1                   2                   3
//   0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
//  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//  |Ver|  Opt Len  |O|C|    Rsvd.  |          Protocol Type        |
//  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//  |        Virtual Network Identifier (VNI)       |    Reserved   |
//  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//
//   Ver(2) OptLen(6) | O(1) C(1) Rsvd(6) | ProtocolType(16) | VNI(24) Reserved(8)
//
// All multi-byte fields are big-endian (network order).
import type { ProtocolSpec, ParsedHeader } from '../core/types';

// RFC 8926 §3.1 — Protocol Type uses the EtherType registry; 0x6558 is the
// special "Transparent Ethernet Bridging" value meaning the payload is a full
// inner Ethernet frame.
const PROTOCOL_TYPE: Record<number, string> = {
  0x6558: 'Transparent Ethernet Bridging (inner Ethernet)',
  0x0800: 'IPv4',
  0x86dd: 'IPv6',
};

export const geneve: ProtocolSpec = {
  id: 'geneve',
  name: 'Geneve',
  layer: 7, // an overlay/encapsulation that rides on UDP (RFC 8926 dst port 6081)
  summary:
    'An extensible network-virtualization overlay (RFC 8926) over UDP/6081: an 8-byte base header plus a variable list of TLV options, tunneling an inner frame (Ethernet, IPv4, IPv6, …) selected by Protocol Type and scoped by a 24-bit VNI. Like VXLAN, but with options and any payload type.',
  fields: [
    {
      name: 'version',
      label: 'Version',
      bits: 2,
      note: 'Geneve version; currently always 0.',
      desc: 'The 2-bit Geneve version number, occupying the top two bits of the first byte. RFC 8926 defines version 0 only; a tunnel endpoint MUST drop a packet whose version it does not understand.',
      detail: `VERSION (2 bits, RFC 8926 §3.1): the current and only defined value is 0. Reserving a version field up front lets the base header itself evolve incompatibly in future without colliding with the option mechanism (which handles backward-compatible extension). A receiver that sees an unknown version MUST silently drop the packet.`,
    },
    {
      name: 'optLen',
      label: 'Opt Len',
      bits: 6,
      decode: (v) => `${v} (= ${v * 4} bytes of options)`,
      note: 'Length of the variable options, in 4-byte units (0 = no options).',
      desc: 'The 6-bit length of the variable Geneve options that follow the base header, expressed in 4-byte (32-bit) words and NOT including the 8-byte base header. With 6 bits the options span 0–252 bytes, so the total header is at most 8 + 252 = 260 bytes.',
      detail: `OPT LEN (6 bits, RFC 8926 §3.1): the length of the options field in multiples of 4 bytes, excluding the fixed 8-byte base header.
- Range: 0..63 words = 0..252 bytes of options. Maximum total Geneve header = 8 + 252 = 260 bytes.
- This is what makes Geneve's header VARIABLE (and what headerBytes() below computes): the payload begins at 8 + OptLen*4 bytes.
- A value of 0 means there are NO options — exactly the common data-plane case modeled in the test, where the base header is immediately followed by the inner frame.

CONTRAST WITH VXLAN: VXLAN (RFC 7348) has no options field at all — its header is a fixed 8 bytes. Geneve's TLV options are the whole point of its design: control-plane metadata (security, telemetry, group policy) rides alongside each packet without a new wire format.`,
    },
    {
      name: 'flags',
      label: 'Flags (O, C)',
      bits: 8,
      type: 'flags',
      // Byte 1, bits laid out MSB-first: O C R R R R R R. flagBits[0] = MSB.
      flagBits: ['O', 'C', 'R', 'R', 'R', 'R', 'R', 'R'],
      note: 'O (0x80) = OAM/control packet; C (0x40) = critical options present.',
      desc: 'The second byte: the O and C control flags plus 6 reserved bits. O (0x80, the MSB) marks an OAM/control packet whose payload is not application data. C (0x40) signals that the options list contains at least one option flagged "critical".',
      detail: `FLAGS BYTE (RFC 8926 §3.1), bits MSB-first: O C R R R R R R
- O (0x80, OAM): when set, this is a control/OAM packet — the payload is NOT a tunneled tenant frame and MUST NOT be forwarded to tenants. Endpoints may apply higher-priority/exception processing. Most data-plane packets have O = 0.
- C (0x40, Critical options present): set when at least one option in the variable options list has its own critical bit set. If C = 1 and a tunnel endpoint does not recognise a critical option, it MUST drop the packet (rather than ignore the option). This lets an option be made mandatory.
- R (the low 6 bits): Reserved. MUST be zero on transmission and ignored on receipt.

A plain data packet with no critical options therefore has Flags = 0x00.`,
    },
    {
      name: 'protocolType',
      label: 'Protocol Type',
      bits: 16,
      type: 'enum',
      enumMap: PROTOCOL_TYPE,
      note: 'EtherType of the inner payload: 0x6558 = inner Ethernet, 0x0800 = IPv4.',
      desc: 'The type of the payload that follows the Geneve header (after any options), encoded using the IEEE EtherType convention. 0x6558 is "Transparent Ethernet Bridging", meaning a full inner Ethernet frame; 0x0800 means a bare IPv4 packet, 0x86DD a bare IPv6 packet.',
      detail: `PROTOCOL TYPE (16 bits, RFC 8926 §3.1): the EtherType of the inner payload — this is how Geneve dispatches to the right inner protocol (the next() hook below).
- 0x6558 — "Transparent Ethernet Bridging": the payload is an entire inner Ethernet frame (the VXLAN-equivalent, MAC-in-UDP behaviour). This is the value in the test capture.
- 0x0800 — IPv4: the payload is a bare IPv4 packet (L3 overlay, no inner MACs).
- 0x86DD — IPv6.
Any other EtherType-registered value is permitted.

WHY THIS MATTERS: VXLAN can ONLY carry inner Ethernet; Geneve's Protocol Type lets the same tunnel carry L2 or L3 payloads, which is a key reason Geneve was standardized as the more general overlay.`,
    },
    {
      name: 'vni',
      label: 'VNI',
      bits: 24,
      note: 'Virtual Network Identifier: the 24-bit overlay segment ID (~16M values).',
      desc: 'The 24-bit Virtual Network Identifier — the tenant/segment ID that scopes the inner frame to one overlay virtual network. It is Geneve\'s analogue of the VXLAN VNI and the 802.1Q VLAN ID, but 24 bits wide (~16.7 million segments).',
      detail: `VNI (24 bits, RFC 8926 §3.1): identifies the virtual network the inner payload belongs to. Two tenants can reuse the same inner MACs/IPs because their traffic is isolated by different VNIs.
- 2^24 = 16,777,216 possible identifiers, versus the 12-bit 802.1Q VLAN ID's 4096 (4094 usable).
- The VNI occupies the top 3 bytes of the second 32-bit word; the low byte is Reserved.

ENDIANNESS: 24-bit big-endian (network order).`,
    },
    {
      name: 'reserved',
      label: 'Reserved',
      bits: 8,
      type: 'hex',
      note: 'Reserved low byte of the VNI word; MUST be 0, ignored on receipt.',
      desc: 'The final reserved byte of the 8-byte base header, occupying the low 8 bits of the word that holds the 24-bit VNI. RFC 8926 requires it to be zero on transmission and ignored on receipt.',
      detail: `RESERVED (8 bits, RFC 8926 §3.1): the last byte of the fixed base header. Because the VNI is 24 bits but the word is 32 bits wide, this trailing byte pads the VNI word; it MUST be set to zero on transmission and ignored on receipt.`,
    },
  ],
  // The base header is 8 bytes plus OptLen*4 bytes of variable TLV options
  // (RFC 8926 §3.1). The options are not a fixed bit grid, so they are not
  // transcribed as Field entries; when OptLen > 0 they are consumed as part of
  // the header length here so they do not leak into the inner payload. In the
  // common no-options case OptLen = 0 and the header is exactly 8 bytes.
  headerBytes: (h: ParsedHeader): number => 8 + h.get('optLen') * 4,
  // Dispatch to the inner protocol by Protocol Type (EtherType convention).
  // 0x6558 = inner Ethernet (Transparent Ethernet Bridging); 0x0800 = IPv4;
  // 0x86DD = IPv6. Returning an id that isn't registered yet is fine — the
  // engine stops gracefully (per the contract).
  next: (h: ParsedHeader): string | null => {
    switch (h.get('protocolType')) {
      case 0x6558:
        return 'ethernet';
      case 0x0800:
        return 'ipv4';
      case 0x86dd:
        return 'ipv6';
      default:
        return null;
    }
  },
};
