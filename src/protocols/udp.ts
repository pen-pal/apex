// UDP datagram header. RFC 768 (User Datagram Protocol, 1980).
// The checksum's pseudo-header (src/dst IP, protocol, UDP length) is defined by
// RFC 768 and refined for IPv6 by RFC 8200 §8.1 / RFC 2460.
import type { ProtocolSpec, BuildCtx } from '../core/types';
import { inetChecksum } from '../core/checksum';

// Destination-port -> child protocol id. UDP demultiplexes purely on port; there
// is no "next protocol" field in the header, so the well-known port stands in.
const PORT_TO_ID: Record<number, string> = {
  53: 'dns', // Domain Name System (RFC 1035)
  67: 'dhcp', // DHCP server port (BOOTP, RFC 2131)
  68: 'dhcp', // DHCP client port (BOOTP, RFC 2131)
  69: 'tftp', // Trivial File Transfer (RFC 1350)
  123: 'ntp', // Network Time Protocol (RFC 5905)
  88: 'kerberos', // Kerberos (RFC 4120)
  111: 'sunrpc', // ONC/Sun RPC portmapper (RFC 5531)
  137: 'nbns', // NetBIOS Name Service (RFC 1002)
  161: 'snmp', // SNMP (RFC 1157)
  319: 'ptp', // PTP event messages (IEEE 1588)
  320: 'ptp', // PTP general messages (IEEE 1588)
  500: 'isakmp', // IKE / ISAKMP (RFC 7296)
  514: 'syslog', // Syslog (RFC 5424)
  520: 'rip', // RIP (RFC 2453)
  1701: 'l2tp', // L2TP (RFC 2661)
  1985: 'hsrp', // HSRP (RFC 2281)
  546: 'dhcpv6', // DHCPv6 client (RFC 8415)
  547: 'dhcpv6', // DHCPv6 server (RFC 8415)
  1812: 'radius', // RADIUS authentication (RFC 2865)
  1900: 'ssdp', // SSDP / UPnP discovery
  2055: 'netflow', // NetFlow v5 export
  3784: 'bfd', // BFD (RFC 5880)
  6081: 'geneve', // Geneve overlay (RFC 8926)
  2152: 'gtp', // GTP-U mobile user plane (3GPP TS 29.281)
  3478: 'stun', // STUN NAT traversal (RFC 8489)
  4789: 'vxlan', // VXLAN overlay (RFC 7348)
  5060: 'sip', // Session Initiation Protocol (RFC 3261)
  5353: 'dns', // mDNS — multicast DNS reuses the DNS message format (RFC 6762)
  5355: 'llmnr', // LLMNR (RFC 4795)
  5683: 'coap', // CoAP (RFC 7252)
  20000: 'dnp3', // DNP3 SCADA (IEEE 1815)
  47808: 'bacnet', // BACnet/IP (ASHRAE 135)
  51820: 'wireguard', // WireGuard VPN
  443: 'quic', // QUIC / HTTP-3 (RFC 9000)
};

export const udp: ProtocolSpec = {
  id: 'udp',
  name: 'UDP',
  layer: 4,
  summary: 'The connectionless transport datagram: just ports, a length, and a checksum — no handshake, no ordering, no retransmission.',
  fields: [
    {
      name: 'srcPort',
      label: 'Source port',
      bits: 16,
      desc: 'The 16-bit port of the sending application. RFC 768 makes it optional: when no reply is expected it may be sent as zero, which means "no source port / no reply wanted."',
      detail: `SOURCE PORT (16 bits, optional per RFC 768):
- When meaningful it is "the port of the sending process, and may be assumed to be the port to which a reply should be addressed in the absence of any other information."
- A value of 0 means the sender expects no reply; a receiver that needs to answer must learn the address some other way.

EPHEMERAL PORTS: like TCP, clients usually use an OS-assigned ephemeral port for the source. IANA suggests 49152-65535; Linux defaults to 32768-60999.

THE 4-TUPLE: although UDP has no connections, the kernel still demultiplexes datagrams using (SrcIP, SrcPort, DstIP, DstPort) so a connect()-ed UDP socket only receives from its peer.

ENDIANNESS: 16-bit big-endian (network order).`,
    },
    {
      name: 'dstPort',
      label: 'Destination port',
      bits: 16,
      decode: (v) => (PORT_TO_ID[v] ? `${v} (${PORT_TO_ID[v].toUpperCase()})` : String(v)),
      desc: 'The 16-bit port identifying the receiving application. The OS uses it to find the bound UDP socket that should receive this datagram; there is no "next protocol" field, so the port alone selects the upper layer.',
      detail: `DESTINATION PORT (16 bits): "has a meaning within the context of a particular internet destination address." It is how a host decides which socket — and therefore which application protocol — receives the datagram.

WELL-KNOWN UDP PORTS:
53=DNS | 67/68=DHCP (server/client) | 69=TFTP | 123=NTP
161/162=SNMP | 443=QUIC/HTTP-3 | 500=IKE | 514=syslog
1194=OpenVPN | 4789=VXLAN | 51820=WireGuard

NO MATCHING SOCKET: if nothing is listening, the host typically returns ICMP Port Unreachable (Type 3, Code 3) rather than a UDP-level reset (UDP has no RST).

DISPATCH IN THIS MODEL: UDP carries no protocol-type field, so the dissector maps the destination port to the child protocol (53->DNS, 67/68->DHCP, 443->QUIC). This is a heuristic — any port can in principle carry any payload.`,
    },
    {
      name: 'length',
      label: 'Length',
      bits: 16,
      decode: (v) => `${v} bytes (8-byte header + ${v - 8} bytes data)`,
      desc: 'The length in octets of the whole datagram — the 8-byte UDP header plus the data. The minimum legal value is 8 (header only, empty payload).',
      detail: `LENGTH (16 bits): "the length in octets of this user datagram including this header and the data. (This means the minimum value of the length is eight.)"

BOUNDS THE PAYLOAD: subtract 8 to get the data length. The dissector uses this to stop the payload exactly at Length, so trailing Ethernet padding or FCS cannot leak in.

REDUNDANT WITH IP: the IPv4 Total Length already implies the UDP payload size, so the UDP Length is partly redundant — but it makes UDP self-describing independent of the IP header.

THEORETICAL MAX vs REALITY: the 16-bit field caps a single datagram at 65,535 bytes (65,527 of data). IPv6 jumbograms (RFC 2675) allow a UDP Length of 0 to mean "use the IPv6 jumbo payload length" for datagrams larger than 65,535 bytes.

FRAGMENTATION: a UDP datagram larger than the path MTU is fragmented by IP, and losing any fragment loses the whole datagram (UDP never retransmits).`,
    },
    {
      name: 'checksum',
      label: 'Checksum',
      bits: 16,
      type: 'hex',
      note: 'Covers a pseudo-header (the IPs), the UDP header, and the data. 0x0000 means "not computed" in IPv4.',
      desc: 'A 16-bit ones-complement Internet checksum over a pseudo-header (source/dest IP, protocol, UDP length), the UDP header, and the data. Including the IPs binds the datagram to its endpoints.',
      detail: `ALGORITHM (RFC 768, same one's-complement sum as RFC 1071):
checksum = ~( sum of 16-bit words of [ pseudo-header + UDP header + data ] )
The data is conceptually padded with a trailing zero byte to an even length for the sum.

PSEUDO-HEADER (12 bytes, included in the sum but never transmitted):
- Source IP (4B) | Destination IP (4B) | Zero (1B) | Protocol = 17 (1B) | UDP Length (2B)
Folding the IPs in catches a misdelivered datagram (NAT/routing bug) at the receiver.

ZERO CHECKSUM — A SPECIAL CASE:
- "If the computed checksum is zero, it is transmitted as all ones (the equivalent in one's complement arithmetic)." So a genuine result of 0x0000 is sent as 0xFFFF.
- "An all zero transmitted checksum value means that the transmitter generated no checksum." In IPv4 the UDP checksum is therefore OPTIONAL — 0x0000 = "not computed."

IPv6 DIFFERENCE: IPv6 has no network-layer checksum, so the UDP checksum is MANDATORY there; a 0x0000 result is still sent as 0xFFFF and an actually-absent checksum (0x0000) is illegal — except for UDP-Lite and specific tunnels (RFC 6935/6936).`,
    },
  ],
  // The header is a fixed 8 bytes; the Length field bounds the whole PDU.
  headerBytes: () => 8,
  pduBytes: (h) => h.get('length'),
  // UDP has no protocol-type field: dispatch on the well-known destination port.
  next: (h) => PORT_TO_ID[h.get('dstPort')] ?? null,
  // Build the 8-byte header with a real checksum over the IPv4 or IPv6 pseudo-header.
  encode: ({ payload, conn, network }: BuildCtx) => {
    const len = 8 + payload.length;
    const hdr = [
      (conn.srcPort >> 8) & 255, conn.srcPort & 255, (conn.dstPort >> 8) & 255, conn.dstPort & 255,
      (len >> 8) & 255, len & 255, 0x00, 0x00,
    ];
    // IPv6 pseudo-header (RFC 8200 §8.1): src(16) dst(16) upper-len(4) zeros(3) next-header(1).
    // IPv4 pseudo-header (RFC 768): src(4) dst(4) zero(1) protocol(1) length(2).
    const pseudo = network === 'ipv6'
      ? [...conn.srcIp6, ...conn.dstIp6, (len >>> 24) & 255, (len >>> 16) & 255, (len >> 8) & 255, len & 255, 0, 0, 0, 17]
      : [...conn.srcIp, ...conn.dstIp, 0, 17, (len >> 8) & 255, len & 255];
    let ck = inetChecksum([...pseudo, ...hdr, ...payload]);
    if (ck === 0) ck = 0xffff; // RFC 768: a computed 0 is transmitted as all-ones
    hdr[6] = (ck >> 8) & 255; hdr[7] = ck & 255;
    return hdr;
  },
};
