// ICMPv6 — Internet Control Message Protocol for IPv6.
// RFC 4443 (base protocol & message format), RFC 4861 (Neighbor Discovery types
// 133-137). Carried directly inside IPv6 with Next Header = 58.
//
// MODELLING NOTE: every ICMPv6 message starts with the same fixed 4-byte header
// (Type, Code, Checksum). What follows is a Message Body whose layout depends on
// the Type. RFC 4443 fixes the first 32 bits after the checksum per message kind
// (e.g. for Echo Request/Reply it is Identifier:16 + Sequence Number:16; for
// Packet Too Big it is the 32-bit MTU; for Destination Unreachable it is 32 bits
// of "unused"). We therefore model the 4-byte header plus that first 32-bit body
// word, and let everything after it fall through as payload. Fields that are
// type-specific (NDP options, the embedded packet in error messages, echo data)
// are intentionally NOT invented as fixed fields — they land in node.payload.
import type { ProtocolSpec } from '../core/types';

// RFC 4443 §3-4 + RFC 4861 §4. Types < 128 are errors, >= 128 are informational.
const ICMP6_TYPE: Record<number, string> = {
  1: 'Destination Unreachable',
  2: 'Packet Too Big',
  3: 'Time Exceeded',
  4: 'Parameter Problem',
  128: 'Echo Request',
  129: 'Echo Reply',
  133: 'Router Solicitation',
  134: 'Router Advertisement',
  135: 'Neighbor Solicitation',
  136: 'Neighbor Advertisement',
  137: 'Redirect',
};

export const icmpv6: ProtocolSpec = {
  id: 'icmpv6',
  name: 'ICMPv6',
  layer: 3,
  summary:
    'IPv6’s control-message protocol: errors (unreachable, too big, time exceeded), echo (ping6), and Neighbor Discovery. Sits in IPv6 Next Header 58.',
  fields: [
    {
      name: 'type',
      label: 'Type',
      bits: 8,
      type: 'enum',
      enumMap: ICMP6_TYPE,
      note: 'Message kind. 0-127 = error, 128-255 = informational.',
      desc: 'The 8-bit message type. It selects both the meaning of the Code field and the layout of everything after the checksum. Values 0-127 are error messages; 128-255 are informational (echo, Neighbor Discovery).',
      detail: `TYPE (8 bits) — the high bit splits the space cleanly (RFC 4443 §2.1):
- 0-127: ERROR messages (high bit 0). A host MUST NOT send an error in response to another error, to a multicast, or to a non-unique-source packet, which prevents storms.

ERROR TYPES:
- 1  Destination Unreachable (codes 0-6: no route, admin prohibited, beyond scope, address unreachable, port unreachable, ...)
- 2  Packet Too Big (the body carries the next-hop MTU; this is how IPv6 Path MTU Discovery works — there is no router fragmentation in IPv6)
- 3  Time Exceeded (code 0 = hop limit exceeded — the basis of traceroute6; code 1 = fragment reassembly timeout)
- 4  Parameter Problem (codes 0-2: erroneous header field, unrecognized Next Header, unrecognized option)

INFORMATIONAL TYPES:
- 128 Echo Request / 129 Echo Reply (ping6)
- 133-137 Neighbor Discovery (RFC 4861): Router Solicitation, Router Advertisement, Neighbor Solicitation, Neighbor Advertisement, Redirect

WHY ICMPv6 IS LOAD-BEARING: unlike ICMPv4, you cannot run IPv6 with ICMP blocked — NDP (which replaces ARP), SLAAC autoconfiguration, and PMTUD all depend on it. Blanket-dropping ICMPv6 breaks the network.`,
    },
    {
      name: 'code',
      label: 'Code',
      bits: 8,
      note: 'Sub-type within a Type; 0 when a Type has no sub-cases.',
      desc: 'An 8-bit refinement of the Type. For a given Type it distinguishes specific cases (e.g. Destination Unreachable code 4 = "port unreachable"). For Types that need no sub-case it is 0.',
      detail: `CODE (8 bits) is interpreted relative to Type:

Destination Unreachable (Type 1):
  0 = no route to destination
  1 = communication administratively prohibited
  2 = beyond scope of source address
  3 = address unreachable
  4 = port unreachable
  5 = source address failed ingress/egress policy
  6 = reject route to destination

Time Exceeded (Type 3):
  0 = hop limit exceeded in transit
  1 = fragment reassembly time exceeded

Parameter Problem (Type 4):
  0 = erroneous header field
  1 = unrecognized Next Header type
  2 = unrecognized IPv6 option

Packet Too Big (Type 2), Echo Request/Reply (128/129) and most NDP messages use Code 0.`,
    },
    {
      name: 'checksum',
      label: 'Checksum',
      bits: 16,
      type: 'hex',
      note: 'Covers an IPv6 pseudo-header (incl. the v6 addresses) and the whole ICMPv6 message.',
      desc: 'The 16-bit Internet checksum over an IPv6 pseudo-header plus the entire ICMPv6 message. Unlike IPv4/ICMPv4, this checksum includes the source and destination IPv6 addresses, binding the message to its endpoints.',
      detail: `ALGORITHM (RFC 4443 §2.3, using the RFC 1071 one's-complement sum):
1. Zero the checksum field.
2. Build the IPv6 pseudo-header: Source Address (16B) | Destination Address (16B) | Upper-Layer Packet Length (4B) | three zero bytes | Next Header = 58 (1B).
3. Sum the pseudo-header followed by the whole ICMPv6 message (type field onward, padded with a zero byte if odd length).
4. Take the one's complement of the folded sum.

KEY DIFFERENCE FROM ICMPv4: the ICMPv4 checksum covers only the ICMP message; the ICMPv6 checksum also covers the pseudo-header (including both 128-bit addresses). This is mandatory — IPv6 has no network-layer header checksum, so the transport/control layer must catch misdelivery.

VERIFICATION: summing the pseudo-header plus the message including the stored checksum yields 0xFFFF when intact.`,
    },
    {
      name: 'body',
      label: 'Message body (first word)',
      bits: 32,
      type: 'hex',
      note: 'Layout depends on Type: Echo = Identifier(16)+Sequence(16); Packet Too Big = MTU; errors = unused; NDP = flags/reserved.',
      desc: 'The first 32 bits after the checksum. Its meaning is decided by the Type field. Anything beyond these four bytes (echo data, the embedded packet in an error, NDP options) is the payload.',
      detail: `MESSAGE BODY (first 32-bit word) by Type:

ECHO REQUEST / REPLY (128/129):
  Identifier (16 bits)      — set by the sender so it can match replies to requests (often the PID)
  Sequence Number (16 bits) — incremented per ping; the rest of the message is the echo Data, returned verbatim.

PACKET TOO BIG (2):
  MTU (32 bits) — the next-hop link MTU. The sender uses it to lower its packet size (IPv6 PMTUD).

DESTINATION UNREACHABLE (1) / TIME EXCEEDED (3):
  Unused (32 bits, must be zero) — followed by as much of the offending packet as fits (for diagnostics).

PARAMETER PROBLEM (4):
  Pointer (32 bits) — byte offset of the error within the offending packet.

NEIGHBOR DISCOVERY (133-137, RFC 4861): this word holds per-type flags/reserved bits (e.g. Neighbor Advertisement's R/S/O flags + reserved), followed by a Target/Destination address and ND options. Those are not modelled as fixed fields here — they fall through as payload.`,
    },
  ],
  // The fixed header we model is 8 bytes (4-byte ICMPv6 header + the 32-bit body
  // word). There is no length field inside ICMPv6 itself — the IPv6 Payload
  // Length bounds it — so we provide no pduBytes. We stop dissecting here: the
  // remaining bytes (echo data / embedded packet / NDP options) are type-specific
  // and surface as node.payload.
  next: () => null,
};
