// RIPv2 — Routing Information Protocol version 2. RFC 2453 (November 1998),
// which obsoletes RFC 1723/1058. A distance-vector interior gateway protocol.
//
// RIP routers periodically advertise their entire routing table to neighbors;
// each route carries a hop-count metric (1-15), and a metric of 16 means
// "infinity" / unreachable. Routers run the Bellman-Ford algorithm: a route
// learned from a neighbor costs that neighbor's advertised metric + 1. RIP is
// simple but converges slowly and is limited to networks at most 15 hops wide.
//
// TRANSPORT: RIPv2 rides over UDP port 520 (RFC 2453 §3.1). Regular updates are
// sent every 30 seconds to the IPv4 multicast group 224.0.0.9 (RIPv1 used the
// subnet broadcast). Requests and triggered updates are also UDP/520.
//
// MESSAGE FORMAT (RFC 2453 §4), all big-endian / network order:
//   0                   1                   2                   3
//   0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
//  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//  | command (1)   | version (1)   |       must be zero (2)        |  <-- 4B header
//  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//  |                                                               |
//  ~       RIP Route Table Entries (20 bytes each, 1..25)          ~  <-- payload
//  |                                                               |
//  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//
// This spec models the fixed 4-byte header. The Route Table Entries (RTEs) that
// follow are 20 bytes each and fall through as the node payload — see the note
// on the Command field for their exact layout. There is no length field in the
// header (the UDP Length bounds the whole datagram), so dissection stops here.
import type { ProtocolSpec } from '../core/types';

// RFC 2453 §4 defines two commands for RIPv2 (3-6 are obsolete/unused).
const COMMAND: Record<number, string> = {
  1: 'Request',
  2: 'Response',
};

export const rip: ProtocolSpec = {
  id: 'rip',
  name: 'RIPv2',
  layer: 7,
  summary:
    'A simple distance-vector interior routing protocol that rides over UDP port 520. Routers periodically multicast their whole routing table; each destination carries a hop-count metric (1-15, with 16 = infinity). This 4-byte header just names the command and version; the 20-byte route entries follow as payload.',
  fields: [
    {
      name: 'command',
      label: 'Command',
      bits: 8,
      type: 'enum',
      enumMap: COMMAND,
      note: '1 = Request (ask a neighbor for its routes), 2 = Response (advertise routes).',
      desc: 'The message type. A Request asks a neighbor to send all or part of its routing table; a Response carries route entries — either a solicited reply or an unsolicited periodic/triggered update. Most RIP traffic on a stable network is unsolicited Responses every 30 seconds.',
      detail: `COMMAND (8 bits, RFC 2453 §4) — the first byte of every RIP message:
- 1 Request: "asks for a response containing all or part of a router's routing
  table." A router coming up multicasts a Request for the whole table (a single
  RTE with Address Family = 0 and Metric = 16) to fill its table quickly instead
  of waiting up to 30s for the next periodic update.
- 2 Response: "containing all or part of the sender's routing table." Three cases
  produce a Response: (a) a reply to a specific Request; (b) a regular periodic
  update, sent every 30 seconds; (c) a triggered update, sent immediately when a
  route's metric changes.

Commands 3-6 (Traceon, Traceoff, Sun reserved, Update/poll) appeared in RIPv1 /
historical implementations and are obsolete; modern RIPv2 uses only 1 and 2.

ROUTE TABLE ENTRY (RTE) LAYOUT — the 20-byte records that follow this header
(1 to 25 per message), modelled here as node.payload (RFC 2453 §4):
  Address Family Identifier (16 bits): 2 = IP (IPv4). The special value 0xFFFF
    marks the FIRST entry as an authentication entry (RFC 2453 §4.1), which
    leaves room for at most 24 real routes instead of 25.
  Route Tag                 (16 bits): an opaque attribute preserved and
    re-advertised; commonly carries the originating BGP AS number to separate
    internal RIP routes from external/redistributed ones.
  IP Address                (32 bits): the destination network or host address.
  Subnet Mask               (32 bits): the mask for that destination — the key
    RIPv2 addition over RIPv1, enabling classless (CIDR/VLSM) routing. 0 = none.
  Next Hop                  (32 bits): the immediate next-hop IP for this route;
    0.0.0.0 means "route through the originator of this advertisement."
  Metric                    (32 bits): hop count, 1-15. A value of 16 means
    INFINITY — the destination is unreachable (this is how RIP advertises a
    withdrawn route and bounds count-to-infinity loops).`,
    },
    {
      name: 'version',
      label: 'Version',
      bits: 8,
      decode: (v) => (v === 2 ? '2 (RIPv2, RFC 2453)' : v === 1 ? '1 (RIPv1, RFC 1058)' : String(v)),
      note: 'Always 2 for RIPv2.',
      desc: 'The RIP protocol version. This spec models version 2 (RFC 2453), which added subnet masks, next-hop, route tags, authentication, and multicast delivery over the classful RIPv1 (RFC 1058). RIPng (RFC 2080) carries IPv6 and uses a different format entirely.',
      detail: `VERSION (8 bits, RFC 2453 §4):
- 1 = RIPv1 (RFC 1058): classful, broadcast-only, no subnet mask field, no
  authentication. Its RTEs leave the Route Tag, Subnet Mask, and Next Hop words
  as "must be zero."
- 2 = RIPv2 (RFC 2453): reuses those previously-zero words to carry a Route Tag,
  Subnet Mask (classless routing), and Next Hop, and adds an authentication entry
  and multicast (224.0.0.9) delivery — all while keeping the same 4-byte header
  and 20-byte RTE size so a v1 router can still parse the basic fields.

COMPATIBILITY: a RIPv2 router can be configured to send v1, v2, or both. The
version is checked per-message; v1 receivers ignore the fields they don't know.

IPv6 note: RIP for IPv6 is a separate protocol, RIPng (RFC 2080), over UDP 521 —
not just a new version number here.`,
    },
    {
      name: 'mustBeZero',
      label: 'Must Be Zero',
      bits: 16,
      type: 'hex',
      note: 'Reserved padding; sent as 0 and ignored on receipt. Aligns the header to 4 bytes.',
      desc: 'A 16-bit reserved field that must be set to zero by the sender and must be ignored by the receiver. It exists only to pad the Command/Version bytes out to a 4-byte (32-bit) boundary so the 20-byte route entries that follow are word-aligned.',
      detail: `MUST BE ZERO (16 bits, RFC 2453 §4): a reserved field. The standard's rule for
all such fields is that they are "set to zero" on transmission and "ignored on
receipt" — a receiver must NOT reject a message just because this is non-zero, so
the value cannot be repurposed by future extensions on existing routers.

PURPOSE: alignment. Command (1B) + Version (1B) = 2 bytes; this 2-byte filler
rounds the header to 4 bytes so every following 20-byte RTE starts on a 32-bit
boundary. RIPv1 had the same field in the same place, which is part of why the
v1 and v2 headers are wire-compatible.`,
    },
  ],
  // The header is a fixed 4 bytes (Command + Version + Must-Be-Zero).
  headerBytes: () => 4,
  // The 20-byte Route Table Entries (1..25) follow as payload. RIP has no header
  // length field — the UDP Length bounds the datagram — and there is no child
  // protocol to dissect, so dissection stops here and the RTEs are node.payload.
  next: () => null,
};
