// Kerberos V5 — network authentication protocol.
// RFC 4120 (The Kerberos Network Authentication Service (V5)).
//   - Section 5.10 defines the ASN.1 APPLICATION tag numbers for each message.
//   - Sections 5.4.1/5.4.2 (AS/TGS exchange), 5.5.1/5.5.2 (AP exchange),
//     5.9.1 (KRB-ERROR) define the message bodies.
//   - Section 7.2 defines the transport: Kerberos uses UDP/TCP port 88. Over TCP,
//     each message is preceded by a 4-byte length prefix in network byte order
//     (§7.2.2); over UDP the datagram IS the message with no prefix.
//
// WHY THIS SPEC MODELS ONLY THE OUTER APPLICATION TAG + LENGTH
// -----------------------------------------------------------
// Kerberos messages are encoded in ASN.1 DER (Distinguished Encoding Rules) — a
// recursive Type-Length-Value (TLV) stream, NOT a flat grid of fixed-width
// bit-fields. Every Kerberos PDU begins with a single high-class APPLICATION tag
// that identifies the message type, followed by a DER length, then a SEQUENCE
// body of context-tagged fields ([0] pvno, [1] msg-type, [2] padata, [3]
// req-body, …). For example an AS-REQ is:
//
//   6a 81 b0                       [APPLICATION 10] AS-REQ, DER length (long form)
//     30 81 ad                     SEQUENCE  (the KDC-REQ body)
//       a1 03 02 01 05             [1] pvno      INTEGER 5
//       a2 03 02 01 0a             [2] msg-type  INTEGER 10  (= AS-REQ)
//       a3 ...                     [3] padata    SEQUENCE OF PA-DATA
//       a4 ...                     [4] req-body  KDC-REQ-BODY { cname, realm, … }
//
// The position of every inner field depends on the DER lengths that precede it,
// so none of them lives at a fixed bit offset and they cannot be transcribed
// honestly as fixed-width `Field`s. What IS positionally fixed is the very first
// thing on the wire: the message's APPLICATION tag byte and its DER length. We
// model exactly those two bytes and let the DER body fall through as the payload,
// where the byte view shows the real TLV framing (0x30 = the body SEQUENCE,
// 0xa1 = the [1] context tag, etc.) against the true bytes rather than invented
// offsets.
//
// APPLICATION TAG ENCODING (RFC 4120 §5.10, ASN.1 X.690 §8.1.2)
// ------------------------------------------------------------
// A tag byte is [class(2) | P/C(1) | number(5)]. Kerberos message types are
// [APPLICATION n] and are constructed, so the byte is:
//   class       01  = application
//   P/C          1  = constructed
//   number   n (5 bits, since every Kerberos n <= 30 fits in 5 bits)
// giving byte value 0x40 | 0x20 | n = 0x60 + n. Hence AS-REQ [APPLICATION 10] =
// 0x6a, KRB-ERROR [APPLICATION 30] = 0x7e, and so on.
//
// CAVEATS (documented honestly)
// -----------------------------
//   - headerBytes() => 2 models the tag byte plus a SHORT-FORM DER length (one
//     octet, 0x00-0x7F, contents < 128 bytes). Real AS/TGS requests are usually
//     larger and use LONG-FORM length (first byte 0x81-0x84 then 1-4 length
//     octets), which would make the prefix 3-6 bytes and shift these offsets. We
//     do not parse long form here; the `derLen` field's decode() flags it
//     explicitly so the byte view never lies about a long-form message.
//   - Over TCP a 4-byte length prefix precedes this tag (§7.2.2). That framing is
//     a transport concern handled before this layer; this spec models the message
//     itself, starting at the APPLICATION tag, exactly as it appears over UDP.
//   - The DER body (pvno, msg-type, padata, req-body / KRB-ERROR fields) is a
//     recursive TLV structure with no fixed grid, so we stop here (next => null)
//     and leave it as node.payload.
import type { ProtocolSpec } from '../core/types';

// RFC 4120 §5.10 Application Tag Numbers, encoded as the on-the-wire constructed
// APPLICATION tag byte (0x60 + n). These are the messages that actually appear as
// the outermost PDU on port 88. (Ticket [APPLICATION 1] / Authenticator
// [APPLICATION 2] / EncTicketPart etc. are never sent bare — they are nested
// inside these — so they are not dispatch targets here, but the common ones are
// listed for recognition in a byte view.)
const APP_TAG: Record<number, string> = {
  0x6a: 'AS-REQ [APPLICATION 10]',
  0x6b: 'AS-REP [APPLICATION 11]',
  0x6c: 'TGS-REQ [APPLICATION 12]',
  0x6d: 'TGS-REP [APPLICATION 13]',
  0x6e: 'AP-REQ [APPLICATION 14]',
  0x6f: 'AP-REP [APPLICATION 15]',
  0x74: 'KRB-SAFE [APPLICATION 20]',
  0x75: 'KRB-PRIV [APPLICATION 21]',
  0x76: 'KRB-CRED [APPLICATION 22]',
  0x7e: 'KRB-ERROR [APPLICATION 30]',
};

export const kerberos: ProtocolSpec = {
  id: 'kerberos',
  name: 'Kerberos',
  layer: 7,
  summary:
    'The Kerberos V5 authentication protocol (UDP/TCP port 88). Messages are ASN.1 DER — a recursive Type-Length-Value stream. Each PDU opens with a single APPLICATION tag byte naming the message (AS-REQ, TGS-REP, AP-REQ, KRB-ERROR, …) and a DER length, then a SEQUENCE body of context-tagged fields. Apex models that fixed 2-byte tag+length prefix; the DER body follows as the payload.',
  fields: [
    {
      name: 'appTag',
      label: 'Application tag',
      bits: 8,
      type: 'enum',
      enumMap: APP_TAG,
      note: 'The ASN.1 [APPLICATION n] tag byte (0x60 + n) that names the Kerberos message: 0x6a AS-REQ, 0x6b AS-REP, 0x7e KRB-ERROR, etc.',
      desc: 'The first byte of every Kerberos message: a constructed ASN.1 APPLICATION tag that identifies the message type. AS-REQ is 0x6a, AS-REP 0x6b, TGS-REQ 0x6c, TGS-REP 0x6d, AP-REQ 0x6e, AP-REP 0x6f, and a KRB-ERROR is 0x7e. The receiver reads this single byte to know which message body parser to run.',
      detail: `APPLICATION TAG BYTE (RFC 4120 §5.10; ASN.1 X.690 §8.1.2):

A DER tag byte is bit-packed: [class(2) | P/C(1) | number(5)].
A Kerberos message tag is [APPLICATION n], constructed, with n <= 30, so:
  class       01  = application
  P/C          1  = constructed (it CONTAINS the body SEQUENCE)
  number   n (5 bits)
=> byte = 0x40 | 0x20 | n = 0x60 + n.

The defined outermost messages (RFC 4120 §5.10):
  0x6a AS-REQ    [APPLICATION 10]  client -> KDC, "authenticate me / give me a TGT"
  0x6b AS-REP    [APPLICATION 11]  KDC -> client, the TGT + session key (PA-encrypted)
  0x6c TGS-REQ   [APPLICATION 12]  client -> KDC, "give me a service ticket" (uses the TGT)
  0x6d TGS-REP   [APPLICATION 13]  KDC -> client, the requested service ticket
  0x6e AP-REQ    [APPLICATION 14]  client -> service, presents the ticket + authenticator
  0x6f AP-REP    [APPLICATION 15]  service -> client, mutual-auth reply
  0x74 KRB-SAFE  [APPLICATION 20]  integrity-protected application message
  0x75 KRB-PRIV  [APPLICATION 21]  encrypted application message
  0x76 KRB-CRED  [APPLICATION 22]  forwarded credentials
  0x7e KRB-ERROR [APPLICATION 30]  any error reply (e.g. PREAUTH_REQUIRED, principal unknown)

A KRB-ERROR (0x7e) commonly appears as the FIRST response in a real exchange:
Windows/MIT KDCs reply KDC_ERR_PREAUTH_REQUIRED to a bare AS-REQ, prompting the
client to resend with pre-authentication (an encrypted timestamp). Ticket
[APPLICATION 1] and Authenticator [APPLICATION 2] are never sent bare — they are
nested inside the messages above — so they are not outermost dispatch tags.`,
    },
    {
      name: 'derLen',
      label: 'DER length',
      bits: 8,
      decode: (v) =>
        v < 0x80
          ? `${v} bytes (short form)`
          : `long form — ${v & 0x7f} following length octet(s); not modeled here`,
      note: 'BER/DER length of the message body. This spec models short form (< 128-byte body); long form (first byte 0x81-0x84) is flagged, not parsed.',
      desc: 'The ASN.1 DER length of everything inside the APPLICATION tag (the body SEQUENCE and all its fields). Shown here as a single short-form octet (0x00-0x7F = up to 127 bytes). Real AS/TGS messages are usually larger and use the long form, which this field flags rather than mis-parses.',
      detail: `DER LENGTH ENCODING (ASN.1 X.690 §8.1.3):

SHORT FORM (one byte, 0x00-0x7F):
  the byte IS the length, 0-127. Used when the body is < 128 bytes.

LONG FORM (first byte 0x81-0x84, then N length octets, big-endian):
  the low 7 bits of the first byte give the NUMBER of following length octets.
  0x81 0xb0       = 176 bytes
  0x82 0x01 0x2c  = 300 bytes
DER additionally requires the MINIMUM number of length octets (no leading zero
padding), so the encoding for a given length is unique.

This field models only the SHORT FORM. A typical AS-REQ carries the client name,
realm, requested ticket flags, a nonce, the encryption types, and (after the
KDC asks) pre-auth data, so it routinely exceeds 127 bytes and uses long form —
e.g. "6a 81 b0" or "6a 82 ...". In that case the real prefix is 3-6 bytes and the
offsets here would shift; the decode() above flags the long-form first byte so
the byte view stays honest instead of silently misreading the length. We do not
walk long-form lengths because the body beyond is a recursive DER structure with
no fixed grid (see the file header), and is left as the payload either way.`,
    },
  ],
  // Tag byte (1) + short-form DER length (1) = 2 fixed bytes. See the file header:
  // long-form lengths and the recursive DER body are intentionally not parsed.
  headerBytes: () => 2,
  // The DER body (pvno, msg-type, padata, req-body / KRB-ERROR fields) is a
  // recursive TLV structure, not a fixed grid, so we stop here and let it fall
  // through as node.payload — the byte view shows the real DER tag/length bytes.
  next: () => null,
};
