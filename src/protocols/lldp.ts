// LLDP — Link Layer Discovery Protocol. IEEE Std 802.1AB
// ("Station and Media Access Control Connectivity Discovery").
//
// LLDP lets a device advertise its identity and capabilities to directly
// connected neighbours on a LAN. It is carried directly in an Ethernet frame
// (EtherType 0x88CC, destination usually the 01:80:C2:00:00:0E nearest-bridge
// multicast group). It is a one-way, stateless advertisement — there is no
// request/response and frames are never forwarded by a bridge.
//
// THE LLDPDU IS A SEQUENCE OF TLVs (IEEE 802.1AB §8.4)
// ----------------------------------------------------
// The Ethernet payload (the LLDPDU) is a chain of Type-Length-Value structures.
// Each TLV begins with a 2-byte (16-bit) header:
//
//   bits 15..9  TLV Type   (7 bits)  — what kind of information this is
//   bits  8..0  TLV Length (9 bits)  — length in OCTETS of the value that
//                                       follows (0..511), NOT counting these 2 bytes
//
// then `Length` octets of value. TLVs are big-endian / network order, so the
// 7-bit type occupies the most-significant bits of the first byte and the 9-bit
// length spans the low bit of byte 0 plus all of byte 1.
//
// A valid LLDPDU MUST begin with three mandatory TLVs IN ORDER (§8.4):
//   1. Chassis ID  (Type 1)
//   2. Port ID     (Type 2)
//   3. Time To Live (Type 3)
// followed by optional TLVs, and ending with the End of LLDPDU TLV (Type 0,
// length 0 — the two zero bytes 0x00 0x00).
//
// WHAT THIS SPEC MODELS
// ---------------------
// We model the FIRST TLV's 2-byte header only (Type + Length). The TLV's value
// and every subsequent TLV in the chain fall through as node.payload — modelling
// the whole variable chain as fixed Fields is not possible (the layout depends on
// each TLV's type and length, just like HTTP's text framing). The byte view still
// shows the real value bytes after the header, and the teaching below documents
// the chain. headerBytes()=>2 consumes only the TLV header; pduBytes bounds the
// payload to exactly this TLV's value so the next TLV does not leak in; next()
// returns null because the remaining TLVs are LLDP-internal, not a child protocol.
//
// CHASSIS ID TLV (Type 1) value layout (§8.5.2): a 1-byte Chassis ID Subtype
// followed by the identifier. Subtype 4 = MAC address (a 6-byte EUI-48), the most
// common form. The capture in the test is exactly this case.
import type { ProtocolSpec } from '../core/types';

// TLV Type (7 bits) -> name (IEEE 802.1AB Table 8-1).
const TLV_TYPE: Record<number, string> = {
  0: 'End of LLDPDU',
  1: 'Chassis ID',
  2: 'Port ID',
  3: 'Time To Live',
  4: 'Port Description',
  5: 'System Name',
  6: 'System Description',
  7: 'System Capabilities',
  8: 'Management Address',
  127: 'Organizationally Specific',
};

export const lldp: ProtocolSpec = {
  id: 'lldp',
  name: 'LLDP',
  layer: 2,
  summary:
    'IEEE 802.1AB neighbour discovery, carried in an Ethernet frame (EtherType 0x88CC). The payload (LLDPDU) is a chain of Type-Length-Value structures: a mandatory Chassis ID, Port ID and Time-To-Live, then optional TLVs, ending with an empty End-of-LLDPDU TLV. Each TLV header packs a 7-bit type and a 9-bit length into two big-endian bytes.',
  fields: [
    {
      name: 'tlvType',
      label: 'TLV Type',
      bits: 7,
      type: 'enum',
      enumMap: TLV_TYPE,
      note: 'The top 7 bits of the first byte. 1=Chassis ID, 2=Port ID, 3=TTL (the three mandatory TLVs), 0=End of LLDPDU, 127=Org-specific.',
      desc:
        'The 7-bit type that names this TLV. It occupies the most-significant 7 bits of the first header byte (the 9-bit length fills the rest). A valid LLDPDU always starts with Chassis ID (1), then Port ID (2), then Time To Live (3).',
      detail: `TLV TYPE (7 bits, IEEE 802.1AB Table 8-1):
0   = End of LLDPDU      (length 0; terminates the chain)
1   = Chassis ID         (MANDATORY, first)
2   = Port ID            (MANDATORY, second)
3   = Time To Live       (MANDATORY, third)
4   = Port Description    (optional)
5   = System Name         (optional)
6   = System Description   (optional)
7   = System Capabilities (optional)
8   = Management Address  (optional)
9-126 = reserved
127 = Organizationally Specific (vendor TLVs; value begins with a 3-byte OUI + 1-byte subtype)

BIT POSITION: this is the high 7 bits of byte 0. For a Chassis ID TLV (type 1) of value length 7, the two header bytes are 0x02 0x07: byte 0 = 0000001 0 (type=1, top length bit=0), byte 1 = 0000 0111 (length low 8 bits = 7).

ORDERING RULE (§8.4): the first three TLVs MUST be Chassis ID, Port ID, TTL in that exact order; the LLDPDU MUST end with the End TLV. A receiver that sees them out of order discards the LLDPDU.`,
    },
    {
      name: 'tlvLength',
      label: 'TLV Length',
      bits: 9,
      decode: (v) => `${v} byte${v === 1 ? '' : 's'} of value follow`,
      note: 'The low 9 bits of the 2-byte header: the length in OCTETS of the value (0..511), NOT counting these 2 header bytes.',
      desc:
        'The 9-bit length, in octets, of the value that follows this header (0 to 511). It spans the low bit of byte 0 and all of byte 1. It does NOT include the 2-byte TLV header itself, so the next TLV starts 2 + Length bytes after this TLV begins.',
      detail: `TLV LENGTH (9 bits): the number of octets in the information string (value) that follows the 2-byte header. Range 0-511.

SPANS TWO BYTES: because the type takes 7 bits, the length's most-significant bit is the low bit of byte 0 and its remaining 8 bits are byte 1. Reading the two header bytes big-endian and masking the low 9 bits recovers the length.

WALKING THE CHAIN: a parser reads 2 header bytes, then skips Length value bytes to reach the next TLV, repeating until the End of LLDPDU TLV (type 0, length 0 = the bytes 0x00 0x00).

EXAMPLE (Chassis ID, MAC subtype): value = 1-byte subtype (4 = MAC address) + 6-byte EUI-48 = 7 octets, so Length = 7.`,
    },
  ],
  // Only the 2-byte TLV header is a fixed binary header.
  headerBytes: () => 2,
  // Bound the payload to exactly this TLV's value (Length octets) so the
  // following TLVs in the chain do not leak into this TLV's value.
  pduBytes: (h) => 2 + h.get('tlvLength'),
  // The TLV value and the remaining TLVs are LLDP-internal data, not a child
  // protocol, so dissection stops here.
  next: () => null,
};
