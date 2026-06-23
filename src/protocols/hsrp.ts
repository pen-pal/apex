// HSRP — Hot Standby Router Protocol, version 0. RFC 2281 (March 1998),
// section 5 "Protocol Operation" / section 5.1 "Protocol Packets".
//
// HSRP is Cisco's first-hop redundancy protocol: a group of routers shares one
// "virtual" IP and a virtual MAC (00-00-0C-07-AC-{Group}) so hosts can use a
// single, fault-tolerant default gateway. One router is elected Active and
// forwards traffic sent to the virtual MAC; one is Standby, ready to take over.
// Members run a state machine (Initial -> Learn -> Listen -> Speak ->
// Standby -> Active) and exchange three message types: Hello (heartbeat /
// election), Coup (a higher-priority router seizing Active), and Resign (the
// Active router stepping down).
//
// TRANSPORT: HSRP runs over UDP port 1985, sent to the all-routers multicast
// group 224.0.0.2 with IP TTL 1 (RFC 2281 section 5). This is the UDP payload.
//
// PACKET FORMAT (RFC 2281 section 5.1), all big-endian / network order — a
// fixed 20-byte message:
//                       1                   2                   3
//   0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
//  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//  |   Version     |   Op Code     |     State     |   Hellotime   |
//  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//  |   Holdtime    |   Priority    |     Group     |   Reserved    |
//  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//  |                      Authentication  Data                     |
//  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//  |                      Authentication  Data                     |
//  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//  |                      Virtual IP Address                       |
//  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//
// HSRP is the top of this stack: the 20-byte message is fully fixed, so there
// is no child protocol and next() returns null.
import type { ProtocolSpec, StateMachine } from '../core/types';

const OPCODE: Record<number, string> = {
  0: 'Hello',
  1: 'Coup',
  2: 'Resign',
};

// Note the values are NOT sequential: they are bit-position encoded so an
// implementation can track which states it has been in (RFC 2281 section 5.1).
const STATE: Record<number, string> = {
  0: 'Initial',
  1: 'Learn',
  2: 'Listen',
  4: 'Speak',
  8: 'Standby',
  16: 'Active',
};

// The HSRP standby state machine (RFC 2281 section 5.2 "State Diagram").
const states: StateMachine = {
  initial: 'Initial',
  states: ['Initial', 'Learn', 'Listen', 'Speak', 'Standby', 'Active'],
  transitions: {
    Initial: { enable: 'Learn' },
    Learn: { learnVirtualIp: 'Listen' },
    Listen: { activeTimerExpiry: 'Speak', higherStandby: 'Listen' },
    Speak: { winStandbyElection: 'Standby', loseStandbyElection: 'Listen' },
    Standby: { activeTimerExpiry: 'Active', higherPriorityActive: 'Listen' },
    Active: { higherPriorityCoup: 'Speak', resign: 'Initial' },
  },
};

export const hsrp: ProtocolSpec = {
  id: 'hsrp',
  name: 'HSRP',
  layer: 7,
  summary:
    "Cisco's first-hop redundancy protocol: a group of routers shares one virtual IP and virtual MAC so hosts get a fault-tolerant default gateway. The elected Active router forwards for the group; a Standby waits to take over. Members multicast Hello (heartbeat/election), Coup (seize Active), and Resign (step down) messages over UDP 1985 to 224.0.0.2.",
  fields: [
    {
      name: 'version',
      label: 'Version',
      bits: 8,
      decode: (v) => (v === 0 ? '0 (HSRP, RFC 2281)' : String(v)),
      note: 'Always 0 for the HSRP version described by RFC 2281.',
      desc: 'The HSRP message-format version. RFC 2281 describes version 0. (Cisco later defined an HSRPv2 with a different, TLV-based format that supports group numbers above 255 and IPv6; that is a separate encoding.)',
      detail: `VERSION (8 bits): the first byte of every HSRP message.
- 0 = the format defined by RFC 2281 (the one modelled here), carried over UDP 1985.

HSRPv2 (a later Cisco extension, NOT RFC 2281) is a different on-the-wire format:
a Type/Length/Value group-state TLV that allows group numbers 0-4095, uses the
multicast address 224.0.0.102, and adds IPv6 support. A receiver reads this
version byte first to decide which parser to run.`,
    },
    {
      name: 'opCode',
      label: 'Op Code',
      bits: 8,
      type: 'enum',
      enumMap: OPCODE,
      note: '0 Hello (heartbeat/election), 1 Coup (seize Active), 2 Resign (step down).',
      desc: 'The type of HSRP message. Hello is the periodic heartbeat used for election and liveness; Coup is sent by a router that wishes to become Active immediately; Resign is sent by the Active router as it steps down so another router can take over.',
      detail: `OP CODE (8 bits, RFC 2281 section 5.1):
- 0 Hello: "sent when a router is ready to begin participating, and periodically
  to indicate it is operating." Carries the sender's priority, state, and the
  group's virtual IP; this is what drives both election and failure detection.
- 1 Coup: "sent when a router wishes to become the active router." A higher-
  priority router that comes up (with preemption enabled) sends a Coup to seize
  the Active role from a lower-priority Active router immediately, rather than
  waiting for it to fail.
- 2 Resign: "sent when a router no longer wishes to be the active router." The
  departing Active router multicasts Resign so the Standby can become Active at
  once instead of waiting out the Holdtime.`,
    },
    {
      name: 'state',
      label: 'State',
      bits: 8,
      type: 'enum',
      enumMap: STATE,
      note: 'The sender\'s current state machine state. Values are bit-encoded: 0 Initial, 1 Learn, 2 Listen, 4 Speak, 8 Standby, 16 Active.',
      desc: "The sender's current position in the HSRP state machine. A router progresses Initial -> Learn -> Listen -> Speak -> Standby -> Active. Exactly one router in a group is Active (forwarding for the virtual MAC) and one is Standby (ready to take over).",
      detail: `STATE (8 bits, RFC 2281 section 5.1) — the values are deliberately powers of
two, not a 0..5 sequence:
- 0  Initial: HSRP is not running yet (just configured, or interface down).
- 1  Learn: the router has not yet seen the virtual IP and is waiting to learn
     it from a Hello sent by the Active router.
- 2  Listen: the router knows the virtual IP but is neither Active nor Standby;
     it listens for Hellos from both.
- 4  Speak: the router sends periodic Hellos and is actively participating in the
     election of the Active and Standby routers.
- 8  Standby: the router is the candidate to become Active next and sends
     periodic Hellos.
- 16 Active: the router currently forwards packets sent to the group's virtual
     MAC address (00-00-0C-07-AC-{Group}) and answers ARP for the virtual IP.

Election: highest Priority wins; ties are broken by the higher interface IP
address. The bit-position encoding lets an implementation cheaply record the set
of states it has passed through.`,
    },
    {
      name: 'helloTime',
      label: 'Hellotime',
      bits: 8,
      decode: (v) => `${v} second${v === 1 ? '' : 's'} between Hellos`,
      note: 'Seconds between Hello messages. Only meaningful in Hello messages; default 3.',
      desc: 'The approximate period, in seconds, between the Hello messages this router sends. It is only meaningful in Hello messages. The configured default is 3 seconds.',
      detail: `HELLOTIME (8 bits, in SECONDS, RFC 2281 section 5.1): "the approximate period
between the Hello messages that the router sends." Only meaningful in Hello (Op
Code 0) messages.

A non-Active router that learns Hellotime/Holdtime from the Active router's Hello
adopts those timers, so a group stays consistent even if members are configured
differently. The default is 3 seconds. Lowering it speeds failure detection at
the cost of more control traffic.`,
    },
    {
      name: 'holdTime',
      label: 'Holdtime',
      bits: 8,
      decode: (v) => `${v} seconds before this Hello expires`,
      note: 'Seconds a Hello stays valid. Only meaningful in Hello messages; default 10, should be >= 3x Hellotime.',
      desc: 'The amount of time, in seconds, that the current Hello message should be considered valid. If no further Hello arrives within Holdtime, the Active (or Standby) router is declared down. Default is 10 seconds and it should be at least three times the Hellotime.',
      detail: `HOLDTIME (8 bits, in SECONDS, RFC 2281 section 5.1): "the amount of time that
the current Hello message should be considered valid." Only meaningful in Hello
messages.

FAILURE DETECTION: a Standby router that hears no Hello from the Active router
within Holdtime declares it down and transitions to Active. To avoid declaring a
router down over a single lost packet, Holdtime should be at least 3x Hellotime;
the default is 10 seconds (with the default 3-second Hellotime). It must be
strictly greater than Hellotime.`,
    },
    {
      name: 'priority',
      label: 'Priority',
      bits: 8,
      decode: (v) => `${v}${v === 100 ? ' (default)' : ''}`,
      note: 'Election priority; higher wins, ties broken by higher IP. Default 100.',
      desc: 'The election priority of the sending router. When two routers are compared, the numerically higher priority wins the Active (or Standby) role. The default is 100; ties are broken by the higher interface IP address.',
      detail: `PRIORITY (8 bits, range 0-255, RFC 2281 section 5.1): "used to elect the active
and standby routers. When comparing priorities of two different routers, the
router with the numerically higher priority wins."

DEFAULT: 100. TIE-BREAK: if priorities are equal, the router with the higher
(actual interface) IP address wins.

PREEMPTION & TRACKING: with preemption enabled, a router that comes up with a
higher priority sends a Coup to take over Active immediately. Interface tracking
can decrement a router's priority when a monitored uplink fails, so it gracefully
hands the Active role to a peer with a healthy path.`,
    },
    {
      name: 'group',
      label: 'Group',
      bits: 8,
      note: 'The standby group number. 0-255 (0-2 on Token Ring). Selects the virtual MAC 00-00-0C-07-AC-{Group}.',
      desc: 'Identifies the standby group this message belongs to. Multiple independent HSRP groups can share a LAN. The group number becomes the last byte of the virtual MAC address 00-00-0C-07-AC-XX. Valid range is 0-255 (0-2 on Token Ring).',
      detail: `GROUP (8 bits, RFC 2281 section 5.1): "identifies the standby group. For Token
Ring, values between 0 and 2 inclusive are valid. For other media values between
0 and 255 inclusive are valid."

VIRTUAL MAC: for non-Token-Ring media the group number is the last octet of the
Cisco-assigned virtual MAC 00-00-0C-07-AC-XX (XX = Group). The Active router uses
this MAC as the source of its Hellos and answers ARP for the virtual IP with it,
so on failover the new Active inherits the same MAC and hosts need not re-ARP.
Multiple groups on one interface give per-group load sharing (each group's
virtual IP can have a different Active router).`,
    },
    {
      name: 'reserved',
      label: 'Reserved',
      bits: 8,
      note: 'Reserved; sent as 0.',
      desc: 'A reserved octet. RFC 2281 defines no use for it; it is sent as zero and ignored on receipt.',
      detail: `RESERVED (8 bits, RFC 2281 section 5.1): the packet format includes this octet
between Group and the Authentication Data, but the RFC gives it no defined
meaning. Senders set it to 0 and receivers ignore it. It keeps the first two
rows of the message a tidy eight octets and leaves room for future use.`,
    },
    {
      name: 'authenticationData',
      label: 'Authentication Data',
      bits: 64,
      type: 'bytes',
      note: 'An 8-character clear-text password. RECOMMENDED default is "cisco" (0x63 69 73 63 6F 00 00 00).',
      desc: 'An 8-octet clear-text password used as a weak group password. If no authentication is configured the RECOMMENDED default is the ASCII string "cisco" followed by NUL padding: 0x63 0x69 0x73 0x63 0x6F 0x00 0x00 0x00.',
      detail: `AUTHENTICATION DATA (64 bits = 8 octets, RFC 2281 section 5.1): "contains a
clear-text 8 character reused password. If no authentication data is configured,
the RECOMMENDED default value is 0x63 0x69 0x73 0x63 0x6F 0x00 0x00 0x00" — the
ASCII text "cisco" NUL-padded to 8 bytes.

SECURITY: this is clear-text on a multicast LAN, so it offers no real protection
against a malicious host; it only guards against accidental misconfiguration
(e.g. two HSRP groups colliding). It is wider than 48 bits, so Apex reads it as
raw bytes (type 'bytes') rather than a number.`,
    },
    {
      name: 'virtualIpAddress',
      label: 'Virtual IP Address',
      bits: 32,
      type: 'ipv4',
      note: 'The shared virtual IP the group answers for — the gateway hosts are configured with.',
      desc: "The group's virtual IPv4 address. This is the single, fault-tolerant default-gateway address that client hosts are configured with; whichever router is currently Active answers for it (ARP and forwarding).",
      detail: `VIRTUAL IP ADDRESS (32 bits, RFC 2281 section 5.1): "the virtual IP address used
by this group."

This is the whole point of HSRP: hosts on the subnet set their default gateway to
this one address and never need to know which physical router is currently
forwarding. The Active router answers ARP for it with the virtual MAC
(00-00-0C-07-AC-{Group}). NOTE: the source IP of the HSRP packet itself must be
the sending router's real interface address, never this virtual address, so the
election can distinguish the physical routers.`,
    },
  ],
  // The HSRP message is a fixed 20 bytes (RFC 2281 section 5.1): two 4-octet
  // rows + 8 octets Authentication Data + 4 octets Virtual IP Address.
  headerBytes: () => 20,
  // HSRP is the top of the stack: the whole message is fixed-length and carries
  // no encapsulated child protocol.
  next: () => null,
  states,
};
