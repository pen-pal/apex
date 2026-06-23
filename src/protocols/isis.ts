// IS-IS — Intermediate System to Intermediate System intra-domain routing.
// ISO/IEC 10589:2002 (the base standard), clause 9 "Structure and Encoding of
// PDUs". Republished by the IETF as RFC 1142, and extended to carry IP routing
// information ("Integrated IS-IS" / "Dual IS-IS") by RFC 1195.
//
// IS-IS is a link-state interior gateway protocol, like OSPF — routers flood
// descriptions of their links (in Link State PDUs), every router builds an
// identical link-state database, and each runs Dijkstra's SPF over it. The
// distinguishing fact about IS-IS, and the reason it lives at layer 2 here, is
// that it runs DIRECTLY OVER THE DATA LINK — it is an OSI CLNS protocol and is
// NOT carried inside IP at all. There is no IP header, no UDP/TCP port: an
// IS-IS PDU sits straight on top of the Ethernet/802.3 (LLC, DSAP/SSAP 0xFE)
// or PPP frame. This is why a router can form an IS-IS adjacency before it has
// any IP address configured on the link.
//
// THE COMMON HEADER (8 octets) is identical for every PDU type. After it comes
// a PDU-TYPE-SPECIFIC fixed header (e.g. for a LAN Hello: a circuit-type byte,
// the 6-octet Source ID, Holding Time, PDU Length, Priority and LAN ID) and
// then a sequence of TLVs (Type-Length-Value triplets — "Variable Length
// Fields" in ISO 10589 terms) carrying area addresses, IS neighbours, IP
// reachability, etc. We model the fixed 8-byte common header exactly and stop;
// the type-specific header and the TLVs are variable and fall through as
// node.payload. See the note on the PDU Type field.
//
// Common header layout (ISO/IEC 10589 clause 9.5, octet diagram), big-endian:
//   octet 1  Intradomain Routeing Protocol Discriminator = 0x83
//   octet 2  Length Indicator (length of the fixed header in octets)
//   octet 3  Version/Protocol ID Extension = 1
//   octet 4  ID Length
//   octet 5  bits 6-8 = R (reserved, 0); bits 1-5 = PDU Type
//   octet 6  Version = 1
//   octet 7  Reserved (transmitted as 0, ignored on receipt)
//   octet 8  Maximum Area Addresses
import type { ProtocolSpec } from '../core/types';

// PDU Type codes (ISO/IEC 10589 clause 9, Table). Only the low 5 bits of
// octet 5 carry the type; the high 3 bits are reserved.
const PDU_TYPE: Record<number, string> = {
  15: 'L1 LAN IS-IS Hello (IIH)',
  16: 'L2 LAN IS-IS Hello (IIH)',
  17: 'Point-to-Point IS-IS Hello (IIH)',
  18: 'L1 Link State PDU (LSP)',
  20: 'L2 Link State PDU (LSP)',
  24: 'L1 Complete Sequence Numbers PDU (CSNP)',
  25: 'L2 Complete Sequence Numbers PDU (CSNP)',
  26: 'L1 Partial Sequence Numbers PDU (PSNP)',
  27: 'L2 Partial Sequence Numbers PDU (PSNP)',
};

export const isis: ProtocolSpec = {
  id: 'isis',
  name: 'IS-IS',
  layer: 2,
  summary:
    'A link-state interior routing protocol (ISO/IEC 10589) that runs DIRECTLY over the data link, not inside IP — so routers can become neighbours before any IP address is configured. Like OSPF, they flood Link State PDUs, build an identical database, and run Dijkstra. Every IS-IS PDU begins with this 8-byte common header identifying the protocol, the PDU type, and the addressing parameters of the routing domain.',
  fields: [
    {
      name: 'irpDiscriminator',
      label: 'Intradomain Routing Protocol Discriminator',
      bits: 8,
      type: 'hex',
      decode: (v) => (v === 0x83 ? '0x83 (IS-IS / ISO 10589)' : `0x${v.toString(16)} (not IS-IS)`),
      note: 'Architectural constant 0x83 that marks the frame as IS-IS.',
      desc: 'The first byte of every IS-IS PDU, an architectural constant fixed at 0x83. Because IS-IS rides directly on the data link with no IP or port to demultiplex on, this discriminator is how a receiver recognises the payload as IS-IS in the first place.',
      detail: `INTRADOMAIN ROUTEING PROTOCOL DISCRIMINATOR (8 bits) = 0x83, "an architectural constant" (ISO/IEC 10589 clause 9.5).

WHY IT MATTERS HERE: IS-IS is an OSI Connectionless Network Service (CLNS) protocol. It is NOT encapsulated in IP — there is no IP header and no UDP/TCP port number to identify it. On an 802.3 LAN the frame carries an 802.2 LLC header with DSAP = SSAP = 0xFE (the ISO Network Layer), and the very first byte of that network-layer payload is this 0x83 discriminator (the ISO 9577 Network Layer Protocol Identifier for IS-IS). On a point-to-point link IS-IS rides over PPP with protocol 0x0023 (OSI Network Layer).

This is the concrete reason IS-IS is placed at layer 2 in Apex: dissection of the link frame hands its payload straight to IS-IS, with no intervening IPv4/IPv6 node.`,
    },
    {
      name: 'lengthIndicator',
      label: 'Length Indicator',
      bits: 8,
      decode: (v) => `${v} bytes of fixed header (common + PDU-specific) before the TLVs`,
      note: 'Length in octets of the fixed header (the common header plus the PDU-type-specific header).',
      desc: 'The number of octets in the fixed header — the 8-byte common header plus the PDU-type-specific fixed header that follows it. It tells the receiver where the fixed fields end and the variable-length TLVs begin. For an L1 LAN Hello this value is 27.',
      detail: `LENGTH INDICATOR (8 bits): "Length of the fixed header in octets" (ISO/IEC 10589 clause 9.5).

It does NOT bound the whole PDU — that is the job of the PDU Length field inside the type-specific header. The Length Indicator only marks the boundary between the fixed header and the TLV (Variable Length Fields) region, so the parser knows where to start walking the Type-Length-Value triplets.

TYPICAL VALUES (8-byte common header + type-specific header):
- L1/L2 LAN Hello: 27 (8 + 19: circuit type, 6-byte Source ID, holding time, PDU length, priority, 7-byte LAN ID)
- Point-to-Point Hello: 20
- L1/L2 LSP: 27
- CSNP: 33 ; PSNP: 17
These depend on ID Length being 0 (i.e. a 6-octet system ID, the universal default).`,
    },
    {
      name: 'versionProtocolIdExtension',
      label: 'Version/Protocol ID Extension',
      bits: 8,
      decode: (v) => (v === 1 ? '1' : String(v)),
      note: 'Always 1.',
      desc: 'A protocol-versioning byte, fixed at 1 in all deployed IS-IS. It is distinct from the Version field at octet 6; ISO 10589 carries both for historical reasons and both are simply 1.',
      detail: `VERSION/PROTOCOL ID EXTENSION (8 bits) = 1 (ISO/IEC 10589 clause 9.5).

IS-IS has two separate "version" octets in the common header (this one at octet 3 and "Version" at octet 6). Both are defined as the constant 1. They are vestigial version-negotiation hooks from the original OSI design; in practice an implementation checks that both equal 1 and otherwise discards the PDU. They were never used to roll a new wire version — protocol evolution instead happens entirely through new TLVs, which older routers ignore.`,
    },
    {
      name: 'idLength',
      label: 'ID Length',
      bits: 8,
      decode: (v) => (v === 0 ? '0 (means 6-octet system IDs)' : v === 255 ? '255 (means null, 0-octet IDs)' : `${v}-octet system IDs`),
      note: '0 is special and means 6-octet IDs; 1-8 are literal lengths; 255 means a null (0-length) ID.',
      desc: 'The length, in octets, of the System ID used for NSAP addresses and NETs throughout this routing domain. The value 0 is special and means the universal default of 6 octets (a MAC-address-sized ID); 255 means a null, zero-length ID; 1-8 are taken literally.',
      detail: `ID LENGTH (8 bits) — "Length of the ID field of NSAP addresses and NETs used in this routeing domain" (ISO/IEC 10589 clause 9.5):
- 1-8: an ID field of exactly that many octets.
- 0: the special, near-universal default meaning a 6-OCTET ID. Six octets is convenient because a router can derive its System ID from one of its MAC addresses.
- 255: a NULL (zero-length) ID field.
All other values are illegal and the PDU must be discarded.

WHY IT IS IN THE COMMON HEADER: the System ID length determines the size of several later fields — the Source ID, the LAN ID, and the IDs inside TLVs. A parser must know it before it can locate those fields, so it is fixed once per routing domain and announced in every PDU. Apex models the common header only, so it does not itself consume the ID-length-dependent fields, but reports the value so a learner can see the domain-wide setting.`,
    },
    {
      name: 'reservedPduType',
      label: 'R / PDU Type',
      bits: 8,
      type: 'enum',
      enumMap: PDU_TYPE,
      decode: (v) => {
        const type = v & 0x1f;
        const name = PDU_TYPE[type];
        const r = v >> 5;
        return `${name ?? `type ${type} (unknown)`}${r ? ` [reserved bits set: 0b${r.toString(2).padStart(3, '0')}]` : ''}`;
      },
      note: 'High 3 bits = Reserved (0); low 5 bits = PDU Type. 15 = L1 LAN Hello, 16 = L2 LAN Hello, 17 = P2P Hello, 18/20 = L1/L2 LSP, 24/25 = L1/L2 CSNP, 26/27 = L1/L2 PSNP.',
      desc: 'One byte split between a 3-bit Reserved field (high bits, transmitted as 0) and the 5-bit PDU Type (low bits). The type selects which kind of IS-IS message this is and therefore which type-specific fixed header follows the common header.',
      detail: `R / PDU TYPE (8 bits): "PDU Type (bits 1 through 5). Note bits 6, 7 and 8 are Reserved, which means they are transmitted as 0 and ignored on receipt." (ISO/IEC 10589 clause 9.5).

BIT LAYOUT of this byte (MSB first):
  bit 8 7 6 | 5 4 3 2 1
  [ R R R ] | [ PDU TYPE ]
So the type is read by masking the low 5 bits (value & 0x1F). For an L1 LAN Hello the byte is 0x0F = 0b000_01111 → reserved 000, type 15.

THE PDU TYPES (low 5 bits):
- 15  L1 LAN IIH — Level 1 LAN Hello, multicast to AllL1ISs (01:80:C2:00:00:14) to discover Level 1 neighbours on a broadcast circuit and elect the Designated IS (DIS).
- 16  L2 LAN IIH — Level 2 LAN Hello, multicast to AllL2ISs (01:80:C2:00:00:15).
- 17  P2P IIH — the single Hello type used on point-to-point links (one Hello serves both levels).
- 18  L1 LSP / 20  L2 LSP — Link State PDUs: the actual topology/reachability advertisements that are flooded and stored in the link-state database.
- 24  L1 CSNP / 25  L2 CSNP — Complete Sequence Numbers PDUs: a summary of the entire database (sent periodically by the DIS on a LAN) so neighbours can detect what they are missing.
- 26  L1 PSNP / 27  L2 PSNP — Partial Sequence Numbers PDUs: acknowledge LSPs and request specific missing ones.

NOTE: Apex models only the 8-byte common header. The type-specific fixed header (for a LAN Hello: circuit type, Source ID, Holding Time, PDU Length, Priority, LAN ID) and the trailing TLVs are variable, so they are intentionally left in node.payload rather than fabricated as fixed fields.`,
    },
    {
      name: 'version',
      label: 'Version',
      bits: 8,
      decode: (v) => (v === 1 ? '1' : String(v)),
      note: 'Always 1 (a second version octet, distinct from octet 3).',
      desc: 'A second version byte, also fixed at 1. ISO 10589 defines two separate version octets in the common header (this one and the Version/Protocol ID Extension at octet 3); both are constant 1 and a receiver verifies both.',
      detail: `VERSION (8 bits) = 1 (ISO/IEC 10589 clause 9.5).

This is the octet-6 "Version", separate from the octet-3 "Version/Protocol ID Extension". Both are the constant 1. The redundancy is historical: the OSI common-header design reserved two independent versioning hooks, but the protocol has never bumped either. In practice IS-IS extensibility is delivered entirely through new TLVs (which unknown-code receivers ignore), so these version bytes have stayed pinned at 1 across the IPv4 and IPv6 (RFC 5308) eras.`,
    },
    {
      name: 'reserved',
      label: 'Reserved',
      bits: 8,
      type: 'hex',
      note: 'Transmitted as 0, ignored on receipt.',
      desc: 'A reserved octet. ISO 10589 specifies it is transmitted as zero and ignored on receipt. In the original ISO DP 10589 / RFC 1142 layout this octet position held an "ECO" (engineering-change-order) byte; the published standard reserves it.',
      detail: `RESERVED (8 bits): transmitted as 0, ignored on receipt (ISO/IEC 10589 clause 9.5).

HISTORY: the early draft of the standard (ISO DP 10589, republished as RFC 1142) labelled octets 7 and 8 of the common header "ECO" and "User ECO" (Engineering Change Order bytes). The final ISO/IEC 10589 standard repurposed octet 8 as "Maximum Area Addresses" (the next field) and left octet 7 as a plain Reserved byte. A conformant sender writes 0 here; a receiver must not reject a PDU on account of its value.`,
    },
    {
      name: 'maximumAreaAddresses',
      label: 'Maximum Area Addresses',
      bits: 8,
      decode: (v) => (v === 0 ? '0 (means the default of 3)' : `${v}`),
      note: 'Number of area addresses permitted for this domain; 0 means the default of 3.',
      desc: 'The number of area addresses this Intermediate System supports for the area. The value must match between neighbours or the adjacency is rejected. The special value 0 means the architectural default of 3 area addresses.',
      detail: `MAXIMUM AREA ADDRESSES (8 bits) — the number of area addresses permitted in this routing domain (ISO/IEC 10589 clause 9.5):
- 0: the special default value, meaning a maximum of 3 area addresses.
- 1-254: that literal maximum.

WHY AREAS CAN HAVE SEVERAL ADDRESSES: an IS-IS area is normally named by a single Area Address, but the standard allows up to a few so an operator can renumber gracefully — an area can temporarily hold both its old address A and its new address B (and routers in either are considered to be in the same area) until the migration completes.

ADJACENCY CHECK: this value is compared on Hello PDUs. If two neighbours disagree on Maximum Area Addresses they will refuse to form an adjacency, so the field is part of the parameter agreement that protects a domain from misconfiguration — much like mismatched OSPF hello/dead intervals prevent adjacency. The actual area addresses themselves are carried later, in the Area Addresses TLV (code 1) in the variable-length part of Hello and LSP PDUs.`,
    },
  ],
  // The common header is a fixed 8 octets (ISO/IEC 10589 clause 9.5). The
  // Length Indicator field measures the larger fixed header (common +
  // type-specific), but the portion Apex models — the part common to every PDU
  // type — is exactly 8 bytes.
  headerBytes: () => 8,
  // The PDU-type-specific fixed header and the trailing TLVs (Variable Length
  // Fields) are variable and type-specific; there is no generic child protocol
  // to dissect, so dissection stops here and the rest is exposed as
  // node.payload. (PDU Length, which would bound the whole PDU, lives inside the
  // type-specific header that we do not model, so no pduBytes is set.)
  next: () => null,
};
