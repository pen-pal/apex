// IEEE 802.1Q — Virtual LAN tag (and 802.1p priority).
// Standard: IEEE Std 802.1Q (VLAN tagging); the 3-bit priority and its
// recommended traffic-class mapping come from the work originally known as
// IEEE 802.1p, now folded into 802.1Q (see 802.1Q-2014 Table I-2). DEI was
// formerly the Canonical Format Indicator (CFI) in the original 802.1Q-1998.
//
// WHERE THIS LAYER SITS
// ---------------------
// An 802.1Q tag is inserted into an Ethernet II frame between the Source MAC and
// the (original) EtherType. The full on-the-wire tag is 4 bytes:
//
//   +----------------+--------------------------------+
//   |  TPID (16b)    |  TCI (16b) = PCP|DEI|VID        |
//   |   0x8100       |  3b  | 1b |     12b            |
//   +----------------+--------------------------------+
//
// The TPID (0x8100) is what a NIC reads as the Ethernet "EtherType" to recognise
// a tagged frame, so in Apex's encapsulation it has ALREADY been consumed as the
// Ethernet EtherType. This spec therefore models the bytes that follow that
// recognition: the 2-byte TCI (PCP/DEI/VID) plus the 2-byte INNER EtherType that
// names the real Layer-3 payload (IPv4/IPv6/ARP/...). Header = 4 bytes total.
//
// After the inner EtherType, dispatch proceeds exactly like Ethernet:
//   0x0800 -> ipv4, 0x86DD -> ipv6, 0x0806 -> arp.
//
// NESTED TAGS (Q-in-Q, 802.1ad): a provider can stack an outer "service" tag
// (S-TAG, TPID 0x88A8) over a customer tag (C-TAG, 0x8100). We model the single
// 802.1Q C-TAG here; a stacked tag would simply be another tagged layer.
import type { ProtocolSpec, ParsedHeader } from '../core/types';

// Inner EtherType -> child protocol id (same demux table as Ethernet II).
const ETHERTYPES: Record<number, string> = { 0x0800: 'IPv4', 0x0806: 'ARP', 0x86dd: 'IPv6' };
const ETHERTYPE_TO_ID: Record<number, string> = { 0x0800: 'ipv4', 0x0806: 'arp', 0x86dd: 'ipv6' };

// IEEE 802.1Q recommended PCP -> traffic type (the 802.1p priorities). Note the
// non-monotonic mapping: priority 0 (Best Effort) outranks priority 1
// (Background), a historical artifact preserved by the standard.
const PCP_NAMES: Record<number, string> = {
  0: 'Best Effort (BE)',
  1: 'Background (BK)',
  2: 'Excellent Effort (EE)',
  3: 'Critical Applications (CA)',
  4: 'Video, < 100 ms latency (VI)',
  5: 'Voice, < 10 ms latency (VO)',
  6: 'Internetwork Control (IC)',
  7: 'Network Control (NC)',
};

export const vlan: ProtocolSpec = {
  id: 'vlan',
  name: '802.1Q VLAN',
  layer: 2,
  summary:
    'A 4-byte tag that slips into an Ethernet frame to mark which virtual LAN it belongs to (VID) and how urgent it is (PCP). The 0x8100 TPID is read as the Ethernet EtherType to spot a tagged frame; this layer then carries the priority/VLAN bits and the inner EtherType that names the real payload.',
  fields: [
    {
      name: 'pcp',
      label: 'Priority (PCP)',
      bits: 3,
      type: 'enum',
      enumMap: PCP_NAMES,
      note: '802.1p class of service, 0-7. Higher generally means more urgent (but 0 outranks 1).',
      desc: 'Priority Code Point: a 3-bit class-of-service value (0-7) carried in the top 3 bits of the TCI. It is the original IEEE 802.1p priority and lets a switch queue or schedule the frame ahead of lower-priority traffic during congestion.',
      detail: `PCP (3 bits, MSB-first, top of the 16-bit TCI) — IEEE 802.1p class of service.

RECOMMENDED MAPPING (IEEE 802.1Q, the 802.1p traffic types):
0 = Best Effort (BE)            <- the DEFAULT, and it OUTRANKS priority 1
1 = Background (BK)             <- LOWEST priority (bulk transfers, backups)
2 = Excellent Effort (EE)
3 = Critical Applications (CA)
4 = Video  (target latency < 100 ms)
5 = Voice  (target latency < 10 ms)
6 = Internetwork Control (IC)
7 = Network Control (NC)        <- HIGHEST

THE 0-vs-1 QUIRK: the numeric value is NOT a straight priority. The standard
deliberately ranks priority 0 (Best Effort, the default for untagged-equivalent
traffic) ABOVE priority 1 (Background). So an unmarked default flow is not the
lowest — Background is. Everything 2 and up follows numeric order.

QUEUE MAPPING: PCP selects a "traffic class" (egress queue) on the switch. A
switch with N queues maps the 8 priorities down to N per a configurable table
(IEEE 802.1Q recommends specific 1..8-queue mappings). This is purely a Layer-2
hint within a tagged domain; it is independent of (and often mirrored to/from)
the IP DSCP field for end-to-end QoS.`,
    },
    {
      name: 'dei',
      label: 'Drop Eligible (DEI)',
      bits: 1,
      type: 'flags',
      flagBits: ['DEI'],
      note: 'Formerly CFI. 1 = this frame may be dropped first under congestion.',
      desc: 'Drop Eligible Indicator: a single bit that, possibly together with PCP, marks the frame as a preferred candidate to discard when a queue is congested. It was the Canonical Format Indicator (CFI) in the original 802.1Q.',
      detail: `DEI (1 bit) — Drop Eligible Indicator (IEEE 802.1Q; renamed from CFI).

MEANING:
- 0 = not drop-eligible (treat normally).
- 1 = drop-eligible: when a queue fills, the switch should discard DEI=1 frames
  of a given priority before DEI=0 frames of the same priority.

USE: it is the colour bit of a metering/policing scheme. A policer can mark
in-profile traffic DEI=0 ("green") and out-of-profile traffic DEI=1 ("yellow"),
so excess traffic is shed first while conforming traffic is protected.

HISTORY — CFI: in the original 802.1Q (1998) this bit was the Canonical Format
Indicator. On Ethernet it was effectively always 0 (canonical/little-endian MAC
bit order); a 1 indicated a non-canonical address or that a Token Ring frame was
embedded (via an Embedded RIF). 802.1Q later repurposed the always-0 bit as DEI.`,
    },
    {
      name: 'vid',
      label: 'VLAN ID (VID)',
      bits: 12,
      note: 'Which virtual LAN, 0-4095. 0 = priority-only tag, 4095 = reserved.',
      desc: 'VLAN Identifier: a 12-bit number (0-4095) naming the virtual LAN this frame belongs to. Switches keep VLANs logically isolated, so a frame tagged VID 10 is delivered only within VLAN 10 even though many VLANs share the same physical wire.',
      detail: `VID (12 bits) — VLAN Identifier, range 0-4095 (the low 12 bits of the TCI).

RESERVED / SPECIAL VALUES (IEEE 802.1Q):
- 0     = "priority tag": the frame carries NO VLAN membership, only a PCP/DEI
          priority. The receiver assigns the port's native/PVID VLAN.
- 1     = the default VLAN on most switches (often also the management VLAN by
          vendor convention; not reserved by the standard).
- 4095  = RESERVED; must not be transmitted on the wire. It is used internally /
          as a wildcard ("any VLAN") in management operations.
- 1..4094 are the usable VLAN IDs (4094 of them).

ISOLATION: VLANs partition one switched fabric into independent broadcast
domains. A broadcast in VID 10 never reaches VID 20; inter-VLAN traffic must be
routed at Layer 3. This is why "trunk" links between switches carry the tag (to
preserve VID across the link) while "access" ports usually strip it.

NATIVE VLAN: on a trunk, one VLAN may be configured "native" and sent UNTAGGED.
Mismatched native VLANs on the two ends of a trunk is a classic misconfiguration
and the basis of VLAN-hopping attacks (double-tagging), so the native VLAN is
typically set to an unused ID and trunks are pruned to only needed VLANs.

SCALE: 12 bits caps a single tag at ~4094 VLANs. Provider networks that need
more use Q-in-Q (802.1ad, stacked tags) or push the segmentation up to VXLAN
(a 24-bit VNI, ~16 million segments) for data-center/overlay scale.`,
    },
    {
      name: 'innerEtherType',
      label: 'Inner EtherType',
      bits: 16,
      type: 'enum',
      enumMap: ETHERTYPES,
      note: 'The EtherType the tag displaced: which Layer-3 protocol is really inside.',
      desc: "The original Ethernet EtherType, pushed here by the inserted tag. It names the Layer-3 protocol actually carried (e.g. 0x0800 IPv4), so once the tag is stripped the frame is dispatched exactly as an untagged Ethernet frame would be.",
      detail: `INNER ETHERTYPE (16 bits) — the field the VLAN tag displaced.

When a tag is inserted, the frame's real EtherType is moved to AFTER the TCI.
The NIC first read 0x8100 (the TPID) where the EtherType normally sits, knew the
frame was tagged, and so looks 2 bytes further on for the genuine type.

COMMON VALUES (identical to the Ethernet II table):
0x0800 = IPv4 | 0x86DD = IPv6 | 0x0806 = ARP
0x8100 = ANOTHER 802.1Q tag (Q-in-Q / stacked C-TAG)
0x88A8 = 802.1ad S-TAG (provider/service tag, the usual outer tag in Q-in-Q)

DISPATCH: this model maps the inner type to the child protocol id
(0x0800->ipv4, 0x86DD->ipv6, 0x0806->arp) — the very same demux Ethernet does.
A value of 0x8100/0x88A8 would indicate a further nested tag rather than a
Layer-3 protocol.

LENGTH-VS-TYPE: as with Ethernet, a value <= 1500 would be an 802.3 Length, not
an EtherType. Tagged frames in practice use Ethernet II (DIX) types.`,
    },
  ],
  // Fixed 4 bytes: 2-byte TCI (PCP/DEI/VID) + 2-byte inner EtherType.
  // (The 0x8100 TPID was consumed as the Ethernet EtherType, so it is not here.)
  headerBytes: () => 4,
  // Demultiplex on the inner EtherType, exactly like Ethernet II.
  next: (h: ParsedHeader) => ETHERTYPE_TO_ID[h.get('innerEtherType')] ?? null,
};
