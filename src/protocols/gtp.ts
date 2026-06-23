// GTP-U — GPRS Tunnelling Protocol, User plane (GTPv1-U).
// Normative spec: 3GPP TS 29.281 (GTPv1-U), §5.1 (header format) and §6.1
// (message types). The header format is identical to the GTP-U header defined
// in 3GPP TS 29.060 §6, from which 29.281 was split for Release 8 onwards.
//
// WHAT GTP-U IS
// -------------
// GTP-U is the tunnelling protocol that carries a mobile subscriber's actual
// user-plane traffic (their IP packets) across the mobile core. In 2G/3G it runs
// between SGSN and GGSN; in LTE/EPC between eNodeB and S-GW/P-GW (S1-U, S5/S8);
// in 5G between gNB and UPF (N3). Each subscriber bearer/PDU-session is a tunnel
// identified by a Tunnel Endpoint Identifier (TEID). GTP-U rides on UDP, always
// destination port 2152.
//
// THE HEADER (3GPP TS 29.281 §5.1), big-endian. Mandatory part is 8 octets:
//
//    8 7 6 5 4 3 2 1   (bit numbering: bit 8 = MSB)
//   +-+-+-+-+-+-+-+-+
//   |Version|P|R|E|S|N|   octet 1  Version(3) ProtocolType(1) Reserved(1)
//   +-+-+-+-+-+-+-+-+              ExtHdrFlag E(1) SeqFlag S(1) N-PDU PN(1)
//   |  Message Type |   octet 2
//   +-+-+-+-+-+-+-+-+
//   |    Length     |   octets 3-4 (length of everything AFTER octet 8)
//   +-+-+-+-+-+-+-+-+
//   |     TEID      |   octets 5-8 (32-bit Tunnel Endpoint Identifier)
//   +-+-+-+-+-+-+-+-+
//   | Seq / N-PDU / Next-Ext-Hdr-Type |  octets 9-12, present iff any of E/S/PN set
//
// THE OPTIONAL FIELDS (octets 9-12) — WHY WE DO NOT MODEL THEM AS FIXED FIELDS
// ---------------------------------------------------------------------------
// Per §5.1, if ANY of E, S or PN is set, then ALL THREE optional fields are
// present together as a block: Sequence Number (2 octets), N-PDU Number (1 octet)
// and Next Extension Header Type (1 octet) — 4 octets total. A field is only
// "meaningful" if its own flag is set, but the 4 octets are physically there as a
// unit whenever the block exists. After that, if E=1 (and the Next Extension
// Header Type is non-zero), one or more variable-length Extension Headers follow,
// each itself a (length, content, next-type) TLV.
//
// So the exact byte offset of the tunnelled payload is variable: 8 bytes if
// E=S=PN=0, otherwise 12+ bytes. Transcribing the optional block as fixed Fields
// would lie about the wire for the common G-PDU-with-no-flags case. We therefore
// model ONLY the mandatory 8-octet header (which is positionally fixed and the
// most common shape for bulk user traffic), surface the three flags so a learner
// can see what WOULD follow, and stop dissection — the inner user IP packet (for
// a G-PDU) or the GTP-C-style message body falls through as node.payload, noted
// below. We deliberately do NOT advance headerBytes past 8: doing so honestly
// would require reading the flags AND walking the extension-header chain, and the
// inner payload's start is therefore documented rather than silently consumed.
import type { ProtocolSpec } from '../core/types';

// GTP-U message types — 3GPP TS 29.281 §6.1, Table 6.1-1. GTP-U uses only a small
// subset of the larger GTPv1 message-type space (the rest belong to GTP-C / GTP').
const MSG_TYPE: Record<number, string> = {
  1: 'Echo Request',
  2: 'Echo Response',
  26: 'Error Indication',
  31: 'Supported Extension Headers Notification',
  254: 'End Marker',
  255: 'G-PDU (tunnelled user packet)',
};

export const gtp: ProtocolSpec = {
  id: 'gtp',
  name: 'GTP-U',
  layer: 7,
  summary:
    'GPRS Tunnelling Protocol, user plane (GTPv1-U, 3GPP TS 29.281): an 8-byte header over UDP port 2152 that tunnels a mobile subscriber’s own IP traffic across the LTE/5G core. The TEID names the per-bearer tunnel; for a G-PDU the payload is the subscriber’s inner IP packet.',
  fields: [
    {
      name: 'version',
      label: 'Version',
      bits: 3,
      note: 'Always 1 for GTPv1-U (this is GTP version 1, user plane).',
      desc: 'The 3-bit GTP version. The value 1 identifies GTPv1-U as defined in 3GPP TS 29.281. It occupies the top three bits of the first octet, so a typical G-PDU first byte 0x30 = 001 1 0 0 0 0 (Version=1, PT=1, all flags clear).',
      detail: `VERSION (3 bits, TS 29.281 §5.1): the only value used for the user plane is 1 (binary 001). GTPv2 (used for GTP-C control signalling in EPC, TS 29.274) is a DIFFERENT protocol with a different header and is not carried here.

POSITION: bits 8-6 (the three most-significant bits) of octet 1. Combined with Protocol Type (bit 5), the reserved bit (bit 4) and the E/S/PN flags (bits 3-1), the first byte of a plain G-PDU with no optional fields is 0x30.

VERSION 0 GTP': GTP version 0 was an older format (TS 09.60) with a 20-byte header; it is obsolete and not modelled here.`,
    },
    {
      name: 'protocolType',
      label: 'Protocol Type (PT)',
      bits: 1,
      decode: (v) => (v === 1 ? '1 (GTP)' : '0 (GTP’ — charging protocol)'),
      note: 'Distinguishes GTP (1) from the older GTP’ charging protocol (0). For GTP-U this is 1.',
      desc: 'The 1-bit Protocol Type. PT=1 means this is GTP (the tunnelling protocol). PT=0 selects GTP’ (GTP-prime), a charging-data-transfer variant defined in 3GPP TS 32.295. GTP-U user traffic always sets PT=1.',
      detail: `PROTOCOL TYPE (1 bit, TS 29.281 §5.1): bit 5 of octet 1.
- PT = 1: GTP — the GPRS Tunnelling Protocol (this protocol, and GTP-C).
- PT = 0: GTP’ (GTP-prime) — reuses the GTP header to ship Charging Data Records (CDRs) between charging nodes (TS 32.295).

For any GTP-U bearer the value is 1. Together with Version=1 in the top bits, the high nibble of a normal GTP-U first octet is 0x3.`,
    },
    {
      name: 'reserved',
      label: 'Reserved',
      bits: 1,
      note: 'Spare bit, set to 0 by the sender and ignored by the receiver.',
      desc: 'A single reserved (spare) bit, bit 4 of octet 1. The sender sets it to 0; the receiver ignores it. It exists to keep the flag bits byte-aligned and is available for future use.',
      detail: `RESERVED (1 bit, TS 29.281 §5.1): bit 4 of octet 1. Defined as spare — transmitted as 0. Receivers must not reject a packet based on this bit. It separates the Protocol Type bit from the three optional-field flags (E, S, PN) that follow in bits 3-1.`,
    },
    {
      name: 'flags',
      label: 'Optional-field flags (E,S,PN)',
      bits: 3,
      type: 'flags',
      flagBits: ['E', 'S', 'PN'],
      note: 'E=Extension Header present, S=Sequence Number present, PN=N-PDU Number present. If ANY is set, a 4-octet optional block follows the mandatory header.',
      desc: 'The three optional-field flags in bits 3-1 of octet 1. E (Extension Header flag), S (Sequence Number flag) and PN (N-PDU Number flag) each say whether the matching optional field carries a meaningful value. Crucially, if ANY of the three is set, the entire 4-octet optional block (Seq Number + N-PDU Number + Next Extension Header Type) is present on the wire.',
      detail: `OPTIONAL-FIELD FLAGS (3 bits, TS 29.281 §5.1), most-significant first:
- E  (bit 3) Extension Header flag: when 1, the Next Extension Header Type field is meaningful and at least one Extension Header follows the optional block. When 0, that field is not interpreted.
- S  (bit 2) Sequence Number flag: when 1, the 2-octet Sequence Number is meaningful (used for in-sequence delivery / Echo and Error-Indication correlation). G-PDUs may carry it but receivers need not deliver strictly in sequence.
- PN (bit 1) N-PDU Number flag: when 1, the 1-octet N-PDU Number is meaningful (used during inter-SGSN handover to preserve packet ordering).

ALL-OR-NOTHING BLOCK: "If and only if one or more of these three flags are set, the fields Sequence Number, N-PDU Number and Next Extension Header Type shall be present." The unset fields among them are still transmitted (as 0) but "shall not be interpreted." So the optional block is exactly 4 octets whenever it exists.

A plain G-PDU carrying bulk downlink data commonly has E=S=PN=0, making the header exactly 8 octets and the inner IP packet start at offset 8 — the case this spec models as fixed.`,
    },
    {
      name: 'messageType',
      label: 'Message Type',
      bits: 8,
      type: 'enum',
      enumMap: MSG_TYPE,
      decode: (v) => (MSG_TYPE[v] ? `${v} (${MSG_TYPE[v]})` : `${v}`),
      note: '255 = G-PDU (the common case: payload is the tunnelled user IP packet). 1/2 = Echo, 26 = Error Indication, 254 = End Marker.',
      desc: 'The 8-bit message type (octet 2). For user-plane data it is 255 (G-PDU), whose payload is the subscriber’s own IP packet. The path-management and signalling types are 1 Echo Request, 2 Echo Response, 26 Error Indication, 31 Supported Extension Headers Notification, and 254 End Marker.',
      detail: `MESSAGE TYPE (8 bits, TS 29.281 §6.1, Table 6.1-1) — the GTP-U subset:
- 1  Echo Request / 2 Echo Response: path management, sent to verify a GTP-U peer is alive (carries a Recovery IE).
- 26 Error Indication: tells the sender that no context exists for the received TEID, so it should stop sending on that tunnel.
- 31 Supported Extension Headers Notification: lists the extension-header types the peer supports.
- 254 End Marker: marks the end of the data stream on the old path during an X2/S1 handover, so the target can flush in order.
- 255 G-PDU: the workhorse — carries one original user data packet (an IP packet, or Ethernet in 5G) as its payload.

Other values in the byte are used by GTP-C (control plane) and are out of scope for GTP-U.`,
    },
    {
      name: 'length',
      label: 'Length',
      bits: 16,
      decode: (v) => `${v} bytes after the mandatory 8-byte header`,
      note: 'Length in octets of everything AFTER octet 8 — including any optional fields, extension headers, and the tunnelled payload. NOT the total packet length.',
      desc: 'A 16-bit length (octets 3-4) giving the number of octets that follow the mandatory 8-octet header. It counts the optional fields and extension headers (when present) plus the tunnelled payload. The first 8 bytes are NOT included, so total UDP payload = 8 + Length.',
      detail: `LENGTH (16 bits, TS 29.281 §5.1): "the length in octets of the payload, i.e. the rest of the packet following the mandatory part of the GTP header (that is the first 8 octets). The Sequence Number, the N-PDU Number or any Extension headers shall be considered to be part of the payload, i.e. included in the length count."

CONSEQUENCE: to find the inner packet's length you must subtract the optional-block / extension-header bytes from Length, which is why the inner-payload offset is variable. For a G-PDU with E=S=PN=0, Length equals exactly the length of the tunnelled IP packet.

BOUNDS THE PDU: total GTP-U PDU on the wire = 8 + Length octets. This spec uses Length to bound the PDU (pduBytes) so trailing bytes never leak in.

ENDIANNESS: 16-bit big-endian (network order).`,
    },
    {
      name: 'teid',
      label: 'TEID',
      bits: 32,
      type: 'hex',
      note: 'Tunnel Endpoint Identifier — names the tunnel (per-bearer / per-PDU-session) at the RECEIVING endpoint. Allocated by the receiver and signalled by GTP-C.',
      desc: 'The 32-bit Tunnel Endpoint Identifier (octets 5-8). It identifies the tunnel endpoint in the receiving GTP-U node, so the receiver knows which subscriber bearer / PDU session this packet belongs to. Each direction of each bearer has its own TEID, chosen by the receiving side and signalled over the control plane.',
      detail: `TEID (32 bits, TS 29.281 §5.1): "unambiguously identifies a tunnel endpoint in the receiving GTP-U protocol entity." The receiver allocates it; the sender learns it via GTP-C (Create Session / Modify Bearer in EPC, or N4/PFCP-driven setup in 5G) and stamps it on every uplink/downlink packet for that tunnel.

WHY A TUNNEL ID, NOT JUST THE IP 5-TUPLE: many subscribers' flows share the same S-GW/UPF IP and UDP port 2152, so the IP/UDP tuple cannot distinguish bearers. The TEID does — it is the demultiplexing key that maps a packet to a specific bearer's context (QoS, charging, the subscriber's own IP).

TEID = 0 (with message type Echo or Error Indication) is used for path management where no bearer context applies. A received G-PDU whose TEID has no context triggers an Error Indication (type 26) back to the sender.

ENDIANNESS: 32-bit big-endian; shown in hex as an opaque identifier.`,
    },
  ],
  // The mandatory header is a fixed 8 octets. We do NOT extend it for the optional
  // block / extension headers (see the top-of-file note): honestly consuming them
  // requires walking the variable extension-header chain, so the inner payload's
  // start past offset 8 is documented rather than silently trimmed.
  headerBytes: () => 8,
  // Length bounds everything after octet 8, so the whole PDU is 8 + Length octets.
  // This trims any trailing padding so it cannot leak into the payload.
  pduBytes: (h) => 8 + h.get('length'),
  // For a G-PDU (255) the payload is the tunnelled user IP packet — but because the
  // optional/extension fields make the exact inner offset variable, we stop here
  // and let the inner IP packet fall through as node.payload (see top-of-file
  // note). Echo/Error/End-Marker bodies (IEs) are likewise opaque to this layer.
  next: () => null,
};
