// Spanning Tree Protocol — Configuration BPDU. IEEE Std 802.1D (the 1998 and
// 2004 editions; clause 9 "Encoding of Bridge Protocol Data Units").
//
// STP keeps a switched Ethernet network loop-free. Bridges exchange Bridge
// Protocol Data Units (BPDUs) to elect a single Root Bridge, compute each
// bridge's least-cost path to it, and then block the redundant links that would
// otherwise create a broadcast-storm loop. The Configuration BPDU modelled here
// is the periodic message (default every 2 s, originated by the Root and
// relayed hop-by-hop) that advertises the current root, the sender's distance
// to it, and the protocol timers.
//
// HOW IT IS CARRIED ON THE WIRE (out of scope for this spec, modelled from the
// BPDU onward): a BPDU is NOT an Ethernet II / EtherType frame. It rides in an
// IEEE 802.3 length-framed frame to the reserved multicast destination MAC
// 01:80:C2:00:00:00, with an 802.2 LLC header DSAP=0x42, SSAP=0x42, control=0x03
// (UI). Those three LLC bytes precede the BPDU bytes parsed here.
//
// CONFIGURATION BPDU FORMAT (IEEE 802.1D clause 9.3.1), all big-endian:
//   offset  size  field
//   0       2     Protocol Identifier        (= 0x0000)
//   2       1     Protocol Version Identifier (0 = STP, 2 = RSTP, 3 = MSTP)
//   3       1     BPDU Type                  (0x00 Config, 0x02 RST/MST, 0x80 TCN)
//   4       1     Flags                      (TC = LSB 0x01, TCA = MSB 0x80)
//   5       8     Root Identifier            (priority 2B + MAC 6B)
//   13      4     Root Path Cost
//   17      8     Bridge Identifier          (priority 2B + MAC 6B)
//   25      2     Port Identifier
//   27      2     Message Age                (1/256 s units)
//   29      2     Max Age                    (1/256 s units)
//   31      2     Hello Time                 (1/256 s units)
//   33      2     Forward Delay              (1/256 s units)
//   --------------------------------------------------------------
//   total = 35 bytes (the 802.1D STP Configuration BPDU)
//
// RSTP/MSTP (version 2/3, BPDU Type 0x02) append a "Version 1 Length" byte at
// offset 35 and further version-specific data; this spec models the fixed
// 35-byte STP Configuration BPDU and stops there. The timer fields are carried
// in units of 1/256 second (so 20 s -> 5120 -> 0x1400).
import type { ProtocolSpec } from '../core/types';

const VERSION: Record<number, string> = {
  0: 'STP (802.1D)',
  2: 'RSTP (802.1w)',
  3: 'MSTP (802.1s)',
};

const BPDU_TYPE: Record<number, string> = {
  0x00: 'Configuration',
  0x02: 'RST/MST BPDU',
  0x80: 'Topology Change Notification (TCN)',
};

// Decode a timer field carried in 1/256-second units into whole seconds.
const secs = (v: number) => {
  const s = v / 256;
  return `${v} (${Number.isInteger(s) ? s : s.toFixed(3)} s; units of 1/256 s)`;
};

export const stp: ProtocolSpec = {
  id: 'stp',
  name: 'STP (BPDU)',
  layer: 2,
  summary:
    'Spanning Tree Protocol Configuration BPDU: bridges exchange these to elect one Root Bridge, learn each bridge\'s least-cost path to it, and block redundant links so a switched LAN has no loops.',
  fields: [
    {
      name: 'protocolId',
      label: 'Protocol Identifier',
      bits: 16,
      type: 'hex',
      decode: (v) => (v === 0 ? '0x0000 (Spanning Tree)' : `0x${v.toString(16).padStart(4, '0')}`),
      note: 'Always 0x0000 for Spanning Tree.',
      desc: 'A 16-bit identifier that marks this as a Spanning Tree BPDU. IEEE 802.1D fixes it at 0x0000; a BPDU with any other value is discarded.',
      detail: `PROTOCOL IDENTIFIER (16 bits, IEEE 802.1D §9.3.1): "The Protocol Identifier ... takes the value 0000 0000 0000 0000."

It is the first thing a receiver reads. Because BPDUs are not demultiplexed by an EtherType (they ride in an 802.3/LLC frame with DSAP/SSAP 0x42), this constant is the marker that the LLC payload is Spanning Tree. Any non-zero value means "not an STP BPDU" and the frame is dropped.`,
    },
    {
      name: 'protocolVersionId',
      label: 'Protocol Version Identifier',
      bits: 8,
      type: 'enum',
      enumMap: VERSION,
      note: '0 = STP, 2 = RSTP, 3 = MSTP.',
      desc: 'Which spanning-tree variant produced this BPDU. 0 is the original 802.1D STP; 2 is Rapid STP (802.1w); 3 is Multiple STP (802.1s). A receiver running an older version ignores the extra fields newer versions add.',
      detail: `PROTOCOL VERSION IDENTIFIER (8 bits, IEEE 802.1D §9.3.1):
- 0 = STP (802.1D) — the classic protocol; this BPDU is exactly 35 bytes.
- 2 = RSTP (802.1w) — Rapid Spanning Tree; converges in seconds instead of ~50 s. Its BPDU adds a "Version 1 Length" byte after Forward Delay and uses the full Flags octet (proposal/agreement handshake, port roles).
- 3 = MSTP (802.1s) — Multiple Spanning Tree; maps VLANs to a few spanning-tree instances and appends an MSTP configuration block.

INTEROPERABILITY: a version field is how a mixed network degrades gracefully — an RSTP bridge that hears a version-0 BPDU on a port falls back to plain STP behaviour on that port.`,
    },
    {
      name: 'bpduType',
      label: 'BPDU Type',
      bits: 8,
      type: 'enum',
      enumMap: BPDU_TYPE,
      note: '0x00 Config, 0x02 RST/MST, 0x80 TCN.',
      desc: 'The kind of BPDU. 0x00 is a Configuration BPDU (the periodic root/cost/timer advertisement modelled here); 0x80 is a tiny Topology Change Notification a bridge sends toward the root when a link changes; 0x02 is the RSTP/MSTP BPDU.',
      detail: `BPDU TYPE (8 bits, IEEE 802.1D §9.3.1):
- 0x00 Configuration BPDU: carries the full 35-byte body (root, cost, bridge id, port id, timers). The Root originates one every Hello Time; each designated bridge relays an updated copy downstream.
- 0x80 Topology Change Notification (TCN) BPDU: only 4 bytes (Protocol Id, Version, Type, no body). A bridge that detects a topology change sends TCNs out its root port until its upstream neighbour acknowledges with the TCA flag; the notification walks hop-by-hop to the Root, which then sets the TC flag in Configuration BPDUs so every bridge ages out its MAC table faster.
- 0x02 RST/MST BPDU (802.1w / 802.1s): the rapid variants reuse a single type and distinguish themselves by the Protocol Version Identifier.

This is why the value 0x80 sets the high bit: it is deliberately distinct from the 0x00 config type so a bridge can tell the two apart from the type byte alone.`,
    },
    {
      name: 'flags',
      label: 'Flags',
      bits: 8,
      type: 'flags',
      // flagBits[0] is the MOST significant bit (0x80). In 802.1D the only two
      // defined flags are TCA (MSB, 0x80) and TC (LSB, 0x01). The bits between
      // them were given meaning by RSTP (802.1w): proposal, port role (2 bits),
      // learning, forwarding, agreement.
      flagBits: ['TCA', 'Agreement', 'Forwarding', 'Learning', 'Role(hi)', 'Role(lo)', 'Proposal', 'TC'],
      note: 'In 802.1D only TC (LSB, 0x01) and TCA (MSB, 0x80) are used; the middle bits are RSTP role/proposal/agreement.',
      desc: 'A bit field of control flags. In classic 802.1D only two are defined: the Topology Change (TC) bit, the least-significant bit (0x01), and the Topology Change Acknowledgment (TCA) bit, the most-significant bit (0x80). RSTP gave the six middle bits meaning (proposal, port role, learning, forwarding, agreement).',
      detail: `FLAGS (8 bits, IEEE 802.1D §9.3.1 / extended by RSTP 802.1w §9.3.3). Bit values shown MSB->LSB:
- 0x80  TCA  Topology Change Acknowledgment — a designated bridge sets this in the Configuration BPDU it sends back down a port to tell the downstream bridge "I received your TCN, you can stop sending it."
- 0x40  Agreement   (RSTP) — half of the RSTP proposal/agreement handshake that lets a point-to-point link skip the timer-based listening/learning delay.
- 0x20  Forwarding  (RSTP) — the sending port is in the Forwarding state.
- 0x10  Learning    (RSTP) — the sending port is in the Learning state.
- 0x08,0x04 Port Role (RSTP, 2 bits): 00 Unknown, 01 Alternate/Backup, 10 Root, 11 Designated.
- 0x02  Proposal    (RSTP) — the other half of the rapid handshake.
- 0x01  TC   Topology Change — the Root sets this in Configuration BPDUs after learning of a change, telling every bridge to shorten its MAC-address-table aging time (to Forward Delay) so stale entries flush quickly.

REAL CAPTURES (anchors): a plain 802.1D Config BPDU normally has Flags 0x00; a topology-change Config BPDU has 0x01 (TC only); a TCN acknowledgment Config BPDU has 0x80 (TCA only); both set is 0x81. Because TC is the LSB and TCA is the MSB, the six bits between them are zero in pure 802.1D — RSTP populates them.`,
    },
    {
      name: 'rootIdentifier',
      label: 'Root Identifier',
      bits: 64,
      type: 'bytes',
      note: '8 bytes = 2-byte priority + 6-byte MAC of the bridge this sender believes is the Root.',
      desc: 'The Bridge ID of the bridge the sender currently believes is the Root of the spanning tree: a 2-byte priority followed by the 6-byte bridge MAC. The Root is the bridge with the numerically lowest Root Identifier; every bridge in the BPDU stream converges on the same value.',
      detail: `ROOT IDENTIFIER (64 bits = 8 bytes, IEEE 802.1D §9.2.5): the identifier of the bridge assumed to be the Root.

STRUCTURE (2-byte priority, then 6-byte MAC):
- Original 802.1D-1998: a full 16-bit Bridge Priority (0-65535, default 32768 = 0x8000) + the bridge's 48-bit MAC.
- 802.1D-2004 / 802.1t: the 16-bit priority is split into a 4-bit settable priority (in steps of 4096) + a 12-bit "System ID Extension" (normally the VLAN id, for per-VLAN spanning trees). So 0x8000 + extension 0 still reads as priority 32768.

ROOT ELECTION: the bridge with the LOWEST Root Identifier (priority first, then MAC as tie-breaker) wins. When a bridge hears a BPDU advertising a lower Root Identifier than its own, it stops claiming to be Root and starts relaying the better root. Operators lower the priority of the bridge they want as Root (e.g. 4096) so MAC luck does not decide topology.

Wider than 48 bits, so Apex reads it as raw bytes (type 'bytes') rather than a single number; the priority and MAC are the first 2 and last 6 of those bytes.`,
    },
    {
      name: 'rootPathCost',
      label: 'Root Path Cost',
      bits: 32,
      decode: (v) => `${v} (cumulative cost from this bridge to the Root)`,
      note: 'Cumulative cost of the path from this sender to the Root Bridge.',
      desc: "The total cost of the path from the sending bridge to the Root, summed over each link the BPDU traversed. The Root itself advertises 0; every bridge adds its own port's cost before relaying, so a bridge picks its Root Port by lowest received Root Path Cost.",
      detail: `ROOT PATH COST (32 bits, IEEE 802.1D §9.2.6): "the cost of the path to the Root ... from the transmitting Bridge."

ACCUMULATION: the Root sends cost 0. A bridge receiving a BPDU adds the cost of the receiving port to the advertised cost; whichever port yields the LOWEST resulting cost becomes that bridge's Root Port (its path toward the Root). The bridge then advertises that lowest cost downstream.

DEFAULT PORT COSTS (IEEE 802.1D-2004 recommended, speed-based):
  10 Mb/s = 2,000,000 | 100 Mb/s = 200,000 | 1 Gb/s = 20,000 | 10 Gb/s = 2,000
The older 802.1D-1998 short-form costs are still common on equipment: 10 Mb/s = 100, 100 Mb/s = 19, 1 Gb/s = 4. (The 32-bit field accommodates the newer larger values.)

TIE-BREAKING when two paths cost the same: lowest sender Bridge ID, then lowest sender Port ID.`,
    },
    {
      name: 'bridgeIdentifier',
      label: 'Bridge Identifier',
      bits: 64,
      type: 'bytes',
      note: "8 bytes = 2-byte priority + 6-byte MAC of THIS sending (designated) bridge.",
      desc: "The Bridge ID of the bridge that transmitted this BPDU (the Designated Bridge for the link): a 2-byte priority plus the 6-byte bridge MAC. Downstream bridges use it, together with Root Path Cost and Port ID, to choose their Designated Bridge and break ties.",
      detail: `BRIDGE IDENTIFIER (64 bits = 8 bytes, IEEE 802.1D §9.2.5): the identifier of the bridge transmitting this Configuration BPDU — i.e. the Designated Bridge on the LAN segment it was sent on.

Same 2-byte-priority + 6-byte-MAC structure as the Root Identifier above. On the Root itself, Bridge Identifier == Root Identifier and Root Path Cost == 0; that equality is exactly how other bridges recognize a BPDU as coming straight from the Root.

DESIGNATED BRIDGE selection on a segment: among all bridges attached to a LAN, the one offering the lowest Root Path Cost (ties broken by lowest Bridge Identifier) becomes the Designated Bridge and is the only one that forwards traffic onto that segment; the others block their ports to that segment to prevent a loop.

Wider than 48 bits, so Apex reads it as raw bytes (type 'bytes').`,
    },
    {
      name: 'portIdentifier',
      label: 'Port Identifier',
      bits: 16,
      type: 'hex',
      note: '1-byte configurable priority + 1-byte port number of the sending port.',
      desc: 'Identifies the specific port on the sending bridge that transmitted this BPDU. The high byte is a configurable port priority (default 0x80) and the low byte is the port number, so 0x8001 = priority 128, port 1. It is the final tie-breaker when Root Path Cost and Bridge ID are equal.',
      detail: `PORT IDENTIFIER (16 bits, IEEE 802.1D §9.2.7): "the Port Identifier of the Port through which the [BPDU] was transmitted."

STRUCTURE: high byte = Port Priority (configurable, default 0x80 = 128, set in steps of 16 in 802.1t), low byte = Port Number. So 0x8001 means priority 128, port number 1.

ROLE: it is the LAST tie-breaker in the spanning-tree comparison. When two candidate paths have an equal Root Identifier, equal Root Path Cost, and equal sender Bridge Identifier (e.g. two parallel links to the same upstream bridge), the bridge picks the path whose received Port Identifier is lower — i.e. the lower-priority/lower-numbered upstream port becomes the Root Port and the other is blocked.`,
    },
    {
      name: 'messageAge',
      label: 'Message Age',
      bits: 16,
      decode: secs,
      note: 'Time since the Root originated the info, in 1/256-second units.',
      desc: 'How long, in units of 1/256 second, since the Root Bridge first originated the information this BPDU carries. It is roughly 0 near the Root and increases by about one Hello Time per bridge as the BPDU is relayed outward, acting as a hop-count safeguard.',
      detail: `MESSAGE AGE (16 bits, units of 1/256 second, IEEE 802.1D §9.2.9): the age of the Configuration BPDU since it was generated by the Root.

PROPAGATION: the Root sends Message Age 0. Each bridge that relays the BPDU increments Message Age (by at least 1 s, the "Message Age Increment"). If Message Age ever reaches Max Age the information is considered stale and discarded — this caps how far stale root information can travel and bounds the network diameter (default Max Age 20 supports a diameter of ~7 bridges).

A bridge also re-uses Message Age to time out a Root: if it stops hearing BPDUs and the stored Message Age reaches Max Age, it concludes the path to the Root is gone and re-runs the election.

UNITS: 1/256 second, so the raw value 256 = 1 s. Most Config BPDUs straight from the Root carry 0.`,
    },
    {
      name: 'maxAge',
      label: 'Max Age',
      bits: 16,
      decode: secs,
      note: 'Lifetime of BPDU info before it is discarded; default 20 s (0x1400), in 1/256-second units.',
      desc: 'The maximum age, in 1/256-second units, that BPDU information may reach before a bridge discards it and reconsiders the topology. Default is 20 seconds (raw 5120 = 0x1400). It is set by the Root and used network-wide so every bridge times out consistently.',
      detail: `MAX AGE (16 bits, units of 1/256 second, IEEE 802.1D §9.2.9): "the value of ... Max Age" the timers use.

DEFAULT: 20 s -> 20 x 256 = 5120 -> 0x1400 on the wire. Range 6-40 s.

USE: when a port's stored Message Age reaches Max Age (because BPDUs stopped arriving or the relayed age grew too large), the bridge treats the Root information as lost and triggers reconvergence. Because the Root dictates Max Age (and Hello/Forward Delay) in every Configuration BPDU, all bridges use the SAME timers regardless of their local configuration — this prevents inconsistent timeouts that could create transient loops.`,
    },
    {
      name: 'helloTime',
      label: 'Hello Time',
      bits: 16,
      decode: secs,
      note: 'Interval between Configuration BPDUs; default 2 s (0x0200), in 1/256-second units.',
      desc: 'The interval, in 1/256-second units, between successive Configuration BPDUs originated by the Root. Default is 2 seconds (raw 512 = 0x0200). All bridges adopt the Root\'s Hello Time so the whole tree beats in time.',
      detail: `HELLO TIME (16 bits, units of 1/256 second, IEEE 802.1D §9.2.9).

DEFAULT: 2 s -> 2 x 256 = 512 -> 0x0200 on the wire. Range 1-10 s.

USE: the Root emits a Configuration BPDU every Hello Time, and designated bridges relay them at the same cadence. Missing BPDUs is how a bridge notices a problem; combined with Max Age and the Message Age increment it sets how quickly classic STP detects a failed Root path (and thus part of why 802.1D convergence is on the order of tens of seconds, which RSTP improves).`,
    },
    {
      name: 'forwardDelay',
      label: 'Forward Delay',
      bits: 16,
      decode: secs,
      note: 'Listening/Learning state duration; default 15 s (0x0F00), in 1/256-second units.',
      desc: 'The time, in 1/256-second units, a port spends in each of the Listening and Learning states before it may begin Forwarding. Default is 15 seconds (raw 3840 = 0x0F00). The delay prevents a port from forwarding into a transient loop before the topology has settled.',
      detail: `FORWARD DELAY (16 bits, units of 1/256 second, IEEE 802.1D §9.2.9).

DEFAULT: 15 s -> 15 x 256 = 3840 -> 0x0F00 on the wire. Range 4-30 s.

USE: in classic 802.1D a transitioning port waits Forward Delay in Listening (participating in STP, not yet learning MACs) and another Forward Delay in Learning (building its MAC table, still not forwarding) before Forwarding. That is two x 15 s = 30 s of delay, the dominant component of 802.1D's ~50 s worst-case convergence. RSTP eliminates most of this with its proposal/agreement handshake.

Forward Delay is also reused as the shortened MAC-table aging time while a Topology Change is in effect, so stale entries flush within one Forward Delay instead of the usual ~300 s.`,
    },
  ],
  // The 802.1D STP Configuration BPDU is a fixed 35 bytes. RSTP/MSTP (version 2/3)
  // append a Version 1 Length byte and version-specific data after this; that is
  // not modelled here.
  headerBytes: () => 35,
  // A BPDU is the top of its stack — there is no encapsulated child protocol.
  next: () => null,
};
