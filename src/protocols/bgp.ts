// BGP-4 message header. RFC 4271 (A Border Gateway Protocol 4), section 4.1
// "Message Header Format". The ROUTE-REFRESH message type (5) is defined by the
// separate extension RFC 2918. BGP runs over TCP, by convention on port 179.
//
// THE 19-OCTET FIXED HEADER (RFC 4271 §4.1)
// -----------------------------------------
// Every BGP message — OPEN, UPDATE, NOTIFICATION, KEEPALIVE, ROUTE-REFRESH —
// begins with the same fixed 19-octet header:
//
//   0                   1                   2                   3
//   0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
//  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//  |                                                               |
//  +                                                               +
//  |                                                               |
//  +                                                               +
//  |                           Marker                              |
//  +                                                               +
//  |                                                               |
//  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//  |          Length               |      Type     |
//  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//
//   Marker:  16 octets, "MUST be set to all ones" (RFC 4271 §4.1).
//   Length:  2 octets, total message length incl. header, 19..4096.
//   Type:    1 octet, message type code.
//
// WHY ONLY THE HEADER
// -------------------
// This spec models the fixed 19-octet header only. The type-specific body that
// follows (the OPEN parameters, the UPDATE withdrawn-routes / path-attributes /
// NLRI, the NOTIFICATION error code, the ROUTE-REFRESH AFI/SAFI) is a different
// variable structure per type, so it cannot be transcribed honestly as one fixed
// Field grid. It falls through as node.payload (next => null), bounded by the
// Length field so trailing TCP-stream bytes from the next message cannot leak in.
// A KEEPALIVE has length exactly 19 and so has NO body — header only.
import type { ProtocolSpec, ParsedHeader } from '../core/types';

// RFC 4271 §4.1 message type codes, plus ROUTE-REFRESH (5) from RFC 2918.
const TYPE: Record<number, string> = {
  1: 'OPEN',
  2: 'UPDATE',
  3: 'NOTIFICATION',
  4: 'KEEPALIVE',
  5: 'ROUTE-REFRESH',
};

export const bgp: ProtocolSpec = {
  id: 'bgp',
  name: 'BGP-4',
  layer: 7,
  summary:
    'The inter-domain routing protocol of the Internet, over TCP/179 (RFC 4271). Every message starts with the same fixed 19-octet header: a 16-octet all-ones Marker, a 2-octet total Length, and a 1-octet Type (OPEN, UPDATE, NOTIFICATION, KEEPALIVE, ROUTE-REFRESH). The type-specific body follows as payload.',
  fields: [
    {
      name: 'marker',
      label: 'Marker',
      bits: 128,
      type: 'bytes',
      note: '16 octets, all 0xFF in BGP-4.',
      desc: 'A 16-octet field that RFC 4271 says MUST be set to all ones (sixteen 0xFF bytes). It is included for compatibility and lets a receiver resynchronise to a message boundary in the TCP byte stream.',
      detail: `MARKER (16 octets, RFC 4271 §4.1): "This 16-octet field is included for compatibility; it MUST be set to all ones."

WHY ALL ONES TODAY: in the original BGP (pre RFC 4271) the Marker could carry authentication information negotiated in the OPEN. RFC 4271 removed that mechanism (TCP MD5 / TCP-AO now protect the session instead), so for BGP-4 the Marker is simply 16 bytes of 0xFF on every message.

RESYNCHRONISATION: because BGP rides a continuous TCP byte stream with no record delimiter, the constant, recognisable Marker plus the Length field let an implementation find and validate message boundaries. RFC 4271 §6.1 makes a Marker that is not all ones a header error (Connection Not Synchronized).

WIDTH: 128 bits (16 bytes) exceeds the engine's 48-bit numeric limit, so per the Apex contract this field is modeled as 'bytes' (16 raw octets) — which is also the only honest representation of an opaque marker.`,
    },
    {
      name: 'length',
      label: 'Length',
      bits: 16,
      decode: (v) => `${v} bytes total (19-byte header + ${v - 19} bytes body)`,
      note: 'Total message length incl. header; 19..4096.',
      desc: 'A 2-octet unsigned integer giving the total length of the message in octets, INCLUDING the 19-byte header. RFC 4271 requires it be at least 19 (a header-only KEEPALIVE) and no greater than 4096.',
      detail: `LENGTH (2 octets, big-endian, RFC 4271 §4.1): "This 2-octet unsigned integer indicates the total length of the message, including the header in octets. ... The value of the Length field MUST always be at least 19 and no greater than 4096."

BOUNDS THE PDU: subtract 19 to get the body length. The dissector uses this value to stop the payload exactly at Length, so the start of the NEXT BGP message in the same TCP stream cannot leak into this one's body.
- KEEPALIVE: Length == 19 -> no body at all (header only).
- OPEN / UPDATE / NOTIFICATION / ROUTE-REFRESH: Length > 19 -> a type-specific body follows.

MAXIMUM: RFC 4271 capped a BGP message at 4096 octets. RFC 8654 later introduced negotiable "BGP Extended Messages" raising the cap to 65535 for UPDATE and ROUTE-REFRESH between speakers that advertise that capability; baseline BGP-4 remains 4096.

ENDIANNESS: 16-bit big-endian (network order), like the rest of BGP.`,
    },
    {
      name: 'type',
      label: 'Type',
      bits: 8,
      type: 'enum',
      enumMap: TYPE,
      note: '1 OPEN, 2 UPDATE, 3 NOTIFICATION, 4 KEEPALIVE, 5 ROUTE-REFRESH.',
      desc: 'A 1-octet code identifying the message type, which determines the structure of the body that follows the header: 1 OPEN, 2 UPDATE, 3 NOTIFICATION, 4 KEEPALIVE (RFC 4271), and 5 ROUTE-REFRESH (RFC 2918).',
      detail: `TYPE (1 octet, RFC 4271 §4.1): "This 1-octet unsigned integer indicates the type code of the message." Defined codes:
- 1 OPEN — first message after the TCP connection comes up: announces version, My Autonomous System, Hold Time, BGP Identifier, and Optional Parameters (capabilities). Establishes the peering session.
- 2 UPDATE — the workhorse: advertises new feasible routes (path attributes + NLRI) and withdraws routes that are no longer feasible. This is how routing information actually propagates.
- 3 NOTIFICATION — sent when an error is detected; the BGP connection is closed immediately afterward. Carries an Error Code, Error Subcode, and data.
- 4 KEEPALIVE — a header-only (19-byte) heartbeat exchanged to keep the Hold Timer from expiring; sent at most every Hold Time/3 seconds.
- 5 ROUTE-REFRESH (RFC 2918) — asks a peer to re-advertise its Adj-RIB-Out for a given AFI/SAFI, so a policy change can be applied without resetting the session.

The receiver dispatches on this byte to choose the body parser; RFC 4271 §6.1 makes an unknown Type a header error (Bad Message Type).`,
    },
  ],
  // The header is a fixed 19 octets (16 marker + 2 length + 1 type).
  headerBytes: (): number => 19,
  // The Length field bounds the whole PDU; the type-specific body is the payload
  // (empty for a KEEPALIVE, where Length == 19).
  pduBytes: (h: ParsedHeader): number => h.get('length'),
  // The body is type-specific and variable (OPEN params, UPDATE NLRI, …); there
  // is no generic child protocol to dissect, so dissection stops at the header.
  next: (_h: ParsedHeader): string | null => null,
};
