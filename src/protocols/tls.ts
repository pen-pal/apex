// TLS record layer. RFC 8446 (TLS 1.3), Section 5.1; the record framing is
// unchanged in shape from RFC 5246 (TLS 1.2) Section 6.2.
//
// This spec models ONLY the 5-byte TLS RECORD HEADER (ContentType,
// legacy_record_version, length). The record FRAGMENT that follows is left as
// payload on purpose:
//   - For application_data (23) the fragment is OPAQUE ciphertext (AEAD output:
//     encrypted record + auth tag). We do NOT and cannot show plaintext here —
//     decryption needs the negotiated session keys, which are out of scope.
//   - For handshake (22) the fragment begins with a 1-byte HandshakeType and a
//     24-bit length (RFC 8446 §4), but those live inside the fragment, not in
//     the record header, so they are described in notes rather than invented as
//     record fields.
import type { ProtocolSpec } from '../core/types';

// RFC 8446 §5.1 ContentType. invalid(0) must never appear on the wire in a
// real record; heartbeat(24) is from RFC 6520.
const CONTENT_TYPE: Record<number, string> = {
  0: 'invalid',
  20: 'change_cipher_spec',
  21: 'alert',
  22: 'handshake',
  23: 'application_data',
  24: 'heartbeat',
};

// legacy_record_version values. In TLS 1.3 this field is frozen at 0x0303
// (TLS 1.2) for middlebox compatibility; the real version is negotiated in the
// supported_versions extension. RFC 8446 §5.1 sets legacy_record_version to
// 0x0303, except the initial ClientHello record, which MAY use 0x0301.
const RECORD_VERSION: Record<number, string> = {
  0x0300: 'SSL 3.0',
  0x0301: 'TLS 1.0',
  0x0302: 'TLS 1.1',
  0x0303: 'TLS 1.2',
  0x0304: 'TLS 1.3',
};

export const tls: ProtocolSpec = {
  id: 'tls',
  name: 'TLS Record',
  layer: 7,
  summary: 'The TLS record layer: a 5-byte frame (type, legacy version, length) wrapping handshake, alert, or opaque encrypted application data over TCP 443.',
  fields: [
    {
      name: 'contentType',
      label: 'Content type',
      bits: 8,
      type: 'enum',
      enumMap: CONTENT_TYPE,
      note: '22 handshake, 23 application_data, 21 alert, 20 change_cipher_spec.',
      desc: 'Identifies what kind of message this record carries: handshake (22), application_data (23, the opaque encrypted payload), alert (21), or change_cipher_spec (20). It tells the receiver which sub-protocol parser to run on the fragment.',
      detail: `CONTENT TYPE (1 byte, RFC 8446 §5.1):
- 20 change_cipher_spec: a legacy 1-byte message (value 0x01). In TLS 1.3 it carries no meaning and exists only so middleboxes that expect the TLS 1.2 flow do not choke; it is ignored on receipt.
- 21 alert: closure ("close_notify") and error notifications (e.g. bad_certificate, handshake_failure). After keys are installed, alerts are themselves encrypted.
- 22 handshake: the negotiation messages — ClientHello, ServerHello, Certificate, Finished, etc. The fragment begins with a 1-byte HandshakeType and a 24-bit length (RFC 8446 §4).
- 23 application_data: the actual encrypted payload. The fragment is OPAQUE — it is AEAD ciphertext plus an authentication tag and cannot be read without the session keys.
- 24 heartbeat: the TLS heartbeat extension (RFC 6520), the protocol Heartbleed abused.

TLS 1.3 PRIVACY TRICK: once encryption is on, every record uses the outer content type 23 (application_data) regardless of the real inner type, which is appended as one byte inside the encrypted fragment (TLSInnerPlaintext). This hides whether a record is a handshake message, an alert, or real data from a passive observer.

invalid(0) must never appear in a genuine record; receiving it is a protocol error.`,
    },
    {
      name: 'legacyVersion',
      label: 'Legacy version',
      bits: 16,
      type: 'enum',
      enumMap: RECORD_VERSION,
      note: 'Frozen at 0x0303 (TLS 1.2) in TLS 1.3; first ClientHello often 0x0301.',
      desc: 'A legacy protocol-version field kept for backward compatibility. In TLS 1.3 it is effectively a constant (0x0303 = "TLS 1.2"); the real negotiated version travels in the supported_versions extension, not here.',
      detail: `LEGACY_RECORD_VERSION (2 bytes, big-endian, RFC 8446 §5.1):
- 0x0300 SSL 3.0 | 0x0301 TLS 1.0 | 0x0302 TLS 1.1 | 0x0303 TLS 1.2 | 0x0304 TLS 1.3

WHY "LEGACY": in TLS 1.3 this field is deliberately frozen. RFC 8446 requires:
- legacy_record_version MUST be 0x0303 (TLS 1.2), except the initial ClientHello record, which MAY use 0x0301 (TLS 1.0) for the widest interoperability — many middleboxes drop records advertising newer versions.
- All subsequent records MUST set it to 0x0303 (TLS 1.2).
- The ACTUAL version is negotiated by the supported_versions extension (value 0x0304 for TLS 1.3) carried inside the ClientHello/ServerHello, NOT by this field.

This split exists because the version byte in the clear was repeatedly mishandled by deployed middleboxes ("version intolerance"), so TLS 1.3 hides real version negotiation in an extension and fixes this visible field to a familiar value (0x0303, or 0x0301 on the initial ClientHello).

The value here is purely advisory and is NOT used to select the cipher or key schedule.`,
    },
    {
      name: 'length',
      label: 'Length',
      bits: 16,
      note: 'Length of the fragment that follows, in bytes. MUST NOT exceed 2^14.',
      desc: 'The number of bytes in the record fragment that immediately follows this 5-byte header. It bounds the record so the receiver knows exactly where this record ends and the next one begins on the TCP byte stream.',
      detail: `LENGTH (2 bytes, big-endian, RFC 8446 §5.1):
- Counts only the fragment, NOT the 5-byte header. A record on the wire is therefore 5 + length bytes.
- MUST NOT exceed 2^14 = 16384 bytes for a TLSPlaintext fragment. A TLSCiphertext fragment (encrypted record) MUST NOT exceed 2^14 + 256, the extra room being for the AEAD tag and the one-byte inner content type. A receiver that sees a larger length MUST send a record_overflow alert.
- A length of 0 is forbidden for handshake and alert fragments (RFC 8446 §5.1), but a zero-length application_data fragment MAY be sent (e.g. as a traffic-analysis countermeasure).

RECORD BOUNDARIES vs TCP: TLS rides on TCP, which is a pure byte stream with no message boundaries. This length field is what lets the receiver re-frame the stream into records. A single TLS record can span multiple TCP segments, and multiple small TLS records can share one TCP segment — the length field, not the segment boundary, defines a record.

WHY 16 KB: capping the plaintext fragment bounds the memory and latency cost of buffering a whole record before its AEAD tag can be verified (you cannot release any plaintext until the tag checks out). Larger payloads are simply split across multiple records.`,
    },
  ],
  // The record header is a fixed 5 bytes (RFC 8446 §5.1).
  headerBytes: () => 5,
  // The whole record is the 5-byte header plus the declared fragment length, so
  // trailing bytes (the next record on the same TCP segment) don't leak in.
  pduBytes: (h) => 5 + h.get('length'),
  // The fragment is a TLS sub-protocol, not another registered packet protocol:
  // handshake/alert bodies are TLS-internal and application_data is opaque
  // ciphertext. We deliberately stop here and leave the fragment as payload.
  next: () => null,
};
