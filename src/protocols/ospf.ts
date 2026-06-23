// OSPFv2 — Open Shortest Path First version 2. RFC 2328 (April 1998),
// Appendix A.3.1 "The OSPF packet header".
//
// OSPF is a link-state interior gateway protocol (IGP): routers flood
// descriptions of their local links (LSAs) throughout an area, each builds an
// identical link-state database, and each runs Dijkstra's shortest-path-first
// algorithm over it to compute its routing table. OSPF does NOT run over a
// transport (no TCP/UDP) — it rides directly inside IP as protocol number 89
// (RFC 2328 §A.1), using IP multicast 224.0.0.5 (AllSPFRouters) and 224.0.0.6
// (AllDRouters) for most messages.
//
// THE COMMON HEADER (24 bytes) sits at the front of all five packet types:
//   Hello (1), Database Description (2), Link State Request (3),
//   Link State Update (4), Link State Acknowledgment (5).
// We model the fixed 24-byte common header exactly; the per-type body that
// follows it (e.g. the Hello body with the network mask, hello/dead intervals,
// neighbor list) is variable and type-specific, so it falls through as
// node.payload rather than being invented as fixed fields. See the `note` on
// the Type field.
//
// CHECKSUM SUBTLETY (RFC 2328 §A.3.1): the Checksum is the standard IP (RFC 1071)
// one's-complement checksum over the ENTIRE OSPF packet starting at the header,
// but EXCLUDING the 64-bit Authentication field. With AuType 0 (null) or 1
// (simple password) the Authentication field is not covered; with AuType 2
// (cryptographic / MD5, RFC 2328 §D) the checksum is set to 0 and a trailing
// message digest authenticates the packet instead.
import type { ProtocolSpec } from '../core/types';

const TYPE: Record<number, string> = {
  1: 'Hello',
  2: 'Database Description',
  3: 'Link State Request',
  4: 'Link State Update',
  5: 'Link State Acknowledgment',
};

const AUTYPE: Record<number, string> = {
  0: 'Null (no authentication)',
  1: 'Simple password',
  2: 'Cryptographic (MD5)',
};

export const ospf: ProtocolSpec = {
  id: 'ospf',
  name: 'OSPFv2',
  layer: 3,
  summary:
    'A link-state interior routing protocol that rides directly inside IP (protocol 89), not over TCP/UDP. Routers flood link-state advertisements through an area, build an identical database, and run Dijkstra to compute routes. Every OSPF packet begins with this 24-byte common header identifying the version, packet type, originating router, and area.',
  fields: [
    {
      name: 'version',
      label: 'Version',
      bits: 8,
      decode: (v) => (v === 2 ? '2 (OSPFv2, RFC 2328)' : String(v)),
      note: 'Always 2 for OSPFv2.',
      desc: 'The OSPF protocol version. This spec models version 2 (RFC 2328), used for IPv4. OSPFv3 (RFC 5340), which carries IPv6, uses version 3 and a different header.',
      detail: `VERSION (8 bits): the first byte of every OSPF packet.
- 2 = OSPFv2 (RFC 2328) — runs over IPv4, the protocol modelled here.
- 3 = OSPFv3 (RFC 5340) — runs over IPv6; the common header drops the
  Authentication/AuType fields entirely and relies on IPv6's own security
  mechanisms (and later RFC 7166 for per-LSA authentication).

A receiver reads this byte first so it can reject or dispatch on the version
before parsing anything else.`,
    },
    {
      name: 'type',
      label: 'Type',
      bits: 8,
      type: 'enum',
      enumMap: TYPE,
      note: 'Which of the five OSPF packet types this is. The type-specific body follows the 24-byte header (it is variable and lands in the payload).',
      desc: 'The OSPF packet type (1-5). It selects which body follows the common header: Hello packets discover and maintain neighbors; the other four implement database synchronization and flooding.',
      detail: `TYPE (8 bits) — the five OSPF packet types (RFC 2328 §A.2):
- 1 Hello: sent periodically on every interface (default every 10s on broadcast
  links) to discover neighbors, elect the Designated Router, and keep adjacencies
  alive. The Hello body carries the network mask, hello/dead intervals, options,
  router priority, and the list of neighbors already heard from.
- 2 Database Description (DBD): describes the contents of the link-state database
  during adjacency formation (one router is master, one slave).
- 3 Link State Request (LSR): asks a neighbor for the full copy of LSAs the
  receiver found newer in the DBD exchange.
- 4 Link State Update (LSU): carries one or more full LSAs; this is the flooding
  workhorse that propagates topology changes through the area.
- 5 Link State Acknowledgment (LSAck): acknowledges received LSAs, making
  flooding reliable.

NOTE: Apex models only the fixed 24-byte common header. The per-type body that
follows is variable-length and type-specific, so it is intentionally left in
node.payload rather than fabricated as fixed fields.`,
    },
    {
      name: 'packetLength',
      label: 'Packet length',
      bits: 16,
      decode: (v) => `${v} bytes (24-byte header + ${v - 24} bytes of body)`,
      note: 'Length of the entire OSPF packet in bytes, including this header.',
      desc: 'The total length of the OSPF protocol packet in octets, including the 24-byte common header and the type-specific body. It bounds the PDU so trailing IP padding does not leak into the body.',
      detail: `PACKET LENGTH (16 bits, big-endian): "the length of the OSPF protocol packet
in bytes. This length includes the standard OSPF header." (RFC 2328 §A.3.1).

Because OSPF rides directly in IP, the IP Total Length and this field together
bound the packet; Apex uses Packet Length as pduBytes so the body stops exactly
here and any IP-layer padding falls into the trailer rather than the payload.

A Hello on a broadcast link is typically 44+ bytes (24 header + 20 fixed Hello
fields + 4 bytes per neighbor already heard).`,
    },
    {
      name: 'routerId',
      label: 'Router ID',
      bits: 32,
      type: 'ipv4',
      note: 'The 32-bit ID of the router that originated the packet (written in dotted-quad form, but it is an identifier, not necessarily a reachable address).',
      desc: 'The Router ID uniquely identifies the OSPF router that originated this packet within the autonomous system. It is a 32-bit number written in dotted-decimal notation; it is often set to a loopback address but need not be a routable interface address.',
      detail: `ROUTER ID (32 bits): "The Router ID of the packet's source." (RFC 2328 §A.3.1).

It is the stable identity of a router across all its interfaces and is used as
the vertex name in the link-state database and the SPF graph. Selection (common
implementation behavior): an explicitly configured router-id wins; otherwise the
highest IP address of an up loopback interface; otherwise the highest IP of any
up interface. Using a loopback keeps the Router ID stable even if physical links
flap.

Although formatted as a dotted quad (e.g. 1.1.1.1) it is an OPAQUE identifier —
it does not have to be a pingable address.`,
    },
    {
      name: 'areaId',
      label: 'Area ID',
      bits: 32,
      type: 'ipv4',
      note: 'The OSPF area this packet belongs to. 0.0.0.0 is the backbone (area 0).',
      desc: 'A 32-bit identifier of the OSPF area the packet belongs to. Areas partition the autonomous system to limit flooding; area 0.0.0.0 is the backbone through which all inter-area traffic passes.',
      detail: `AREA ID (32 bits): "A 32 bit number identifying the area that this packet
belongs to. All OSPF packets are associated with a single area." (RFC 2328
§A.3.1). Packets crossing a virtual link are assigned to the backbone.

WHY AREAS: link-state flooding is bounded to an area, and routers only run SPF
over their own area's database. Area Border Routers (ABRs) summarize routes
between areas. The backbone, AREA 0 (0.0.0.0), is special: every non-backbone
area must connect to it (directly or via a virtual link), and all inter-area
traffic transits it. Formatted dotted-decimal (0.0.0.0) but, like the Router ID,
it is just a 32-bit label.`,
    },
    {
      name: 'checksum',
      label: 'Checksum',
      bits: 16,
      type: 'hex',
      note: "Standard IP one's-complement checksum over the whole packet, but EXCLUDING the 64-bit Authentication field.",
      desc: "The standard Internet (RFC 1071) one's-complement checksum computed over the entire OSPF packet, with the important exception that the 64-bit Authentication field is excluded from the sum.",
      detail: `CHECKSUM (16 bits): "The standard IP checksum of the entire contents of the
packet, starting with the OSPF packet header but excluding the 64-bit
authentication field. This checksum is calculated as the 16-bit one's complement
of the one's complement sum of all the 16-bit words in the packet, excepting the
authentication field. If the packet's length is not an integral number of 16-bit
words, the packet is padded with a byte of zero before checksumming." (RFC 2328
§A.3.1).

WHY EXCLUDE AUTH: the Authentication field can change independently of the packet
contents (e.g. a rotating simple password), so folding it into the checksum would
be meaningless.

CRYPTOGRAPHIC AUTH (AuType 2): the Checksum field is set to 0 and is NOT used;
integrity instead comes from an MD5 (or stronger, per RFC 5709) message digest
appended after the packet, keyed by a shared secret, with a non-decreasing
sequence number to defeat replay.`,
    },
    {
      name: 'auType',
      label: 'AuType',
      bits: 16,
      type: 'enum',
      enumMap: AUTYPE,
      note: 'The authentication scheme: 0 null, 1 simple password, 2 cryptographic (MD5). It tells the receiver how to interpret the 64-bit Authentication field.',
      desc: 'Identifies the authentication procedure used for this packet, which determines how the following 64-bit Authentication field is interpreted. 0 = none, 1 = a cleartext password, 2 = cryptographic (MD5) authentication.',
      detail: `AUTYPE (16 bits): "Identifies the authentication procedure to be used for the
packet." (RFC 2328 §A.3.1, defined in Appendix D).
- 0 Null authentication: the 64-bit Authentication field is not examined and may
  be any value. Provides no security.
- 1 Simple password: a 64-bit (8-byte) cleartext password carried in the
  Authentication field, configured per network. Trivially sniffed — only guards
  against accidental misconfiguration.
- 2 Cryptographic authentication: the Authentication field is reused to carry a
  Key ID, the digest length, and a non-decreasing Cryptographic Sequence Number;
  an MD5 digest is appended to the end of the packet. RFC 5709 later added
  stronger HMAC-SHA algorithms.

AuType is a 16-bit field sharing the same 32-bit word as the Checksum above it.`,
    },
    {
      name: 'authentication',
      label: 'Authentication',
      bits: 64,
      type: 'bytes',
      note: 'A 64-bit field whose meaning depends on AuType. It is the one part of the packet EXCLUDED from the Checksum.',
      desc: 'A 64-bit authentication data field whose interpretation depends on AuType: ignored for null, an 8-byte cleartext password for simple, or a structured Key ID / digest-length / sequence-number block for cryptographic authentication.',
      detail: `AUTHENTICATION (64 bits = 8 bytes): "A 64-bit field for use by the authentication
scheme." (RFC 2328 §A.3.1). Its layout depends entirely on AuType:
- AuType 0 (null): unused; not examined by the receiver.
- AuType 1 (simple): the 8 bytes hold a cleartext password.
- AuType 2 (cryptographic, §D.3): the 8 bytes are reinterpreted as
    bytes 0-1: reserved, must be 0
    byte  2:   Key ID
    byte  3:   Authentication Data Length (digest length, e.g. 16 for MD5)
    bytes 4-7: Cryptographic Sequence Number (non-decreasing, anti-replay)
  and a trailing message digest follows the packet body.

This is the ONLY field excluded from the Checksum computation. It is wider than
48 bits, so Apex reads it as raw bytes (type 'bytes') rather than a number.`,
    },
  ],
  // The common header is a fixed 24 bytes (RFC 2328 §A.3.1).
  headerBytes: () => 24,
  // Packet Length bounds the whole OSPF packet so trailing IP padding doesn't leak.
  pduBytes: (h) => h.get('packetLength'),
  // The body is type-specific (Hello/DBD/LSR/LSU/LSAck) and variable-length;
  // there is no generic child protocol to dissect, so dissection stops here and
  // the body is exposed as node.payload.
  next: () => null,
};
