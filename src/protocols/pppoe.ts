// PPPoE — PPP over Ethernet. RFC 2516 (A Method for Transmitting PPP Over
// Ethernet, 1999).
//
// PPPoE lets multiple hosts on a shared Ethernet (a DSL/broadband segment)
// each open a point-to-point PPP session over a single carrier — the classic
// way ISPs delivered authenticated, per-subscriber broadband over Ethernet.
//
// It runs directly inside an Ethernet frame, selected by the EtherType:
//   * 0x8863 = the DISCOVERY stage  (find a peer / Access Concentrator and
//              negotiate a SESSION_ID; carries PADI/PADO/PADR/PADS/PADT)
//   * 0x8864 = the SESSION stage    (CODE = 0x00; the payload is a PPP frame,
//              starting with a 2-byte PPP Protocol id such as 0xC021 = LCP,
//              0xC023 = PAP, 0x0021 = IPv4, then PPP data)
//
// THE 6-BYTE PPPoE HEADER (RFC 2516 §4, big-endian / network order):
//   0                   1                   2                   3
//   0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
//  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//  |  VER  | TYPE  |      CODE     |          SESSION_ID           |
//  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//  |            LENGTH             |           payload ...
//  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//
// VER and TYPE are each fixed at 1 in this version of the protocol. LENGTH
// counts ONLY the PPPoE payload (the PPP frame, or the discovery TAGs) — it
// excludes both the Ethernet header and the 6-byte PPPoE header, so it bounds
// the PDU exactly (pduBytes = 6 + LENGTH), keeping any Ethernet padding/FCS
// out of the payload.
//
// We model the fixed 6-byte header truthfully. What follows is variable: in the
// session stage it is a PPP frame (a 2-byte protocol id + data); in the
// discovery stage it is a series of TLV TAGs (TAG_TYPE:16, TAG_LENGTH:16,
// VALUE). Both are themselves variable, line/TLV-structured payloads, so we
// stop here (next => null) and let the bytes fall through as node.payload.
import type { ProtocolSpec } from '../core/types';

// RFC 2516 §5 (CODE field values). 0x00 is session data; the rest are the
// five PPPoE Active Discovery messages (PADI/PADO/PADR/PADS/PADT).
const CODE: Record<number, string> = {
  0x00: 'Session Data',
  0x09: 'PADI (Active Discovery Initiation)',
  0x07: 'PADO (Active Discovery Offer)',
  0x19: 'PADR (Active Discovery Request)',
  0x65: 'PADS (Active Discovery Session-confirmation)',
  0xa7: 'PADT (Active Discovery Terminate)',
};

export const pppoe: ProtocolSpec = {
  id: 'pppoe',
  name: 'PPPoE',
  layer: 2,
  summary:
    'PPP over Ethernet (RFC 2516): a 6-byte shim inside an Ethernet frame that carries a per-subscriber PPP session over a shared segment. EtherType 0x8863 runs the discovery handshake (PADI/PADO/PADR/PADS) to agree a SESSION_ID; 0x8864 then carries the live PPP frame.',
  fields: [
    {
      name: 'version',
      label: 'Version',
      bits: 4,
      note: 'Must be 1 in this version of PPPoE.',
      desc: 'The 4-bit PPPoE protocol version. RFC 2516 fixes it at 0x1; any other value should be ignored by a conformant peer.',
      detail: `VER (4 bits): "VER MUST be set to 0x1 for this version of the PPPoE specification" (RFC 2516 §4).

It is the high nibble of the first byte, sharing that byte with TYPE. So the first header byte is almost always 0x11 (VER=1, TYPE=1). A receiver checks VER before parsing further; a different version means a different, incompatible framing.`,
    },
    {
      name: 'type',
      label: 'Type',
      bits: 4,
      note: 'Must be 1 in this version of PPPoE.',
      desc: 'The 4-bit PPPoE type field. RFC 2516 fixes it at 0x1. Together with Version it forms the constant first byte 0x11.',
      detail: `TYPE (4 bits): "TYPE MUST be set to 0x1 for this version of the PPPoE specification" (RFC 2516 §4).

It occupies the low nibble of the first byte. Reserving these two nibbles as constants left room for a future revision to renumber the framing without colliding with deployed equipment — but in practice every PPPoE deployment uses VER=TYPE=1, so byte 0 is 0x11.`,
    },
    {
      name: 'code',
      label: 'Code',
      bits: 8,
      type: 'enum',
      enumMap: CODE,
      note: '0x00 = session data; otherwise a discovery (PADx) message.',
      desc: 'Identifies the PPPoE packet type. 0x00 means this frame carries live PPP session data (EtherType 0x8864). Non-zero codes are the discovery-stage messages (EtherType 0x8863) that set up or tear down a session.',
      detail: `CODE (8 bits, RFC 2516 §5):
- 0x00 = Session Data — payload is a PPP frame (EtherType 0x8864)
- 0x09 = PADI  (Active Discovery Initiation) — host broadcasts "any AC out there?"
- 0x07 = PADO  (Active Discovery Offer) — each Access Concentrator replies
- 0x19 = PADR  (Active Discovery Request) — host picks one AC and requests a session
- 0x65 = PADS  (Active Discovery Session-confirmation) — AC assigns the SESSION_ID
- 0xA7 = PADT  (Active Discovery Terminate) — either side closes the session

THE DISCOVERY HANDSHAKE (the four PADx before data):
  Host  --PADI (broadcast)-->  every AC
  Host  <--PADO------------    each AC (unicast, offering itself)
  Host  --PADR------------->   chosen AC
  Host  <--PADS-------------   AC, now carrying the assigned SESSION_ID
After PADS, both ends know the SESSION_ID and switch to EtherType 0x8864 for PPP.

PADI/PADO/PADR/PADS carry TLV TAGs (e.g. Service-Name, AC-Name, Host-Uniq); PADT can be sent at any time to drop the session.`,
    },
    {
      name: 'sessionId',
      label: 'Session ID',
      bits: 16,
      type: 'hex',
      note: 'Unique per PPP session; 0x0000 during discovery, 0xffff reserved.',
      desc: 'A 16-bit value, assigned by the Access Concentrator in the PADS, that uniquely identifies one PPP session over the shared Ethernet. It stays fixed for the life of the session.',
      detail: `SESSION_ID (16 bits, RFC 2516 §4):
- It is "an unsigned value in network byte order" that, combined with the Ethernet source and destination addresses, "uniquely defines a PPPoE session."
- 0x0000 is used in the PADI and PADR (no session yet); the AC fills in the real value in the PADS.
- 0xFFFF is RESERVED for future use and must not be assigned.

The SESSION_ID is how a host or AC with many simultaneous PPP sessions on one Ethernet interface demultiplexes incoming session frames to the right PPP state machine.`,
    },
    {
      name: 'length',
      label: 'Length',
      bits: 16,
      decode: (v) => `${v} bytes of PPPoE payload (excludes Ethernet and the 6-byte PPPoE header)`,
      note: 'Length of the PPPoE payload only — not the Ethernet or PPPoE headers.',
      desc: 'The length, in bytes, of the PPPoE payload that follows this header. It does NOT include the Ethernet header or the 6-byte PPPoE header, so it bounds the PDU exactly and keeps any Ethernet padding out of the payload.',
      detail: `LENGTH (16 bits, network byte order, RFC 2516 §4): "indicates the length of the PPPoE payload. It does not include the length of the Ethernet or PPPoE headers."

WHY IT MATTERS: minimum-length Ethernet frames are padded to 60 bytes (before FCS). Without an explicit payload length, that padding would leak into the PPP frame or the TAG list. LENGTH lets the receiver stop at exactly the right byte — here the dissector sets pduBytes = 6 + LENGTH.

In the session stage the payload is a PPP frame (starting with a 2-byte PPP Protocol id, e.g. 0xC021 = LCP, 0x0021 = IPv4). In the discovery stage it is a run of TLV TAGs.`,
    },
  ],
  // Fixed 6-byte header; LENGTH bounds the payload (6-byte header + LENGTH).
  headerBytes: () => 6,
  pduBytes: (h) => 6 + h.get('length'),
  // A Session frame (code 0x00) carries a PPP frame; Discovery frames carry TLV
  // tags (variable) which we leave as payload.
  next: (h) => (h.get('code') === 0x00 ? 'ppp' : null),
};
