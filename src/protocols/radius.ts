// RADIUS — Remote Authentication Dial In User Service. RFC 2865 (June 2000),
// "RADIUS", section 3 "Packet Format" and section 5 "Attributes". RADIUS is the
// classic AAA (Authentication, Authorization, Accounting) protocol; it runs over
// UDP, by convention on port 1812 for authentication (Access-Request/-Accept/
// -Reject/-Challenge) and 1813 for accounting (RFC 2866). Older deployments used
// 1645/1646. This spec models the fixed 20-byte RADIUS header.
//
// THE 20-BYTE HEADER (RFC 2865 §3)
// --------------------------------
//   Code (1 octet) | Identifier (1 octet) | Length (2 octets) | Authenticator (16 octets)
// All multi-byte integers are big-endian (network order). The Length field bounds
// the whole PDU (20..4096 octets), so we set pduBytes from it.
//
// WHAT FOLLOWS THE HEADER — ATTRIBUTE-VALUE PAIRS (RFC 2865 §5)
// ------------------------------------------------------------
// After the header come zero or more Attributes, each a TLV:
//   Type (1 octet) | Length (1 octet, includes Type+Length, min 3) | Value (Length-2 octets)
// e.g. User-Name (Type 1), User-Password (Type 2, hidden by MD5 with the shared
// secret + Request Authenticator), NAS-IP-Address (Type 4), NAS-Port (Type 5).
// The AVP list is variable and not a fixed bit grid, so it cannot be transcribed
// honestly as Field entries — it falls through as node.payload (next() returns
// null). The byte view still shows the real AVP bytes.
//
// THE AUTHENTICATOR (RFC 2865 §3)
// -------------------------------
// 16 octets. In an Access-Request it is the Request Authenticator: a globally and
// temporally unique random value. In a reply it is the Response Authenticator:
// MD5(Code || ID || Length || RequestAuth || Attributes || Secret). It both
// authenticates the reply and is the basis for hiding the User-Password attribute.
import type { ProtocolSpec } from '../core/types';

// RFC 2865 §3 / §4: RADIUS packet Codes (the subset defined in RFC 2865; codes
// 12/13 are reserved and 4/5 are the RFC 2866 accounting codes, listed for context).
const CODE: Record<number, string> = {
  1: 'Access-Request',
  2: 'Access-Accept',
  3: 'Access-Reject',
  4: 'Accounting-Request',
  5: 'Accounting-Response',
  11: 'Access-Challenge',
};

export const radius: ProtocolSpec = {
  id: 'radius',
  name: 'RADIUS',
  layer: 7,
  summary:
    'The classic AAA protocol over UDP/1812. A tiny 20-byte header — Code, Identifier, Length, and a 16-byte Authenticator — followed by a list of Type/Length/Value Attribute-Value Pairs (AVPs) that carry the username, password, NAS info, and reply attributes.',
  fields: [
    {
      name: 'code',
      label: 'Code',
      bits: 8,
      type: 'enum',
      enumMap: CODE,
      desc: 'One octet identifying the packet type. An Access-Request (1) asks the RADIUS server to authenticate a user; the server replies Access-Accept (2), Access-Reject (3), or Access-Challenge (11). Accounting uses Accounting-Request (4) / Accounting-Response (5).',
      detail: `CODE (8 bits, RFC 2865 §3): "identifies the type of RADIUS packet. When a packet is received with an invalid Code field, it is silently discarded."

CODES DEFINED:
  1  Access-Request    (client/NAS -> server: please authenticate this user)
  2  Access-Accept     (server -> client: user authenticated, here are reply attributes)
  3  Access-Reject     (server -> client: access denied)
  4  Accounting-Request   (RFC 2866, port 1813)
  5  Accounting-Response  (RFC 2866, port 1813)
 11  Access-Challenge   (server -> client: send more info, e.g. a one-time token)
 12  Status-Server (experimental), 13 Status-Client (experimental), 255 Reserved.

THE FLOW: a NAS (Network Access Server — a VPN concentrator, Wi-Fi controller, or
dial-up box) turns a user's login into an Access-Request; the server answers
Accept/Reject/Challenge. EAP authentication (802.1X) is carried inside via the
EAP-Message attribute, with possibly several Access-Challenge round trips.`,
    },
    {
      name: 'identifier',
      label: 'Identifier',
      bits: 8,
      desc: 'One octet that matches a reply to its request. The client picks it for each Access-Request; the server copies it into the response. It also lets the client detect duplicate (retransmitted) requests.',
      detail: `IDENTIFIER (8 bits, RFC 2865 §3): "aids in matching requests and replies. The RADIUS server can detect a duplicate request if it has the same client source IP address and source UDP port and Identifier within a short span of time."

Because it is only 8 bits, a single client/UDP-port pair can have at most 256
requests in flight; busy NASes use multiple source ports to get more. The reply's
Identifier MUST equal the request's, or the client discards it.`,
    },
    {
      name: 'length',
      label: 'Length',
      bits: 16,
      note: 'Total packet length in octets, 20..4096. Bounds the whole PDU.',
      decode: (v) => `${v} bytes (20-byte header + ${v - 20} bytes of attributes)`,
      desc: 'Two octets giving the total length of the RADIUS packet — header plus all attributes — in octets. The minimum is 20 (header only); the maximum is 4096. Octets beyond Length are treated as padding and ignored; a packet shorter than Length is silently discarded.',
      detail: `LENGTH (16 bits, RFC 2865 §3): "indicates the length of the packet including the Code, Identifier, Length, Authenticator and Attribute fields. Octets outside the range of the Length field MUST be treated as padding and ignored on reception. If the packet is shorter than the Length field indicates, it MUST be silently discarded. The minimum length is 20 and maximum length is 4096."

BOUNDS THE PAYLOAD: subtract 20 to get the total bytes of Attribute-Value Pairs.
The dissector uses this to stop the AVP payload exactly at Length so trailing
UDP/Ethernet padding cannot leak in.`,
    },
    {
      name: 'authenticator',
      label: 'Authenticator',
      bits: 128,
      type: 'bytes',
      note: 'Request: a 16-byte random value. Reply: MD5(Code+ID+Length+RequestAuth+Attributes+Secret).',
      desc: 'A 16-octet field. In an Access-Request it is the Request Authenticator: an unpredictable, unique random value. In a reply it is the Response Authenticator, an MD5 hash binding the reply to the request and the shared secret. It is also used to hide (encrypt) the User-Password attribute.',
      detail: `AUTHENTICATOR (128 bits = 16 octets, RFC 2865 §3):

REQUEST AUTHENTICATOR (in Access-Request): "a 16 octet random number ... The value
SHOULD be unpredictable and unique over the lifetime of a secret." It seeds the
hiding of the User-Password attribute (§5.2: the password is XORed with a stream
of MD5(secret || RequestAuthenticator) blocks).

RESPONSE AUTHENTICATOR (in Access-Accept/-Reject/-Challenge):
  MD5(Code || Identifier || Length || RequestAuthenticator || Attributes || Secret)
where Secret is the shared secret known to NAS and server (never sent on the wire).
The NAS recomputes it to verify the reply really came from the server and was not
tampered with.

Note RADIUS's weakness: only the password attribute is hidden, and the integrity
protection is MD5-based — modern deployments tunnel RADIUS inside TLS/DTLS
(RadSec, RFC 6614 / RFC 7360) or IPsec.`,
    },
  ],
  // Fixed 20-byte header. The Length field bounds the whole PDU (20..4096).
  headerBytes: () => 20,
  pduBytes: (h) => h.get('length'),
  // The Attribute-Value Pairs that follow are a variable TLV list, not a fixed
  // bit grid and not a separable child protocol — they fall through as payload.
  next: () => null,
};
