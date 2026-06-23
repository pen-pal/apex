// BFD (Bidirectional Forwarding Detection) Control packet. RFC 5880.
// Carried over UDP, single-hop control on destination port 3784 (multihop 4784).
// The mandatory section is a fixed 24 bytes (RFC 5880 §4.1); an optional
// Authentication Section (RFC 5880 §4.2) may follow when the A (Auth Present)
// flag is set — that variable trailer falls into node.payload here.
import type { ProtocolSpec } from '../core/types';

// Diagnostic codes (RFC 5880 §4.1). All 0-8 are defined; 9-31 are reserved.
const DIAG: Record<number, string> = {
  0: 'No Diagnostic',
  1: 'Control Detection Time Expired',
  2: 'Echo Function Failed',
  3: 'Neighbor Signaled Session Down',
  4: 'Forwarding Plane Reset',
  5: 'Path Down',
  6: 'Concatenated Path Down',
  7: 'Administratively Down',
  8: 'Reverse Concatenated Path Down',
};

// Session state (RFC 5880 §4.1, the Sta field).
const STATE: Record<number, string> = {
  0: 'AdminDown',
  1: 'Down',
  2: 'Init',
  3: 'Up',
};

export const bfd: ProtocolSpec = {
  id: 'bfd',
  name: 'BFD',
  layer: 7,
  summary: 'Bidirectional Forwarding Detection: a tiny, fast hello protocol that detects path failures between two forwarding engines in milliseconds, independent of the routing protocol.',
  fields: [
    {
      name: 'version',
      label: 'Version',
      bits: 3,
      desc: 'The BFD protocol version. RFC 5880 fixes this at 1; the original pre-standard BFD was version 0.',
      detail: `VERSION (3 bits): the current and only standardized value is 1 (RFC 5880). A receiver MUST discard a packet whose version it does not recognize.

This field shares the first byte with the 5-bit Diagnostic code: the byte is (Version << 5) | Diag. Version 1 in the top 3 bits gives 0x20 in that nibble region, so a typical first byte is 0x20 + diag.`,
    },
    {
      name: 'diagnostic',
      label: 'Diagnostic',
      bits: 5,
      type: 'enum',
      enumMap: DIAG,
      note: 'Why the local system last changed session state — the reason the session went Down, if it did.',
      desc: 'A 5-bit code carrying the reason this system last transitioned away from the Up state. It lets the peer (and operators) see why a session failed: a detection-time timeout, an administrative shutdown, a signalled neighbor-down, and so on.',
      detail: `DIAGNOSTIC (5 bits) — the local system's reason for its most recent state change:
0  No Diagnostic            — nothing to report (normal when Up)
1  Control Detection Time Expired — no control packets arrived within the detection time (the classic failure)
2  Echo Function Failed
3  Neighbor Signaled Session Down — the peer told us it went Down/AdminDown
4  Forwarding Plane Reset
5  Path Down
6  Concatenated Path Down
7  Administratively Down     — operator shut the session down
8  Reverse Concatenated Path Down
9-31 Reserved for future use

It is diagnostic only: it does not itself drive the state machine, but it is invaluable for troubleshooting why a link was declared down.`,
    },
    {
      name: 'sessionState',
      label: 'Session state (Sta)',
      bits: 2,
      type: 'enum',
      enumMap: STATE,
      note: 'This system\'s perception of the session: AdminDown / Down / Init / Up.',
      desc: 'The sender\'s current view of the BFD session. The three-state bring-up (Down -> Init -> Up) is what lets each side confirm the other can both send AND receive before declaring the path usable.',
      detail: `SESSION STATE (2 bits) — the local system's own perception of the session:
0  AdminDown — the session has been administratively held down; the peer should not consider this a failure
1  Down      — the session is down (or has just been created)
2  Init      — this system is communicating, but has not yet seen the remote system see it back
3  Up        — the session is established and the path is considered usable

WHY THREE-STATE HANDSHAKE: a node sends Down until it hears from the peer, then Init; only when it receives Init or Up from the peer does it move to Up. This guarantees bidirectional reachability — each side has proven the other can both transmit and receive — before the path is trusted. AdminDown is distinct from Down so an operator pause is not mistaken for a real fault.`,
    },
    {
      name: 'flags',
      label: 'Flags',
      bits: 6,
      type: 'flags',
      // flagBits[0] is the MSB of this 6-bit field. The field occupies bits 2-7
      // of byte 1, immediately below the 2-bit State, so MSB->LSB is P,F,C,A,D,M.
      flagBits: ['P', 'F', 'C', 'A', 'D', 'M'],
      desc: 'Six control bits that follow the 2-bit State in byte 1: P (Poll), F (Final), C (Control-Plane Independent), A (Authentication Present), D (Demand), M (Multipoint).',
      detail: `FLAG BITS (MSB -> LSB within this 6-bit field, RFC 5880 §4.1):
P  Poll (0x20)      — sender requests verification / a parameter change; the receiver MUST answer with a packet carrying F. P and F are never both set.
F  Final (0x10)     — this packet answers a packet that had the Poll bit set.
C  Control Plane Independent (0x08) — BFD is implemented in the forwarding plane and can continue even if the control plane (routing) is disrupted (e.g. a graceful restart).
A  Authentication Present (0x04) — an Authentication Section follows the mandatory header; the packet is authenticated.
D  Demand (0x02)    — the sender is in Demand mode: it believes it has its own way of verifying connectivity and the peer should stop sending periodic control packets.
M  Multipoint (0x01) — reserved for future point-to-multipoint extensions; MUST be 0 and ignored on receipt in RFC 5880.

These six bits plus the 2-bit State exactly fill byte 1 (State<<6 | P<<5 | F<<4 | C<<3 | A<<2 | D<<1 | M).`,
    },
    {
      name: 'detectMultiplier',
      label: 'Detect multiplier',
      bits: 8,
      note: 'Multiply by the negotiated RX interval to get the detection time.',
      desc: 'The number of missed packets after which the session is declared down. Detection time = Detect Mult × the agreed receive interval — so a low value fails fast but is less tolerant of jitter and loss.',
      detail: `DETECT MULT (8 bits): the detection time multiplier. The session's Detection Time is this value multiplied by the receive interval actually in use (the larger of the local Required Min RX and the remote Desired Min TX, in async mode).

EXAMPLE: with a 50 ms transmit interval and a multiplier of 3, the path is declared down after ~150 ms of silence. A common default is 3. Higher tolerates more loss/jitter; lower detects faster but risks false positives.`,
    },
    {
      name: 'length',
      label: 'Length',
      bits: 8,
      decode: (v) => `${v} bytes`,
      note: 'Total length of the BFD packet in bytes (24 with no auth).',
      desc: 'The length of the entire BFD Control packet in bytes, including the 24-byte mandatory section and any Authentication Section. With no authentication the value is 24.',
      detail: `LENGTH (8 bits): total BFD packet length in bytes. It is 24 for a packet with no Authentication Section. When the A (Auth Present) flag is set, an Authentication Section is appended and Length grows to cover it, so Length - 24 gives the size of that trailing auth data.

The dissector uses this to bound the PDU: the bytes beyond the 24-byte fixed header up to Length are the optional Authentication Section, surfaced as the payload.`,
    },
    {
      name: 'myDiscriminator',
      label: 'My Discriminator',
      bits: 32,
      type: 'hex',
      note: 'A unique, nonzero value the sender uses to identify this session.',
      desc: 'A nonzero value chosen by the transmitting system to uniquely identify this BFD session at its end. The peer echoes it back in Your Discriminator, which is how packets get demultiplexed to the right session.',
      detail: `MY DISCRIMINATOR (32 bits): a unique, nonzero discriminator generated by the sending system to identify the session at its own end. It is opaque to the peer.

DEMULTIPLEXING: once the session is up, a receiver matches an incoming packet to a session using Your Discriminator (which equals the receiver's own My Discriminator). This means many sessions can share the same IP addresses and UDP ports yet still be told apart purely by discriminator.`,
    },
    {
      name: 'yourDiscriminator',
      label: 'Your Discriminator',
      bits: 32,
      type: 'hex',
      note: 'The discriminator received from the peer; 0 until the peer is heard.',
      desc: 'The discriminator value most recently received from the remote system — i.e. the peer\'s My Discriminator. It is zero until this system has heard from the peer, which is exactly how the Init state is detected.',
      detail: `YOUR DISCRIMINATOR (32 bits): reflects back the My Discriminator the local system last received from the peer.

STATE LINKAGE: when a system has not yet heard from its peer, it does not know the peer's discriminator, so it sends Your Discriminator = 0 (and State = Down). Receiving a packet whose Your Discriminator matches our own My Discriminator proves the peer can both see and identify us — driving the handshake toward Up. In Demand mode and for echo, correct discriminator reflection is what binds the two halves of the session.`,
    },
    {
      name: 'desiredMinTxInterval',
      label: 'Desired Min TX Interval',
      bits: 32,
      decode: (v) => `${v} us`,
      note: 'Minimum interval (microseconds) the sender wants between its own transmitted control packets.',
      desc: 'The minimum interval, in microseconds, that the local system would like to use when sending BFD control packets. The actual transmit rate is negotiated as the larger of this and the peer\'s Required Min RX Interval.',
      detail: `DESIRED MIN TX INTERVAL (32 bits, microseconds): the minimum interval the sender wants between the BFD control packets it transmits.

NEGOTIATION: the effective transmit interval is max(my Desired Min TX, peer's Required Min RX). A system cannot send faster than the peer is willing to receive. Until the session is Up, a system MUST use a Desired Min TX of at least 1,000,000 us (1 second) to avoid flooding during bring-up; aggressive sub-second timers kick in only once Up.`,
    },
    {
      name: 'requiredMinRxInterval',
      label: 'Required Min RX Interval',
      bits: 32,
      decode: (v) => `${v} us`,
      note: 'Minimum interval (microseconds) between control packets the sender can receive.',
      desc: 'The minimum interval, in microseconds, between BFD control packets that the local system is able to receive. A value of 0 tells the peer to stop sending periodic control packets entirely.',
      detail: `REQUIRED MIN RX INTERVAL (32 bits, microseconds): the minimum interval between received control packets that this system can support. It caps how fast the peer is allowed to transmit (the peer uses max(its Desired Min TX, this value)).

ZERO IS SPECIAL: a value of 0 means the transmitting system does not want the peer to send any periodic control packets — used with Demand mode, where connectivity is verified by other means and periodic hellos are suspended.`,
    },
    {
      name: 'requiredMinEchoRxInterval',
      label: 'Required Min Echo RX Interval',
      bits: 32,
      decode: (v) => `${v} us`,
      note: 'Minimum interval (microseconds) between echo packets the sender can receive; 0 = echo not supported.',
      desc: 'The minimum interval, in microseconds, between received BFD Echo packets that this system supports. A value of 0 means the system does not support the Echo function, so the peer must not send echo packets.',
      detail: `REQUIRED MIN ECHO RX INTERVAL (32 bits, microseconds): the minimum interval between BFD Echo packets that the local system can receive.

ECHO FUNCTION: in echo mode a system sends packets that the peer simply loops back through its forwarding plane, testing the round-trip data path itself without involving the peer's control/BFD logic. A value of 0 in this field means echo is not supported and the peer MUST NOT send echo packets. When echo is active, the control-packet rate can be relaxed because the echo stream provides the fast liveness check.`,
    },
  ],
  // The mandatory section is exactly 24 bytes (RFC 5880 §4.1).
  headerBytes: () => 24,
  // Length bounds the whole PDU: 24 + any Authentication Section. Anything the
  // wire carries beyond Length (e.g. IP/UDP padding) must not leak into payload.
  pduBytes: (h) => h.get('length'),
  // BFD is a leaf protocol — there is no encapsulated child. An Authentication
  // Section, when present, is data of this layer (surfaced as payload), not a
  // separate protocol, so dissection stops here.
  next: () => null,
};
