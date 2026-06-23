// VXLAN (Virtual eXtensible Local Area Network). RFC 7348 (2014).
//
// VXLAN is a MAC-in-UDP network overlay: it tunnels an entire inner Ethernet
// (Layer-2) frame across a Layer-3 IP network, letting a single L2 segment span
// routed boundaries (the foundation of multi-tenant data-center fabrics and SDN).
//
// Encapsulation stack on the wire (RFC 7348 §5):
//   Outer Ethernet | Outer IP | Outer UDP (dst port 4789) | VXLAN (8 bytes) |
//   INNER Ethernet | Inner IP | ... | (original frame, unchanged)
//
// The endpoints that add/strip this header are VTEPs (VXLAN Tunnel End Points).
// The 24-bit VNI gives ~16 million logical segments, vastly more than the
// 12-bit (4094-usable) VLAN ID it replaces.
//
// The VXLAN header itself is a fixed 8 bytes (RFC 7348 §5):
//   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//   |R|R|R|R|I|R|R|R|            Reserved                           |
//   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//   |                VXLAN Network Identifier (VNI) |   Reserved    |
//   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
// Flags(8) Reserved0(24) VNI(24) Reserved1(8). Big-endian (network order).
import type { ProtocolSpec } from '../core/types';

export const vxlan: ProtocolSpec = {
  id: 'vxlan',
  name: 'VXLAN',
  layer: 7, // an overlay/encapsulation that rides on UDP (RFC 7348 dst port 4789)
  summary: 'A MAC-in-UDP overlay that tunnels a whole inner Ethernet frame across a routed IP network, using a 24-bit VNI to identify up to ~16M virtual L2 segments.',
  fields: [
    {
      name: 'flags',
      label: 'Flags',
      bits: 8,
      type: 'flags',
      // Bit order MSB-first: R R R R I R R R. flagBits[0] = most-significant bit.
      flagBits: ['R', 'R', 'R', 'R', 'I', 'R', 'R', 'R'],
      note: 'Only the I bit (0x08) is defined: it MUST be 1 for the VNI field to be valid.',
      desc: 'An 8-bit flags field in which only the I (Instance) bit — bit value 0x08, the 5th bit from the MSB — is defined. RFC 7348 requires I=1 for a valid VNI; the other seven bits are reserved and set to 0 by the sender and ignored by the receiver.',
      detail: `FLAGS BYTE (RFC 7348 §5), bits laid out MSB-first as: R R R R I R R R
- I (the 5th bit, mask 0x08): "the I flag MUST be set to 1 for a valid VXLAN Network ID (VNI)." A frame with I=0 carries a reserved/invalid VNI and is dropped.
- R bits: Reserved. The sender MUST set them to zero; the receiver MUST ignore them.

A correctly formed VXLAN header therefore has Flags = 0x08.

WHY A WHOLE BYTE FOR ONE BIT: VXLAN was kept deliberately simple. Later extensions reuse these reserved bits — e.g. VXLAN-GPE (Generic Protocol Extension) repurposes them to add Version, a Next-Protocol field and an O (OAM) bit so the payload can be IPv4/IPv6/MPLS instead of only Ethernet. Plain RFC 7348 VXLAN, modeled here, always carries an inner Ethernet frame.`,
    },
    {
      name: 'reserved0',
      label: 'Reserved',
      bits: 24,
      type: 'hex',
      note: 'Reserved; sent as 0, ignored on receipt.',
      desc: 'The 24 reserved bits that fill out the first 32-bit word after the flags byte. RFC 7348 specifies they are set to zero by the sender and ignored by the receiver; they carry no meaning in base VXLAN.',
      detail: `RESERVED (24 bits): set to zero on transmit, ignored on receive. Together with the 7 reserved bits in the Flags byte, this is space that VXLAN intentionally left unused.

EXTENSIONS that claimed this space:
- VXLAN-GPE (draft / RFC 9252 context) uses part of the flags + a Next Protocol byte here.
- "Group Policy" VXLAN (VXLAN-GBP) uses these bytes for a 16-bit Group Policy ID.
Base RFC 7348 keeps them as zero Reserved.`,
    },
    {
      name: 'vni',
      label: 'VNI',
      bits: 24,
      note: 'VXLAN Network Identifier: the 24-bit overlay segment ID (~16M values).',
      desc: 'The 24-bit VXLAN Network Identifier — the tenant/segment ID that scopes the inner frame to one overlay L2 segment. It is the VXLAN analogue of a VLAN ID, but 24 bits wide (~16.7 million segments) instead of 12.',
      detail: `VNI (24 bits, valid only when the I flag = 1):
- Identifies the logical Layer-2 segment the inner Ethernet frame belongs to. Two tenants can reuse the same inner MACs/IPs because their traffic is isolated by different VNIs.
- 2^24 = 16,777,216 possible identifiers, versus the 12-bit 802.1Q VLAN ID's 4096 (4094 usable). Scaling past the VLAN limit is the central reason VXLAN exists for multi-tenant clouds.

VTEP BEHAVIOUR: the ingress VTEP looks up the inner frame's segment, writes the VNI here, and sends to the egress VTEP; the egress VTEP uses the VNI to pick the right bridge domain before forwarding the decapsulated inner frame.

ENDIANNESS: 24-bit big-endian. The VNI occupies the top 3 bytes of the second 32-bit word; the low byte is Reserved.`,
    },
    {
      name: 'reserved1',
      label: 'Reserved',
      bits: 8,
      type: 'hex',
      note: 'Reserved low byte of the VNI word; sent as 0, ignored.',
      desc: 'The final reserved byte, occupying the low 8 bits of the word that holds the 24-bit VNI. Set to zero by the sender and ignored by the receiver.',
      detail: `RESERVED (8 bits): the last byte of the 8-byte VXLAN header. Because the VNI is 24 bits but words are 32 bits wide, this trailing byte pads the VNI word and is reserved (zero on transmit, ignored on receive).`,
    },
  ],
  // Fixed 8-byte header (RFC 7348 §5). No length field bounds the PDU — the inner
  // frame's own length fields do — so there is no pduBytes.
  headerBytes: () => 8,
  // THE KEY TEACHING POINT: a VXLAN payload IS a complete inner Ethernet frame.
  // VXLAN always decapsulates to Ethernet in base RFC 7348 (GPE can change this).
  next: () => 'ethernet',
};
