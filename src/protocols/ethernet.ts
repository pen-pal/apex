// Ethernet II frame header. RFC 894 / IEEE 802.3.
// NOTE: the 4-byte FCS is a TRAILER over the whole frame, not part of this
// header; the builder computes it and the engine reports trailing bytes.
import type { ProtocolSpec, BuildCtx, ParsedHeader } from '../core/types';

const ETHERTYPES: Record<number, string> = {
  0x0800: 'IPv4', 0x0806: 'ARP', 0x8100: '802.1Q VLAN', 0x86dd: 'IPv6',
  0x8035: 'RARP', 0x8847: 'MPLS unicast', 0x8848: 'MPLS multicast',
  0x8863: 'PPPoE Discovery', 0x8864: 'PPPoE Session', 0x888e: '802.1X (EAPOL)', 0x88cc: 'LLDP',
};
const ETHERTYPE_TO_ID: Record<number, string> = {
  0x0800: 'ipv4', 0x0806: 'arp', 0x8035: 'rarp', 0x8100: 'vlan', 0x86dd: 'ipv6', 0x8847: 'mpls', 0x8848: 'mpls',
  0x8863: 'pppoe', 0x8864: 'pppoe', 0x888e: 'eapol', 0x88cc: 'lldp',
};
const ID_TO_ETHERTYPE: Record<string, number> = {
  ipv4: 0x0800, arp: 0x0806, rarp: 0x8035, vlan: 0x8100, ipv6: 0x86dd, mpls: 0x8847, pppoe: 0x8864, eapol: 0x888e, lldp: 0x88cc,
};

export const ethernet: ProtocolSpec = {
  id: 'ethernet',
  name: 'Ethernet II',
  layer: 2,
  summary: 'The link-layer frame: who (MAC addresses) and what kind of payload is inside (EtherType).',
  fields: [
    {
      name: 'dstMac', label: 'Destination MAC', bits: 48, type: 'mac', note: 'Hardware address of the next hop on this link.',
      desc: 'The 48-bit hardware address of the frame\'s intended recipient on this link. Switches use it to forward the frame toward the correct physical port.',
      detail: `WHY IT EXISTS: At Layer 2 there is no concept of IP addresses. NICs only understand MAC addresses, so the frame must name its destination in hardware terms.

STRUCTURE: 48 bits = 6 bytes (AA:BB:CC:DD:EE:FF)
- Bytes 0-2: OUI (Organizationally Unique Identifier) assigned by IEEE to manufacturers
- Bytes 3-5: Device-specific, assigned by the manufacturer

SPECIAL ADDRESSES:
- FF:FF:FF:FF:FF:FF — Broadcast (every NIC on the segment accepts)
- 01:00:5E:xx:xx:xx — IPv4 multicast mapping
- 33:33:xx:xx:xx:xx — IPv6 multicast mapping

FIRST BYTE BITS (the two low-order bits of byte 0):
- Bit 0 (LSB), the I/G bit = 0 unicast, 1 group/multicast (broadcast is the all-ones multicast)
- Bit 1, the U/L bit = 0 universally administered (burned-in OUI), 1 locally administered (overridden/spoofed)

SECURITY: MAC flooding attacks overwhelm a switch's CAM table; once full, the switch fails open and floods frames out all ports, enabling sniffing.`
    },
    {
      name: 'srcMac', label: 'Source MAC', bits: 48, type: 'mac', note: 'Hardware address of the sender on this link.',
      desc: 'The 48-bit hardware address of the sender. Switches learn MAC-to-port mappings by reading source addresses off incoming frames.',
      detail: `LEARNING PROCESS:
1. A frame arrives on port 3 with src MAC AA:BB...
2. The switch records "AA:BB... -> port 3" in its CAM table (with an aging timer, often ~5 min)
3. The switch looks up the destination MAC in the table
4. Found -> forward only out that one port
5. Not found -> flood out all ports except the arrival port

REAL WORLD: Your phone's MAC is visible to every device on the same WiFi, which historically let venues track movement. iOS and Android now randomize the MAC per network to mitigate this.

SECURITY: ARP poisoning works because the src MAC in an ARP reply is trusted without verification. Dynamic ARP Inspection (DAI) on managed switches counters it.`
    },
    {
      name: 'etherType', label: 'EtherType', bits: 16, type: 'enum', enumMap: ETHERTYPES, note: 'Which protocol is inside the frame.',
      desc: 'A 16-bit identifier telling the receiving NIC which protocol is encapsulated in the frame payload, so it can hand the bytes to the right Layer 3 handler.',
      detail: `COMMON VALUES:
0x0800 = IPv4 | 0x86DD = IPv6 | 0x0806 = ARP
0x8100 = 802.1Q VLAN tag | 0x8847 = MPLS unicast | 0x888E = 802.1X (EAPoL)

EDGE CASE: This same 2-byte field doubles as a length indicator. If the value is <= 1500 (0x05DC) it is NOT an EtherType but an IEEE 802.3 Length field; the upper-layer protocol is then identified by DSAP/SSAP in an 802.2 LLC header. Values >= 1536 (0x0600) are EtherTypes. Modern networks almost always use Ethernet II (DIX) framing.`
    },
  ],
  headerBytes: () => 14,
  next: (h: ParsedHeader) => ETHERTYPE_TO_ID[h.get('etherType')] ?? null,
  encode: ({ conn, childId }: BuildCtx) => {
    const et = ID_TO_ETHERTYPE[childId ?? 'ipv4'] ?? 0x0800;
    return [...conn.dstMac, ...conn.srcMac, (et >> 8) & 0xff, et & 0xff];
  },
};
