// IGMPv2 — Internet Group Management Protocol, Version 2. RFC 2236 (1997).
// IGMP lets IPv4 hosts tell their local multicast routers which multicast
// groups they want to receive. It is carried directly in IP (protocol number 2),
// sent with IP TTL 1 (link-local only) and the IP Router Alert option (RFC 2113).
//
// The IGMPv2 message is a fixed 8 bytes:
//   Type(8) | Max Resp Time(8) | Checksum(16) | Group Address(32)
//
// There is no payload above IGMP, so next() returns null (the message ends here).
import type { ProtocolSpec } from '../core/types';

// Type field values (RFC 2236 §2.1 and the IANA IGMP Type registry).
const TYPE: Record<number, string> = {
  0x11: 'Membership Query',
  0x12: 'Version 1 Membership Report',
  0x16: 'Version 2 Membership Report',
  0x17: 'Leave Group',
};

export const igmp: ProtocolSpec = {
  id: 'igmp',
  name: 'IGMPv2',
  layer: 3,
  summary: 'How an IPv4 host joins and leaves multicast groups: an 8-byte message inside IP protocol 2 that tells the local router "I want this group" (Report) or "I am done" (Leave).',
  fields: [
    {
      name: 'type',
      label: 'Type',
      bits: 8,
      type: 'enum',
      enumMap: TYPE,
      note: '0x11 Query, 0x16 v2 Report, 0x17 Leave, 0x12 v1 Report.',
      desc: 'Identifies the IGMP message. Routers send Membership Queries (0x11); hosts answer with Version 2 Membership Reports (0x16) to join/keep a group and send Leave Group (0x17) when they stop. 0x12 is the legacy Version 1 Report.',
      detail: `TYPE (8 bits, RFC 2236 §2.1):
- 0x11 Membership Query — sent by the elected Querier router. A General Query (Group Address 0) probes for all groups; a Group-Specific Query (Group Address set) probes one group, typically right after a Leave.
- 0x16 Version 2 Membership Report — a host announces it wants to receive a group. Reports are also sent in response to a Query.
- 0x17 Leave Group — a host signals it is leaving a group, sent to all-routers 224.0.0.2. This lets the router quickly stop forwarding instead of waiting for a Report to time out (the big latency win of v2 over v1).
- 0x12 Version 1 Membership Report — RFC 1112 format, kept for backward compatibility with v1 hosts.

REPORT SUPPRESSION: when a host sees another host's Report for a group it also belongs to, it cancels its own pending Report — the router only needs to know that at least one member exists on the segment, so duplicate Reports are suppressed.

OTHER IGMP TYPES (not part of RFC 2236, shown for context): 0x22 is the IGMPv3 Membership Report (RFC 3376), which adds source filtering.`,
    },
    {
      name: 'maxRespTime',
      label: 'Max Resp Time',
      bits: 8,
      decode: (v) => `${v} (${(v / 10).toFixed(1)} s max delay before a host replies)`,
      note: 'Units of 1/10 second. Meaningful only in Queries; zero elsewhere.',
      desc: 'In a Membership Query, the maximum time a host may wait before sending a responding Report, in units of 1/10 second. Hosts pick a random delay up to this value to spread Reports out. In Reports and Leaves this field is zero.',
      detail: `MAX RESPONSE TIME (8 bits, RFC 2236 §2.2):
"specifies the maximum allowed time before sending a responding report in units of 1/10 second. In all other messages, it is set to zero by the sender and ignored by receivers."

SPREADING OUT REPORTS: when a host receives a Query, it does not reply immediately. For each group it belongs to it starts a timer set to a random value between 0 and Max Resp Time. If it hears another host's Report for that group before its timer fires, it cancels (report suppression). This randomization prevents every host on a busy segment from answering a Query in the same instant.

DEFAULT: the default Query Response Interval is 100 (= 10.0 seconds). A router can tune responsiveness by lowering it.

RANGE: with 8 bits the field spans 0–255, i.e. 0 to 25.5 seconds. (IGMPv3 reinterprets large values with a floating-point encoding; IGMPv2 uses the value directly.)`,
    },
    {
      name: 'checksum',
      label: 'Checksum',
      bits: 16,
      type: 'hex',
      note: "One's-complement checksum over the whole 8-byte IGMP message.",
      desc: "The 16-bit one's-complement Internet checksum (RFC 1071) computed over the entire 8-byte IGMP message — the whole IP payload — with this field zeroed during the calculation.",
      detail: `CHECKSUM (16 bits, RFC 2236 §2.3):
"the 16-bit one's complement of the one's complement sum of the whole IGMP message (the entire IP payload). For computing the checksum, the checksum field is set to zero. When transmitting packets, the checksum MUST be computed and inserted into this field. When receiving packets, the checksum MUST be verified before processing a packet."

SCOPE: unlike TCP/UDP, IGMP's checksum covers ONLY the IGMP message itself — there is no pseudo-header, because IGMP is not addressed to a transport endpoint. The message is always 8 bytes (4 16-bit words), so no padding is needed.

VERIFICATION: summing all four 16-bit words including the checksum yields 0xFFFF (then complemented, 0x0000) when the message is intact — the same property as every Internet checksum.`,
    },
    {
      name: 'groupAddress',
      label: 'Group Address',
      bits: 32,
      type: 'ipv4',
      note: 'The multicast group (224.0.0.0/4). Zero in a General Query.',
      desc: 'The IPv4 multicast group (Class D, 224.0.0.0–239.255.255.255) the message concerns. In a Report or Leave it is the group being joined or left; in a General Query it is all-zeros; in a Group-Specific Query it is the group being probed.',
      detail: `GROUP ADDRESS (32 bits, RFC 2236 §2.4):
- In a General Query: set to zero (0.0.0.0) — the router is asking about every group.
- In a Group-Specific Query: the multicast group address being queried.
- In a Report: the multicast group the host is joining/maintaining.
- In a Leave: the multicast group the host is leaving.

MULTICAST ADDRESS SPACE (224.0.0.0/4, the old "Class D"):
- 224.0.0.0/24 — link-local control, never forwarded (TTL is effectively 1). Examples: 224.0.0.1 all-systems, 224.0.0.2 all-routers, 224.0.0.5/6 OSPF, 224.0.0.22 IGMPv3, 224.0.0.251 mDNS, 224.0.0.252 LLMNR.
- 224.0.1.0–238.255.255.255 — globally/ad-hoc scoped multicast.
- 239.0.0.0/8 — administratively scoped (private, like RFC 1918 for unicast).

L2 MAPPING: an IPv4 multicast group maps to a MAC address by placing the low 23 bits of the group into 01:00:5e:00:00:00. Because only 23 of the 28 group-id bits map, 32 different IPv4 groups share one MAC — a known source of multicast aliasing.

NOTE: IGMP signals interest to the local router; the actual multicast routing between routers is handled by separate protocols (PIM, etc.).`,
    },
  ],
  // Fixed 8-byte message — there is no encapsulated payload above IGMP.
  headerBytes: () => 8,
  next: () => null,
};
