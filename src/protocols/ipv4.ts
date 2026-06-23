// IPv4 packet header. RFC 791.
import type { ProtocolSpec, BuildCtx } from '../core/types';
import { inetChecksum } from '../core/checksum';

const PROTO: Record<number, string> = { 1: 'ICMP', 2: 'IGMP', 33: 'DCCP', 6: 'TCP', 17: 'UDP', 47: 'GRE', 50: 'ESP', 51: 'AH', 88: 'EIGRP', 89: 'OSPF', 103: 'PIM', 112: 'VRRP', 132: 'SCTP' };
const PROTO_TO_ID: Record<number, string> = { 1: 'icmp', 2: 'igmp', 33: 'dccp', 6: 'tcp', 17: 'udp', 47: 'gre', 50: 'esp', 51: 'ah', 88: 'eigrp', 89: 'ospf', 103: 'pim', 112: 'vrrp', 132: 'sctp' };
const ID_TO_PROTO: Record<string, number> = { icmp: 1, igmp: 2, dccp: 33, tcp: 6, udp: 17, gre: 47, esp: 50, ah: 51, eigrp: 88, ospf: 89, pim: 103, vrrp: 112, sctp: 132 };

export const ipv4: ProtocolSpec = {
  id: 'ipv4',
  name: 'IPv4',
  layer: 3,
  summary: 'The network-layer packet: source/destination IP, TTL, and which transport protocol is inside.',
  fields: [
    {
      name: 'version', label: 'Version', bits: 4, note: '4 for IPv4.',
      desc: 'The IP version number. The value 4 (binary 0100) marks this as an IPv4 datagram; 6 marks IPv6.',
      detail: `VERSION (4 bits): 0100 = IPv4 (RFC 791, 1981).

It is the very first nibble of the packet so a receiver can decide which IP parser to run before reading anything else.

BIT LAYOUT of the first byte 0x45:
0100 0101
- Bits 7-4: 0100 = version 4
- Bits 3-0: 0101 = IHL 5 (the next field)`,
    },
    {
      name: 'ihl', label: 'IHL', bits: 4, decode: (v) => `header is ${v * 4} bytes (${v} x 32-bit words)`,
      desc: 'Internet Header Length: the size of the IPv4 header in 32-bit words. 5 = 20 bytes (the minimum, no options); 15 = 60 bytes (the maximum).',
      detail: `IHL (4 bits): valid range 5-15, counted in 32-bit words.
- 5 = 20 bytes (no options) — the overwhelming majority of internet traffic
- 6 = 24 bytes (4 bytes of options)
- 15 = 60 bytes (max IPv4 header, 40 bytes of options)

WHY IHL EXISTS: IP options are variable-length, so without IHL the receiver could not tell where the options end and the payload begins.

IP OPTIONS (rare today):
- Loose/Strict Source Routing — sender specifies path routers
- Record Route — each router appends its IP (max ~9 entries due to the 40-byte options limit)
- Timestamp — routers append IP + timestamp
- Router Alert (RFC 2113) — routers must examine this packet

WHY RARE: options break the hardware fast path (forwarding ASICs expect fixed-size headers), so many routers slow-path, strip, or drop packets carrying them.`,
    },
    {
      name: 'dscp', label: 'DSCP', bits: 6, note: 'Differentiated services (QoS) class.',
      desc: 'Differentiated Services Code Point: a 6-bit QoS marker (values 0-63) that asks routers to give the packet a particular forwarding treatment.',
      detail: `DSCP (6 bits, values 0-63, RFC 2474 — replaces the old RFC 791 "Type of Service" / IP Precedence field):
- 0 = Default / Best Effort (no special treatment)
- 46 (0x2E) = Expedited Forwarding (EF, RFC 3246): low loss, latency, and jitter — used for VoIP
- AF11..AF43 (RFC 2597): Assured Forwarding — 4 classes x 3 drop precedences

REAL WORLD: DSCP is only a request. ISPs commonly remark or ignore it at the network edge unless you have a business SLA, so its markings are most reliable inside a single administrative domain (an enterprise: VoIP=EF, video=AF41, bulk transfers=default).

Together with the 2-bit ECN field, DSCP occupies the byte that RFC 791 originally called Type of Service.`,
    },
    {
      name: 'ecn', label: 'ECN', bits: 2, note: 'Explicit congestion notification.',
      desc: 'Explicit Congestion Notification: 2 bits that let a router signal congestion by marking a packet instead of dropping it.',
      detail: `ECN (2 bits, RFC 3168) — the low 2 bits of the byte whose top 6 bits are DSCP:
- 00 = Not-ECT (sender is not ECN-capable)
- 10 = ECT(0), 01 = ECT(1) — ECN-Capable Transport, no congestion yet
- 11 = CE (Congestion Experienced) — set by a router

HOW ECN WORKS WITH TCP:
1. Endpoints negotiate ECN during the handshake; the sender then marks data packets ECT.
2. A congested router flips ECT to CE (11) instead of dropping the packet.
3. The receiver sees CE and sets the ECE flag in its next TCP ACK.
4. The sender reduces its congestion window and replies with CWR — same back-off as a drop, but with no packet loss.

Note: ECE and CWR are TCP header flags, not IP fields — the IP layer only carries the 2-bit CE signal. ECN support is widely available but defaults differ: macOS negotiates ECN by default, while Linux by default only responds to a peer's ECN request (tcp_ecn=2) rather than initiating it.`,
    },
    {
      name: 'totalLength', label: 'Total length', bits: 16, decode: (v) => `${v} bytes including header and data`,
      desc: 'Total length of the entire IP datagram (header + payload) in bytes. Minimum 20, maximum 65,535.',
      detail: `Total Length counts the IPv4 header plus everything it carries (e.g. 20-byte IP header + 20-byte TCP header + payload). It does NOT include the Ethernet header or trailer.

MTU RELATIONSHIP: Ethernet's default MTU is 1500 bytes. A datagram larger than the path MTU must be fragmented (or, with DF set, dropped).

FRAGMENTATION EXAMPLE (a 4000-byte datagram across a 1500-byte MTU):
- Fragment 1: 1500B (20 IP + 1480 data), offset=0, MF=1
- Fragment 2: 1500B (20 IP + 1480 data), offset=185 (1480/8), MF=1
- Fragment 3: 1040B (20 IP + 1020 data), offset=370 (2960/8), MF=0

WHY FRAGMENTATION IS BAD: losing any one fragment forces the whole datagram to be retransmitted, and overlapping fragments can be used to evade firewalls.

PMTUD: modern TCP sets the DF flag; a router that would need to fragment instead drops the packet and returns ICMP "Fragmentation Needed", so the sender lowers its segment size.

JUMBO FRAMES: data-center links may use a 9000-byte MTU, cutting per-packet header overhead.

ENDIANNESS: 16-bit big-endian (network order). 0x0038 = 56 bytes.`,
    },
    {
      name: 'identification', label: 'Identification', bits: 16, type: 'hex', note: 'Groups fragments of one datagram.',
      desc: 'A 16-bit ID shared by all fragments of one datagram so the receiver can reassemble them. Only meaningful when a datagram may be fragmented.',
      detail: `PURPOSE: the receiver groups fragments of the same datagram by the tuple (Source IP, Destination IP, Protocol, Identification).

RFC 6864: the ID is only required to be unique (for a given src/dst/protocol) while the datagram could still be reassembled. For atomic datagrams (DF=1, not a fragment) the ID carries no meaning, so implementations may set it to 0 or any value.

RANDOMIZATION / PREDICTABILITY: a predictable, globally incrementing ID can leak information:
- Idle-scan / "counting" attacks infer how many packets a host has sent
- OS fingerprinting (the ID-generation policy differs across stacks)
- Forged-fragment injection is easier when the ID is guessable

16-BIT WRAP: with only 65,536 values, the ID space wraps quickly on a fast flow — fine for reassembly within the short reassembly timeout, but a reason meaningful IDs are reserved for traffic that can actually be fragmented.`,
    },
    {
      name: 'flags', label: 'Flags', bits: 3, type: 'flags', flagBits: ['Reserved', 'DF', 'MF'], note: "DF = don't fragment, MF = more fragments.",
      desc: "Three control bits: bit 0 reserved (0), DF = Don't Fragment, MF = More Fragments. They govern whether and how a datagram may be fragmented.",
      detail: `BIT LAYOUT (the high 3 bits of the 16-bit flags+offset word, MSB first):
- Bit 15: Reserved — must be 0
- Bit 14: DF (Don't Fragment)
- Bit 13: MF (More Fragments)

DF FLAG: 1 = the datagram must not be fragmented. A router that would otherwise fragment drops it and returns ICMP Type 3 Code 4 ("Fragmentation Needed and DF Set"). This is the mechanism behind Path MTU Discovery, and virtually all modern TCP traffic sets DF=1.

MF FLAG: 0 = this is the last fragment (or the datagram was never fragmented); 1 = more fragments follow.

OUR VALUE 0x4000 (the full flags+offset word): DF=1, MF=0, Offset=0 — an unfragmented datagram that must not be fragmented.`,
    },
    {
      name: 'fragmentOffset', label: 'Fragment offset', bits: 13, note: 'Where this fragment sits in the original datagram.',
      desc: 'Position of this fragment within the original datagram, measured in 8-byte units. 0 for the first (or only) fragment.',
      detail: `FRAGMENT OFFSET (13 bits): the byte position of this fragment's payload within the original datagram, expressed in 8-byte units. The 8-byte granularity lets 13 bits address the full 65,535-byte datagram: max offset 8191 x 8 = 65,528 bytes. Because of this, every fragment except the last must carry a payload that is a multiple of 8 bytes.

REASSEMBLY: the receiver places each fragment by offset; fragments may arrive out of order. A reassembly timer (commonly ~30-60 s) starts on the first arriving fragment, and the partial datagram is discarded if it expires. Handling of overlapping fragments is implementation-defined, which is itself a security concern (overlap attacks rewrite earlier bytes to slip past inspection).

PING OF DEATH (historical): fragments crafted so the reassembled datagram exceeds 65,535 bytes crashed old stacks; fixed in mainstream OSes by the late 1990s.`,
    },
    {
      name: 'ttl', label: 'TTL', bits: 8, decode: (v) => `${v} hops left before the packet is dropped`,
      desc: 'Time To Live: a hop counter decremented by 1 at each router. When it reaches 0 the packet is dropped and ICMP Time Exceeded is returned, which stops routing loops.',
      detail: `Each router decrements TTL by 1; a router that decrements it to 0 discards the packet and sends back ICMP Time Exceeded (Type 11).

TRACEROUTE MECHANISM:
1. Send a probe with TTL=1 -> the first router drops it and returns Time Exceeded, revealing hop 1.
2. Send TTL=2 -> reveals hop 2.
3. Continue until the destination itself replies.

COMMON INITIAL VALUES (useful for OS fingerprinting):
- Linux / Android / macOS / iOS: 64
- Windows: 128
- Many routers (Cisco/Juniper) and some stacks: 255

HOP ESTIMATION: an observed TTL of 52 with a likely initial 64 implies ~12 hops (rough, since initial values vary).

INCREMENTAL CHECKSUM UPDATE: because only TTL (and the checksum) change at a hop, a router adjusts the header checksum incrementally (RFC 1624) rather than recomputing it from scratch — essential for line-rate forwarding.`,
    },
    {
      name: 'protocol', label: 'Protocol', bits: 8, type: 'enum', enumMap: PROTO, note: 'Which transport protocol is inside.',
      desc: 'Identifies the protocol carried in the payload so IP can hand it to the right next-layer handler. 1 = ICMP, 6 = TCP, 17 = UDP.',
      detail: `COMMON VALUES (IANA Protocol Numbers registry):
1=ICMP | 2=IGMP | 6=TCP | 17=UDP | 41=IPv6-in-IPv4
47=GRE | 50=ESP (IPsec) | 51=AH (IPsec) | 89=OSPF | 112=VRRP

KERNEL DISPATCH: the value selects the receive handler — 6 -> TCP, 17 -> UDP, 1 -> ICMP.

SECURITY NOTE: blanket-blocking protocol 1 (ICMP) breaks Path MTU Discovery, because the router's "Fragmentation Needed" message can no longer get back to the sender — connections then black-hole and TCP stalls on large packets.

IANA REGISTRY: iana.org/assignments/protocol-numbers. Values 253-254 are reserved for experimentation, 255 is reserved.`,
    },
    {
      name: 'headerChecksum', label: 'Header checksum', bits: 16, type: 'hex', note: 'Covers the IPv4 header only.',
      desc: "Internet checksum (one's-complement sum) over the IPv4 header only — not the payload. Every router must recompute it because the TTL it covers changes each hop.",
      detail: `ALGORITHM (RFC 1071):
1. Set the Checksum field to 0x0000.
2. Sum every 16-bit word of the header into a 32-bit accumulator.
3. Fold the carries: while (sum >> 16) sum = (sum & 0xFFFF) + (sum >> 16).
4. Take the one's complement: result = ~sum & 0xFFFF.

VERIFICATION: summing all header words including the checksum yields 0xFFFF when the header is intact.

WHY ONLY THE HEADER: TCP and UDP carry their own end-to-end checksums (which also cover the payload), so duplicating that coverage in IP would be wasteful.

PER-HOP UPDATE: routers use incremental update (RFC 1624) when they change only the TTL, rather than recomputing over the whole header.

IPv6: has NO header checksum at all — the rationale is that the link layer (e.g. Ethernet CRC) and the transport checksums already catch errors, and dropping it speeds forwarding.

WEAKNESS: a one's-complement sum is fast but can miss certain patterns (e.g. a 16-bit word swap), which is why it is a header integrity check, not a strong error-correcting code.`,
    },
    {
      name: 'srcIp', label: 'Source IP', bits: 32, type: 'ipv4',
      desc: 'The 32-bit IPv4 address of the sender. Used for routing the reply and for anti-spoofing (reverse-path) checks.',
      detail: `CIDR REPLACED CLASSES: the old Class A/B/C scheme is obsolete; addresses now use an explicit prefix length (e.g. 192.168.1.0/24).

PRIVATE RANGES (RFC 1918, not routable on the public internet):
- 10.0.0.0/8
- 172.16.0.0/12
- 192.168.0.0/16

SPECIAL ADDRESSES: 0.0.0.0 = "this host"/unspecified, 127.0.0.0/8 = loopback (127.0.0.1), 169.254.0.0/16 = link-local (APIPA), 255.255.255.255 = limited broadcast.

DOCUMENTATION TEST-NETs (RFC 5737): 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24.

NAT: SNAT rewrites the source (home routers sharing one public IP); NAPT additionally rewrites ports so many hosts share one address.

uRPF (Unicast Reverse Path Forwarding): the router asks "would I route back TO this source out the interface it arrived on?" If not, it drops the packet — a defense against address spoofing.`,
    },
    {
      name: 'dstIp', label: 'Destination IP', bits: 32, type: 'ipv4',
      desc: 'The 32-bit IPv4 address of the intended recipient. Each router uses it for a longest-prefix-match lookup to pick the next hop.',
      detail: `ROUTING DECISION:
1. Look up the destination in the routing table, choosing the LONGEST matching prefix.
2. If both 10.0.0.0/8 and 10.1.0.0/16 match 10.1.2.3, the /16 wins (it is more specific).
3. The chosen entry gives a next-hop IP and an outgoing interface.
4. ARP resolves that next-hop IP to a MAC address.

TABLE SOURCES (typical preference): directly connected routes > static routes > dynamic routes (OSPF/BGP/RIP). The default route 0.0.0.0/0 is the catch-all when nothing more specific matches.

BGP: the internet's inter-domain routing protocol; a full table carries on the order of a million prefixes today, and best-path selection weighs attributes such as LOCAL_PREF, AS_PATH length, and MED.

LOCAL VS. REMOTE DELIVERY: if the destination is on a directly connected subnet, the host ARPs for the destination's MAC; otherwise it ARPs for the gateway's MAC and sends there.`,
    },
  ],
  headerBytes: (h) => h.get('ihl') * 4,
  pduBytes: (h) => h.get('totalLength'),
  next: (h) => PROTO_TO_ID[h.get('protocol')] ?? null,
  encode: ({ payload, conn, childId }: BuildCtx) => {
    const total = 20 + payload.length;
    const proto = ID_TO_PROTO[childId ?? 'tcp'] ?? 6;
    const hdr = [
      0x45, 0x00, (total >> 8) & 255, total & 255,
      0x43, 0x21, 0x40, 0x00, conn.ttl, proto, 0x00, 0x00,
      ...conn.srcIp, ...conn.dstIp,
    ];
    const ck = inetChecksum(hdr);
    hdr[10] = (ck >> 8) & 255; hdr[11] = ck & 255;
    return hdr;
  },
};
