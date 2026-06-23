// IPv6 packet header. RFC 8200 (obsoletes RFC 2460).
// Traffic Class / Flow Label semantics: RFC 2474 (DiffServ), RFC 3168 (ECN),
// RFC 6437 (Flow Label). Next Header values come from the IANA Protocol Numbers
// registry, shared with IPv4. ICMPv6 is RFC 4443; extension headers are RFC 8200 §4.
import type { ProtocolSpec, BuildCtx } from '../core/types';

// Next Header -> human label. These are the values an IPv6 header commonly
// carries; the full set is the IANA "Assigned Internet Protocol Numbers" registry.
const NEXT_HEADER: Record<number, string> = {
  0: 'Hop-by-Hop Options',
  6: 'TCP',
  17: 'UDP',
  43: 'Routing',
  44: 'Fragment',
  58: 'ICMPv6',
  59: 'No Next Header',
  60: 'Destination Options',
};

// Only the values that select a child protocol we can dissect. Extension headers
// (0/43/44/60) and "No Next Header" (59) are NOT mapped: we model the 40-byte
// fixed header only, so an extension header would fall through as payload rather
// than be mis-parsed as an upper-layer protocol.
const NEXT_TO_ID: Record<number, string> = { 6: 'tcp', 17: 'udp', 33: 'dccp', 47: 'gre', 50: 'esp', 51: 'ah', 58: 'icmpv6', 89: 'ospf', 103: 'pim', 132: 'sctp' };
const ID_TO_NEXT: Record<string, number> = { tcp: 6, udp: 17, dccp: 33, esp: 50, ah: 51, icmpv6: 58, ospf: 89, pim: 103, sctp: 132 };

export const ipv6: ProtocolSpec = {
  id: 'ipv6',
  name: 'IPv6',
  layer: 3,
  summary: 'The next-generation network-layer packet: 128-bit addresses, a fixed 40-byte header, and a Next Header chain instead of IPv4 options.',
  fields: [
    {
      name: 'version',
      label: 'Version',
      bits: 4,
      note: '6 for IPv6.',
      desc: 'The IP version number. The value 6 (binary 0110) marks this as an IPv6 datagram; 4 marks IPv4. It is the very first nibble so a receiver can pick the right IP parser before reading anything else.',
      detail: `VERSION (4 bits): 0110 = IPv6 (RFC 8200).

It occupies the top nibble of the first byte. A dual-stack receiver reads just this nibble to decide whether to hand the packet to its IPv4 or IPv6 parser.

BIT LAYOUT of the first byte 0x60:
0110 0000
- Bits 7-4: 0110 = version 6
- Bits 3-0: 0000 = the top 4 bits of the 8-bit Traffic Class field (the rest of Traffic Class spills into the next byte)

WHY A NEW VERSION: IPv4's 32-bit address space (~4.3 billion) was exhausted; IPv6's 128-bit addresses (~3.4 x 10^38) remove that limit and the header was redesigned at the same time — fixed length, no per-hop checksum, extension headers instead of options.`,
    },
    {
      name: 'trafficClass',
      label: 'Traffic Class',
      bits: 8,
      type: 'hex',
      note: 'DSCP (6 bits) + ECN (2 bits) — same QoS byte as IPv4.',
      desc: 'An 8-bit QoS byte split into a 6-bit Differentiated Services Code Point (DSCP) and a 2-bit Explicit Congestion Notification (ECN) field, exactly like the equivalent byte in IPv4.',
      detail: `TRAFFIC CLASS (8 bits) is the IPv6 analogue of IPv4's DSCP+ECN byte:
- Top 6 bits = DSCP (RFC 2474): the forwarding class a router should apply (0 = best effort, 46/EF = Expedited Forwarding for VoIP, AF11..AF43 = Assured Forwarding).
- Low 2 bits = ECN (RFC 3168): 00 Not-ECT, 10/01 ECT, 11 CE (Congestion Experienced) — lets a router signal congestion by marking instead of dropping.

BIT SPREAD ACROSS BYTES: because Version takes the first 4 bits, Traffic Class straddles the byte boundary — its high 4 bits are the low nibble of byte 0 and its low 4 bits are the high nibble of byte 1.

LIKE IPv4: DSCP is only a request; ISPs often remark or ignore it at the edge, so markings are most dependable inside one administrative domain.`,
    },
    {
      name: 'flowLabel',
      label: 'Flow Label',
      bits: 20,
      type: 'hex',
      note: 'Tags a flow so routers can keep its packets on one path.',
      desc: 'A 20-bit label that, together with the source and destination addresses, identifies a flow. Routers can use it to keep all packets of a flow on the same path and to classify them without inspecting the upper-layer headers.',
      detail: `FLOW LABEL (20 bits, RFC 6437): a pseudo-random, non-zero value chosen by the source and held constant for the life of a flow. The 3-tuple (Flow Label, Source Address, Destination Address) names the flow.

WHY IT EXISTS:
- Lets routers do Equal-Cost Multi-Path (ECMP) hashing on a stable key without parsing TCP/UDP ports — important when the transport header is buried behind extension headers or encrypted (e.g. ESP).
- Keeps a flow's packets on one path, avoiding reordering.

RULES (RFC 6437):
- 0 means "no flow label" (default handling).
- A non-zero label must not change for the duration of the flow; routers must not modify it.
- It should be hard to guess (random) so it cannot be used to correlate or hijack flows.

This is an IPv6-only field — IPv4 has no equivalent.`,
    },
    {
      name: 'payloadLength',
      label: 'Payload Length',
      bits: 16,
      decode: (v) => `${v} bytes after the 40-byte header (extension headers + data)`,
      desc: 'The length, in bytes, of everything after the fixed 40-byte IPv6 header — that is, any extension headers plus the upper-layer payload. Unlike IPv4 Total Length, it does NOT count the IPv6 header itself.',
      detail: `PAYLOAD LENGTH (16 bits, RFC 8200): "Length of the IPv6 payload, i.e., the rest of the packet following this IPv6 header, in octets." It INCLUDES any extension headers but EXCLUDES the 40-byte base header.

CONTRAST WITH IPv4: IPv4 "Total Length" counts the IP header too; IPv6 "Payload Length" does not. So the whole packet on the wire is 40 + Payload Length bytes.

ZERO + JUMBOGRAMS: a value of 0 signals that the real length is carried in a Hop-by-Hop Jumbo Payload option (RFC 2675), allowing payloads larger than 65,535 bytes on links that support them.

This field is what bounds the payload so trailing link-layer padding does not leak in: the dissector uses 40 + Payload Length as the total PDU size.`,
    },
    {
      name: 'nextHeader',
      label: 'Next Header',
      bits: 8,
      type: 'enum',
      enumMap: NEXT_HEADER,
      note: 'Type of the header that follows: an upper-layer protocol or an extension header.',
      desc: 'Identifies the type of header immediately following the IPv6 header. It uses the same numbering as the IPv4 Protocol field, but in IPv6 it may point either to an upper-layer protocol (TCP 6, UDP 17, ICMPv6 58) or to an extension header that chains to another Next Header.',
      detail: `NEXT HEADER (8 bits, RFC 8200): same IANA Protocol Numbers as IPv4's Protocol field, with an added role — chaining extension headers.

UPPER-LAYER VALUES: 6 = TCP, 17 = UDP, 58 = ICMPv6 (RFC 4443).

EXTENSION-HEADER VALUES (each extension header carries its own Next Header, forming a chain processed in a recommended order):
- 0  = Hop-by-Hop Options (must be first; examined by every node)
- 43 = Routing
- 44 = Fragment (IPv6 hosts, not routers, fragment)
- 60 = Destination Options
- 51 = Authentication Header / 50 = ESP (IPsec)
- 59 = No Next Header (nothing follows)

WHY EXTENSIONS REPLACED OPTIONS: IPv4 crammed options into the header itself, which broke router fast paths. IPv6 moves them into separate, daisy-chained headers so the base header stays a fixed 40 bytes and most routers can skip straight to forwarding.

MODELLING NOTE: this spec parses only the fixed 40-byte header. For TCP/UDP/ICMPv6 it dispatches to that child; for an extension-header value (0/43/44/60) or 59 it stops and the rest is shown as raw payload rather than being mis-parsed.`,
    },
    {
      name: 'hopLimit',
      label: 'Hop Limit',
      bits: 8,
      decode: (v) => `${v} hops left before the packet is dropped`,
      desc: 'A hop counter decremented by 1 at each forwarding node. When it reaches 0 the packet is discarded and an ICMPv6 Time Exceeded message is returned. This is the IPv6 equivalent of the IPv4 TTL and stops routing loops.',
      detail: `HOP LIMIT (8 bits, RFC 8200): the renamed, clarified successor to IPv4's TTL. Each forwarding node decrements it by 1; a node that decrements it to 0 discards the packet and sends back ICMPv6 Time Exceeded (Type 3).

WHY THE RENAME: IPv4 "Time To Live" was originally meant as seconds but in practice was always a hop count, so IPv6 names it honestly.

COMMON INITIAL VALUES: 64 on most hosts (Linux, macOS, Android, iOS), 128 on Windows, 255 on many routers and for link-local protocols. Neighbor Discovery (RFC 4861) requires Hop Limit 255 on its messages so a receiver can prove they were not forwarded from off-link.

TRACEROUTE: the same trick as IPv4 — send probes with Hop Limit 1, 2, 3 ... each elicits a Time Exceeded from the next router, revealing the path.`,
    },
    {
      name: 'srcAddr',
      label: 'Source Address',
      bits: 128,
      type: 'ipv6',
      desc: 'The 128-bit IPv6 address of the sender. A host commonly has several (a link-local address plus one or more global addresses), and selects a source per RFC 6724.',
      detail: `SOURCE ADDRESS (128 bits): the originator. A single interface normally holds multiple addresses, and RFC 6724 governs which one is chosen for a given destination.

ADDRESS TYPES / PREFIXES:
- ::/128 = unspecified, ::1/128 = loopback
- fe80::/10 = link-local (auto-configured, never routed off-link)
- fc00::/7 = unique local (ULA, the rough IPv6 analogue of RFC 1918 private space)
- 2000::/3 = global unicast (the currently allocated public range)
- ff00::/8 = multicast (there is no broadcast in IPv6)
- 2001:db8::/32 = reserved for documentation (RFC 3849)

TEXT FORM (RFC 5952): groups of 16 bits in hex, leading zeros dropped, the single longest run of zero groups compressed to "::". So 2001:0db8:0000:0000:0000:0000:0000:0001 is written 2001:db8::1.

SLAAC: with Stateless Address Autoconfiguration a host forms an address from a router-advertised /64 prefix plus an interface identifier (often randomized per RFC 8981 for privacy).`,
    },
    {
      name: 'dstAddr',
      label: 'Destination Address',
      bits: 128,
      type: 'ipv6',
      desc: 'The 128-bit IPv6 address of the intended recipient. Each router uses it for a longest-prefix-match lookup to choose the next hop, just as in IPv4 — only with 128-bit prefixes.',
      detail: `DESTINATION ADDRESS (128 bits): drives forwarding. Routers do a longest-prefix-match lookup against their routing table to pick a next hop and outgoing interface; Neighbor Discovery (RFC 4861, the IPv6 replacement for ARP) then resolves the next hop to a link-layer address.

MULTICAST INSTEAD OF BROADCAST: IPv6 has no broadcast. "All nodes" is ff02::1 and "all routers" is ff02::2 (link-local scope). Neighbor Discovery uses solicited-node multicast (ff02::1:ff00:0/104) so only the relevant host's NIC is interrupted.

SCOPES: link-local traffic (fe80::/10) never leaves the link and often needs a zone/scope id (e.g. fe80::1%eth0) because the same link-local address can exist on every interface.

ROUTING: same longest-prefix-match logic as IPv4; the default route is ::/0. The global table is far smaller than IPv4's because allocations are more aggregated.`,
    },
  ],
  // The IPv6 base header is always exactly 40 bytes (RFC 8200 §3). Extension
  // headers, when present, are counted in Payload Length, not here.
  headerBytes: () => 40,
  // Payload Length counts only what follows the 40-byte header, so the whole PDU
  // is 40 + payloadLength. This bounds the payload and keeps link padding out.
  pduBytes: (h) => 40 + h.get('payloadLength'),
  // Dispatch on Next Header. Extension headers and "No Next Header" return null,
  // so the engine stops and the remainder is shown as raw payload.
  next: (h) => NEXT_TO_ID[h.get('nextHeader')] ?? null,
  // Build the fixed 40-byte header (version 6, no traffic class / flow label).
  encode: ({ payload, conn, childId }: BuildCtx) => {
    const nh = ID_TO_NEXT[childId ?? 'tcp'] ?? 59; // 59 = No Next Header
    const len = payload.length;
    return [0x60, 0x00, 0x00, 0x00, (len >> 8) & 255, len & 255, nh, conn.ttl & 255, ...conn.srcIp6, ...conn.dstIp6];
  },
};
