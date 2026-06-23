// PIM-SM version 2 — Protocol Independent Multicast - Sparse Mode.
// RFC 7761 (March 2016, "PIM-SM Specification (Revised)"), Section 4.9
// "Packet Formats". PIM-SM obsoletes RFC 4601.
//
// PIM is the dominant multicast ROUTING protocol. "Independent" means it does
// not build its own topology table: it reuses whatever unicast routing table
// (OSPF, BGP, static, ...) already exists to perform Reverse Path Forwarding
// (RPF) checks. Sparse Mode (SM) is explicit-join: traffic is only delivered to
// branches that have asked for it, by sending Join/Prune messages toward a
// Rendezvous Point (RP) and then, once flow is established, toward the source
// itself (the shortest-path tree, SPT, switchover).
//
// PIM runs DIRECTLY over IP as protocol number 103 (RFC 7761 §4.9) — there is
// no UDP/TCP. Most messages are multicast to the 'ALL-PIM-ROUTERS' group with
// TTL 1: 224.0.0.13 for IPv4, ff02::d for IPv6. Registers and Register-Stops
// are unicast to/from the RP.
//
// THE COMMON HEADER (4 bytes) prefixes every PIM message (RFC 7761 §4.9):
//    0                   1                   2                   3
//    0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
//   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//   |PIM Ver| Type  |   Reserved    |           Checksum            |
//   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//
// We model the fixed 4-byte common header exactly. The per-type body that
// follows (e.g. a Hello's TLV options, or a Join/Prune's encoded
// source/group addresses) is variable and type-specific, so it falls through
// as node.payload rather than being invented as fixed fields. See the `note`
// on the Type field and the `desc` on Checksum.
import type { ProtocolSpec } from '../core/types';

// RFC 7761 §4.9 message-type table. Types 6-8 are listed there too; 6/7 are
// PIM Dense Mode only, 8 is the BSR Candidate-RP-Advertisement.
const TYPE: Record<number, string> = {
  0: 'Hello',
  1: 'Register',
  2: 'Register-Stop',
  3: 'Join/Prune',
  4: 'Bootstrap',
  5: 'Assert',
  6: 'Graft (PIM-DM)',
  7: 'Graft-Ack (PIM-DM)',
  8: 'Candidate-RP-Advertisement',
};

export const pim: ProtocolSpec = {
  id: 'pim',
  name: 'PIM-SM v2',
  layer: 3,
  summary:
    'Protocol Independent Multicast - Sparse Mode: the standard multicast routing protocol. It rides directly inside IP (protocol 103), reuses the unicast routing table for Reverse Path Forwarding instead of building its own, and uses explicit Join/Prune messages to graft receivers onto a distribution tree. Every PIM message begins with this 4-byte common header.',
  fields: [
    {
      name: 'version',
      label: 'PIM Ver',
      bits: 4,
      decode: (v) => (v === 2 ? '2 (PIM v2, RFC 7761)' : String(v)),
      note: 'Always 2 for the modern PIM (PIMv2). A message with an unrecognized version MUST be discarded.',
      desc: 'The PIM protocol version, carried in the high nibble of the first byte. This spec models version 2 (RFC 7761), the version used by every current PIM-SM and PIM-DM deployment.',
      detail: `PIM VER (4 bits): "PIM Version number is 2." (RFC 7761 §4.9).

It is the first 4 bits of the message. Version 1 was an early, pre-standard,
UDP-encapsulated variant (it used IGMP-style framing) and is long obsolete;
RFC 7761 mandates version 2 carried directly in IP. RFC 7761 §4.9 says a
message received with an unrecognized PIM Ver (or Type) MUST be discarded and
an error SHOULD be logged in a rate-limited manner.

PIM "version" is independent of which mode is in use: both Sparse Mode (RFC
7761) and the older Dense Mode (RFC 3973) are PIMv2 — they share this header
and differ only in message semantics and which types they use.`,
    },
    {
      name: 'type',
      label: 'Type',
      bits: 4,
      type: 'enum',
      enumMap: TYPE,
      note: 'Which PIM message this is (low nibble of byte 0). The type-specific body follows the 4-byte header and lands in the payload.',
      desc: 'The PIM message type, in the low nibble of the first byte. It selects which body follows the common header: Hello maintains neighbors, Register/Register-Stop bootstrap a source via the RP, Join/Prune builds and tears the tree, Bootstrap and Assert handle RP discovery and forwarder election.',
      detail: `TYPE (4 bits) — PIM message types (RFC 7761 §4.9):
- 0 Hello: sent periodically on every interface (default every 30s) to
  discover PIM neighbors, elect the Designated Router (DR), and exchange
  capabilities (Holdtime, DR Priority, Generation ID, LAN Prune Delay). Body =
  a list of TLV options. Multicast to ALL-PIM-ROUTERS (224.0.0.13).
- 1 Register: the source's first-hop DR encapsulates the multicast data and
  UNICASTS it to the Rendezvous Point (RP) so the RP learns the source. Body =
  flags + the original multicast data packet (which the checksum skips).
- 2 Register-Stop: the RP unicasts this back to the DR to tell it to stop
  Register-encapsulating once a native (S,G) path exists.
- 3 Join/Prune: the workhorse — multicast to ALL-PIM-ROUTERS, it grafts (Join)
  or removes (Prune) (S,G) and (*,G) entries on the upstream router, building
  and pruning the shared/source distribution trees.
- 4 Bootstrap (BSR): floods the elected set of candidate RPs hop-by-hop so
  every router agrees on which RP serves which group range.
- 5 Assert: when two routers both forward onto the same LAN, they exchange
  Asserts (metric, then IP address as tiebreak) to elect ONE forwarder and
  avoid duplicate delivery.
- 6/7 Graft / Graft-Ack: PIM Dense Mode only (RFC 3973), to quickly re-add a
  pruned branch.
- 8 Candidate-RP-Advertisement: a candidate RP unicasts itself to the BSR.

NOTE: Apex models only the fixed 4-byte common header. The per-type body is
variable and type-specific, so it is intentionally left in node.payload rather
than fabricated as fixed fields.`,
    },
    {
      name: 'reserved',
      label: 'Reserved',
      bits: 8,
      type: 'hex',
      note: 'Set to zero on transmission, ignored on receipt. Some flag bits were later assigned by RFC 9436.',
      desc: 'The second byte of the common header. RFC 7761 defines it as reserved: senders set it to zero and receivers ignore it. Later work (RFC 8736 / RFC 9436) repurposed parts of this space as per-type flag bits.',
      detail: `RESERVED (8 bits): "Set to zero on transmission. Ignored upon receipt."
(RFC 7761 §4.9).

This byte sits between the Ver/Type byte and the Checksum. Because the original
8 bits were untouched, later RFCs reclaimed them:
- RFC 8736 / RFC 9436 redefined this field as "Flag Bits" and allowed each
  message type to define its own flags here (e.g. extending the type space).
Unless a specific type assigns meaning, all bits MUST still be sent as zero and
ignored, so for an interoperable PIMv2 Hello this byte reads 0x00.`,
    },
    {
      name: 'checksum',
      label: 'Checksum',
      bits: 16,
      type: 'hex',
      note: "Standard IP one's-complement checksum over the entire PIM message — except a Register's encapsulated data packet, which is excluded.",
      desc: "A 16-bit Internet (RFC 1071) checksum over the whole PIM message starting at this common header. For Register messages the encapsulated multicast data is excluded. Over IPv6 an IPv6 pseudo-header is prepended.",
      detail: `CHECKSUM (16 bits, RFC 7761 §4.9): "The checksum is a standard IP checksum,
i.e., the 16-bit one's complement of the one's complement sum of the entire PIM
message, excluding the 'Multicast data packet' section of the Register message.
For computing the checksum, the checksum field is zeroed. If the packet's length
is not an integral number of 16-bit words, the packet is padded with a trailing
byte of zero before performing the checksum."

REGISTER EXCEPTION: a Register message carries a whole encapsulated multicast
data packet; that section is NOT covered, so only the PIM Register header (the
common header + 4-byte flags word = 8 bytes for IPv4) is checksummed. This keeps
the checksum cheap and lets the inner packet's own IP checksum protect it.

IPv6 (RFC 7761 §4.9): the checksum additionally covers an IPv6 pseudo-header
(RFC 2460 §8.1) prepended to the PIM message, with Next Header = 103 and the
"Upper-Layer Packet Length" = the PIM message length (or 8 for a Register).
There is NO pseudo-header for IPv4.

VERIFICATION: because the checksum covers the type-specific body that follows
this 4-byte header, it cannot be recomputed from the header alone — the full
message bytes are needed. As with RFC 1071, summing every 16-bit word of an
intact message (checksum included) yields 0.`,
    },
  ],
  // The PIM common header is a fixed 4 bytes (RFC 7761 §4.9).
  headerBytes: () => 4,
  // The body is type-specific (Hello TLVs, Join/Prune encoded addresses,
  // Register's encapsulated packet, ...) and variable-length; there is no
  // generic child protocol to dissect, so dissection stops here and the body is
  // exposed as node.payload.
  next: () => null,
};
