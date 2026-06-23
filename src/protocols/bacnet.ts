// BACnet/IP — BACnet Virtual Link Control (BVLC) header. ANSI/ASHRAE Standard
// 135, Annex J ("BACnet/IP"), clause J.2 "BACnet Virtual Link Layer". BACnet
// (Building Automation and Control Networks) is the dominant protocol for HVAC,
// lighting, access control and other building systems; BACnet/IP carries it over
// UDP, by default on port 47808 (0xBAC0).
//
// THE BVLL / BVLC HEADER (Annex J.2.2), big-endian:
//
//    0                   1                   2                   3
//    0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
//   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//   |  Type = 0x81  |   Function    |             Length            |
//   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//
// The three-octet "immutable" part is Type (always 0x81 for BACnet/IP), Function
// (the BVLL microprotocol message type), and Length. The Length is the count of
// octets in the ENTIRE BVLC message including this 4-octet header — Annex J.2.2:
// "BVLC Length ... the length, in octets, of the entire BVLL message, including
// the two octets of the length field itself" (and the Type+Function octets).
//
// WHAT FOLLOWS, AND WHY THIS SPEC STOPS AT THE HEADER
// --------------------------------------------------
// What comes after the 4-byte BVLC header depends on the Function:
//   * Original-Unicast-NPDU (0x0A) / Original-Broadcast-NPDU (0x0B): the BVLC
//     header is immediately followed by a BACnet NPDU (Network layer PDU, clause
//     6) which itself carries the APDU (Application layer PDU, clause 20).
//   * Forwarded-NPDU (0x04): a 6-octet B/IP address (4-byte IPv4 + 2-byte UDP
//     port) of the originating device precedes the NPDU.
//   * The BBMD/foreign-device management functions (0x00-0x09) carry
//     function-specific payloads (BDT/FDT entries, a result code, a TTL, …).
// The NPDU is itself a variable, bit-packed structure (a control octet whose bits
// gate the presence of source/destination network address fields and a hop
// count), and the APDU beyond it is a tag-length-value ASN.1-style encoding —
// neither is a fixed bit grid, so transcribing them as Field entries would lie
// about the wire. We therefore model only the fixed 4-octet BVLC header honestly
// and let the NPDU+APDU (or the function-specific body) fall through as
// node.payload. `next` returns null for that reason (there is no separate
// registered 'npdu' protocol to dispatch to); `pduBytes` uses Length to bound the
// payload so trailing bytes cannot leak in.
import type { ProtocolSpec, ParsedHeader } from '../core/types';

// Annex J.2.2 — BVLC Function codes (the BVLL microprotocol message types).
const FUNCTION: Record<number, string> = {
  0x00: 'BVLC-Result',
  0x01: 'Write-Broadcast-Distribution-Table',
  0x02: 'Read-Broadcast-Distribution-Table',
  0x03: 'Read-Broadcast-Distribution-Table-Ack',
  0x04: 'Forwarded-NPDU',
  0x05: 'Register-Foreign-Device',
  0x06: 'Read-Foreign-Device-Table',
  0x07: 'Read-Foreign-Device-Table-Ack',
  0x08: 'Delete-Foreign-Device-Table-Entry',
  0x09: 'Distribute-Broadcast-To-Network',
  0x0a: 'Original-Unicast-NPDU',
  0x0b: 'Original-Broadcast-NPDU',
  0x0c: 'Secure-BVLL',
};

export const bacnet: ProtocolSpec = {
  id: 'bacnet',
  name: 'BACnet/IP',
  layer: 7,
  summary:
    'The BACnet Virtual Link Control (BVLC) header (ANSI/ASHRAE 135, Annex J) that fronts every BACnet/IP message over UDP 47808: a fixed 0x81 type byte, a BVLL function code (Original-Unicast/Broadcast-NPDU, Forwarded-NPDU, BBMD/foreign-device management), and the total message length. The BACnet NPDU + APDU follow as opaque payload.',
  fields: [
    {
      name: 'type',
      label: 'Type',
      bits: 8,
      type: 'hex',
      decode: (v) => (v === 0x81 ? '0x81 (BACnet/IP)' : `0x${v.toString(16).padStart(2, '0')} (unknown)`),
      note: 'Always 0x81 — identifies a BACnet/IP (B/IP) message.',
      desc: 'The first octet of every BVLL message, fixed at 0x81 to mark the BACnet/IP data link. It lets a receiver confirm the datagram is BACnet/IP before parsing the rest; other values are reserved for future BVLL link types.',
      detail: `TYPE (1 octet, Annex J.2.2): MUST be 0x81 for BACnet/IP. The value is the "BVLL Type" and identifies which BACnet Virtual Link Layer this message belongs to — 0x81 is registered for BACnet/IP (B/IP) over IPv4. (BACnet/IPv6, Annex U, uses a different BVLL type of 0x82.)

WHY A TYPE BYTE AT ALL: BACnet was designed to run over many data links (MS/TP, ARCNET, Ethernet 802.2, PTP, LonTalk). When carried over UDP/IP it needs a thin "virtual link layer" to recover the framing and broadcast services the native links provided; the Type byte marks that virtual link so a port shared by other UDP traffic, or a future BVLL revision, can be told apart.

ENDIANNESS: a single octet, so byte order is moot; it is simply the literal 0x81.`,
    },
    {
      name: 'function',
      label: 'Function',
      bits: 8,
      type: 'enum',
      enumMap: FUNCTION,
      note: 'The BVLL message type: 0x0A Original-Unicast-NPDU, 0x0B Original-Broadcast-NPDU, 0x04 Forwarded-NPDU, plus BBMD/foreign-device management.',
      desc: 'The 1-octet BVLC function code — the "microprotocol" message type that says what this BVLL message does and therefore what follows the header. The common data-carrying functions are Original-Unicast-NPDU (0x0A), Original-Broadcast-NPDU (0x0B) and Forwarded-NPDU (0x04); the rest (0x00-0x09) manage broadcast distribution and foreign devices.',
      detail: `FUNCTION (1 octet, Annex J.2.2). Full set:
0x00 BVLC-Result                         — a function's success/NAK code (J.2.2.1)
0x01 Write-Broadcast-Distribution-Table  — set a BBMD's BDT
0x02 Read-Broadcast-Distribution-Table   — request a BBMD's BDT
0x03 Read-Broadcast-Distribution-Table-Ack
0x04 Forwarded-NPDU                       — a BBMD relays a broadcast; a 6-byte
                                           originating B/IP address (4B IP + 2B
                                           UDP port) precedes the NPDU
0x05 Register-Foreign-Device             — a device behind NAT registers with a
                                           BBMD (carries a 2-byte TTL)
0x06 Read-Foreign-Device-Table
0x07 Read-Foreign-Device-Table-Ack
0x08 Delete-Foreign-Device-Table-Entry
0x09 Distribute-Broadcast-To-Network     — ask a BBMD to broadcast on all subnets
0x0A Original-Unicast-NPDU               — a directed message; NPDU follows
0x0B Original-Broadcast-NPDU             — a local-subnet broadcast; NPDU follows
0x0C Secure-BVLL                         — BACnet/SC-style secured wrapper

BBMDs AND BROADCASTS: BACnet relies heavily on broadcasts (Who-Is/I-Am device
discovery, Who-Has/I-Have). IP broadcasts do not cross routers, so a BACnet
Broadcast Management Device (BBMD) on each IP subnet relays them: it receives an
Original-Broadcast-NPDU locally and re-emits it to peers as a Forwarded-NPDU, and
distributes to registered foreign devices (devices on subnets with no BBMD that
Register-Foreign-Device). This BBMD/foreign-device machinery is exactly what the
0x00-0x09 functions implement.`,
    },
    {
      name: 'length',
      label: 'Length',
      bits: 16,
      decode: (v) => `${v} bytes (4-byte BVLC header + ${v - 4} bytes payload)`,
      note: 'Total length in octets of the ENTIRE BVLC message, including this 4-byte header.',
      desc: 'The total length in octets of the whole BVLL message — the 4-byte BVLC header (Type, Function, Length) plus everything after it (the NPDU/APDU or the function-specific body). The receiver uses it to find the message boundary; the dissector subtracts 4 to bound the payload.',
      detail: `LENGTH (2 octets, big-endian, Annex J.2.2): "the length, in octets, of the entire BVLL message, including the two octets of the length field itself." In practice it counts all four header octets (Type + Function + the two Length octets) plus the trailing payload, so the minimum legal value is 4 (a header with no payload, e.g. a bare BVLC-Result is longer because it carries a 2-byte result code).

BOUNDS THE PAYLOAD: subtract 4 to get the payload length. The dissector uses this (pduBytes) to stop the payload exactly at Length so trailing UDP/Ethernet padding cannot leak into the BACnet NPDU.

WHY BACNET CARRIES ITS OWN LENGTH: although UDP already delimits the datagram, BVLC keeps an explicit length because BACnet messages are also carried over non-UDP links (MS/TP, etc.) through the same virtual-link abstraction, and because a single UDP datagram is one BVLL message — the length makes the BVLL self-describing independent of the transport.

ENDIANNESS: 16-bit big-endian (network order), like the rest of BACnet/IP.`,
    },
  ],
  // The BVLC header is a fixed 4 octets (Type, Function, Length); the Length field
  // bounds the whole BVLL message.
  headerBytes: (): number => 4,
  pduBytes: (h: ParsedHeader): number => h.get('length'),
  // What follows is a BACnet NPDU + APDU (for the NPDU-carrying functions) or a
  // function-specific body — neither is a fixed bit grid nor a separately
  // registered protocol here, so dissection stops and those bytes are node.payload.
  next: (): string | null => null,
};
