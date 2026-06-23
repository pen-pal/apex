// PPP — Point-to-Point Protocol. RFC 1661 (July 1994), §2 "PPP Encapsulation".
//
// PPP carries multi-protocol datagrams over point-to-point links (dial-up,
// serial, and — most commonly today — tunnelled inside PPPoE sessions over
// Ethernet, RFC 2516, or inside HDLC framing). The PPP encapsulation is
// deliberately tiny: a Protocol field, then the Information field (the payload),
// then optional Padding. The HDLC-like framing (Flag 0x7E, Address 0xFF,
// Control 0x03, the FCS) belongs to the *framing* layer below PPP, not to the
// PPP encapsulation itself — inside a PPPoE Session frame those framing bytes
// are absent and the PPP packet begins directly with the Protocol field.
//
// THIS SPEC models exactly that PPP encapsulation Protocol field — the 2-octet
// identifier that says what the Information field contains. RFC 1661 §2:
//
//   "The Protocol field is one or two octets, and its value identifies the
//    datagram encapsulated in the Information field of the packet. [...]
//    The Protocol field is transmitted and received most significant octet
//    first. [...] All Protocols MUST be odd; the least significant bit of the
//    least significant octet MUST equal '1'. Also, all Protocols MUST be
//    assigned such that the least significant bit of the most significant octet
//    equals '0'."
//
// Protocol-Field-Compression (PFC, RFC 1661 §6.5) can shrink this to a single
// octet for protocols in 0x00-0xFF, but the default and the on-the-wire form
// inside PPPoE Session is the full 2 octets, which is what we model.
//
// After the Protocol field comes the Information field (the encapsulated
// datagram) followed by optional Padding; those are variable and protocol-
// specific, so they fall through as node.payload. We dispatch network-layer
// protocols (IPv4 0x0021, IPv6 0x0057) to their dissectors; control protocols
// (LCP, IPCP, PAP, CHAP, ...) have their own option/TLV bodies we do not model,
// so they return null and their bodies land in the payload.
import type { ProtocolSpec, ParsedHeader } from '../core/types';

// PPP Protocol field assignments (IANA "PPP DLL Protocol Numbers" registry;
// the values below are the ones called out in RFC 1661 and its companions).
const PROTOCOLS: Record<number, string> = {
  0x0021: 'IPv4',
  0x0057: 'IPv6',
  0x8021: 'IPCP (IP Control Protocol)',
  0x8057: 'IPv6CP (IPv6 Control Protocol)',
  0xc021: 'LCP (Link Control Protocol)',
  0xc023: 'PAP (Password Authentication Protocol)',
  0xc025: 'LQR (Link Quality Report)',
  0xc223: 'CHAP (Challenge-Handshake Authentication Protocol)',
};

// Only network-layer protocols have a generic child dissector in Apex. Control
// protocols (0x8xxx NCPs, 0xCxxx link-control) carry their own option/TLV
// formats and are intentionally left for node.payload.
const PROTOCOL_TO_ID: Record<number, string> = {
  0x0021: 'ipv4',
  0x0057: 'ipv6',
};

export const ppp: ProtocolSpec = {
  id: 'ppp',
  name: 'PPP',
  layer: 2,
  summary:
    'The Point-to-Point Protocol encapsulation (RFC 1661): a single 2-octet Protocol field that says what kind of datagram — IPv4, IPv6, or a control protocol like LCP/IPCP/CHAP — fills the Information field that follows. Commonly tunnelled inside a PPPoE Session or HDLC framing.',
  fields: [
    {
      name: 'protocol',
      label: 'Protocol',
      bits: 16,
      type: 'enum',
      enumMap: PROTOCOLS,
      note: 'Identifies the datagram in the Information field. 0x0021 = IPv4, 0x0057 = IPv6, 0xC021 = LCP, 0x8021 = IPCP, 0xC223 = CHAP.',
      desc: 'The 2-octet PPP Protocol field. Its value names what the rest of the packet (the Information field) contains, so the receiver can hand the payload to the right network-layer or control protocol. Sent most-significant octet first (big-endian).',
      detail: `PROTOCOL (16 bits, RFC 1661 §2): "identifies the datagram encapsulated in the
Information field of the packet" and is "transmitted and received most
significant octet first."

ASSIGNMENT RULES (RFC 1661 §2): every assigned Protocol value is constrained so
that it is unambiguous even when Protocol-Field-Compression squeezes it to one
octet:
- The least significant bit of the LEAST significant octet MUST be 1 (so every
  Protocol number is ODD — e.g. 0x0021, 0xC021, 0xC223 are all odd).
- The least significant bit of the MOST significant octet MUST be 0.

VALUE RANGES (the most significant octet groups the protocol class):
- 0x0000-0x3FFF  network-layer protocols (e.g. 0x0021 IPv4, 0x0057 IPv6)
- 0x4000-0x7FFF  low-volume protocols with no associated NCP
- 0x8000-0xBFFF  Network Control Protocols (e.g. 0x8021 IPCP, 0x8057 IPv6CP)
- 0xC000-0xFFFF  link-layer Control Protocols (e.g. 0xC021 LCP, 0xC023 PAP,
                 0xC025 LQR, 0xC223 CHAP)

LINK LIFECYCLE: a PPP link first runs LCP (0xC021) to negotiate link options and
optionally authenticates with PAP (0xC023) or CHAP (0xC223); then a Network
Control Protocol such as IPCP (0x8021) negotiates network-layer parameters (e.g.
the IPv4 address) before user IPv4 (0x0021) traffic can flow.

PROTOCOL-FIELD-COMPRESSION (RFC 1661 §6.5): once negotiated via LCP, protocols in
0x00-0xFF may be sent as a single octet (e.g. 0x21 instead of 0x0021). The
ODD-value rule above is what keeps a 1-octet form distinguishable. Apex models
the default, uncompressed 2-octet form as carried inside a PPPoE Session.

WHAT FOLLOWS: the Information field (the encapsulated datagram, up to the
negotiated MRU, default 1500) and optional Padding. Those are variable and
protocol-specific, so Apex leaves them in node.payload.`,
    },
  ],
  // The modelled PPP encapsulation prefix is the fixed 2-octet Protocol field.
  // (Protocol-Field-Compression can make it 1 octet, but the default and the
  // PPPoE-Session on-the-wire form is 2 octets.)
  headerBytes: () => 2,
  // Dispatch network-layer payloads to their dissectors; control protocols
  // (LCP/IPCP/PAP/CHAP/...) carry their own bodies and fall to node.payload.
  next: (h: ParsedHeader) => PROTOCOL_TO_ID[h.get('protocol')] ?? null,
};
