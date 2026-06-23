// DTLS record layer (Datagram TLS). RFC 9147 §4 (DTLS 1.3), whose DTLSPlaintext
// record framing is identical in shape to RFC 6347 §4.1 (DTLS 1.2).
//
// DTLS is "TLS for datagrams": it provides TLS's confidentiality, integrity, and
// authentication over UDP instead of TCP. Because UDP gives no ordering, no
// reliability, and no byte-stream framing, the DTLS record header adds two fields
// that plain TLS does not carry (RFC 8446 §5.1): a 16-bit EPOCH and an explicit
// 48-bit SEQUENCE NUMBER. Together they let the receiver detect replays and place
// each independently-delivered datagram into the right cryptographic context even
// when records arrive out of order or are lost outright.
//
// This spec models ONLY the fixed 13-byte DTLSPlaintext record header
// (type, legacy_record_version, epoch, sequence_number, length). The fragment that
// follows is deliberately left as payload:
//   - For application_data (23) the fragment is OPAQUE AEAD ciphertext + auth tag.
//     We do NOT and cannot show plaintext — decryption needs the negotiated keys,
//     which are out of scope.
//   - For handshake (22) the fragment is a DTLS handshake message whose own header
//     (msg_type, length, message_seq, fragment_offset, fragment_length) lives
//     inside the fragment, not in the record header, so it is described in notes
//     rather than invented as record fields.
//
// NOTE on DTLS 1.3: RFC 9147 also defines a SHORTER unified header (DTLSCiphertext,
// §4) for protected records once an epoch > 0 is in use — a 1-byte flags octet
// followed by an optional connection id, a 1- or 2-byte truncated sequence number,
// and an optional 2-byte length. That compact header is a different, variable shape
// and is identified by its two high bits being 0b001. This spec covers the
// unencrypted DTLSPlaintext header (epoch 0: the ClientHello/handshake flight),
// which is the canonical "DTLS record" shape and the one a learner meets first.
import type { ProtocolSpec } from '../core/types';

// RFC 9147 §4 ContentType (shared with TLS, RFC 8446 §5.1).
// change_cipher_spec(20) is a legacy DTLS <1.3 message; in DTLS 1.3 it exists only
// for middlebox compatibility and is otherwise unused.
const CONTENT_TYPE: Record<number, string> = {
  20: 'change_cipher_spec',
  21: 'alert',
  22: 'handshake',
  23: 'application_data',
  25: 'ack', // RFC 9147 §7: the DTLS 1.3 ACK message content type
};

// legacy_record_version. DTLS uses the ONE'S-COMPLEMENT of the TLS version number,
// so versions count DOWN: DTLS 1.0 = 0xFEFF, DTLS 1.2 = 0xFEFD (there is no DTLS
// 1.1, matching the gap where TLS 1.2 followed TLS 1.1's counterpart). In DTLS 1.3
// this legacy field is frozen at 0xFEFD; the real version is negotiated in the
// supported_versions extension, exactly as in TLS 1.3.
const RECORD_VERSION: Record<number, string> = {
  0xfeff: 'DTLS 1.0',
  0xfefd: 'DTLS 1.2',
};

export const dtls: ProtocolSpec = {
  id: 'dtls',
  name: 'DTLS Record',
  layer: 7,
  summary: 'The DTLS record layer: TLS for datagrams. A 13-byte header (type, legacy version, epoch, 48-bit sequence number, length) wraps handshake or opaque encrypted application data over UDP.',
  fields: [
    {
      name: 'contentType',
      label: 'Content type',
      bits: 8,
      type: 'enum',
      enumMap: CONTENT_TYPE,
      note: '22 handshake, 23 application_data, 21 alert, 20 change_cipher_spec, 25 ack.',
      desc: 'Identifies what kind of message this record carries: handshake (22), application_data (23, the opaque encrypted payload), alert (21), change_cipher_spec (20), or ack (25, DTLS 1.3). It tells the receiver which sub-protocol parser to run on the fragment.',
      detail: `CONTENT TYPE (1 byte, RFC 9147 §4, shared with TLS RFC 8446 §5.1):
- 20 change_cipher_spec: a legacy 1-byte message kept only for middlebox compatibility in DTLS 1.3; carries no protocol meaning and is ignored on receipt.
- 21 alert: closure ("close_notify") and error notifications. After keys are installed the alert is itself encrypted.
- 22 handshake: the negotiation messages — ClientHello, ServerHello, Certificate, Finished, etc. Because UDP can lose or reorder datagrams, each DTLS handshake message carries its OWN extra header inside the fragment (message_seq, fragment_offset, fragment_length) so a large message can be split across several datagrams and retransmitted piecemeal.
- 23 application_data: the actual encrypted payload. The fragment is OPAQUE — AEAD ciphertext plus an authentication tag — and cannot be read without the session keys.
- 25 ack: DTLS 1.3 (RFC 9147 §7) acknowledges received handshake records so the sender can retransmit only what was actually lost, instead of whole flights.

DTLS vs TLS: TLS rides on TCP, which already gives ordering and reliability, so a TLS record needs no epoch or sequence number. DTLS rides on UDP, which gives neither, so it adds both (the two fields below). The content-type semantics are otherwise identical.

invalid(0) must never appear in a genuine record; receiving it is a protocol error.`,
    },
    {
      name: 'legacyVersion',
      label: 'Legacy version',
      bits: 16,
      type: 'enum',
      enumMap: RECORD_VERSION,
      note: "DTLS 1.0 = 0xFEFF, DTLS 1.2 = 0xFEFD. It's the one's-complement of the TLS version, so it counts DOWN.",
      desc: 'The DTLS protocol version, encoded as the one’s-complement of the matching TLS version so the numbers count downward: DTLS 1.0 = 0xFEFF, DTLS 1.2 = 0xFEFD. In DTLS 1.3 this is a frozen legacy value (0xFEFD); the real version is negotiated in the supported_versions extension.',
      detail: `LEGACY_RECORD_VERSION (2 bytes, big-endian, RFC 9147 §4):
- 0xFEFF = DTLS 1.0 (the one's-complement encoding of TLS 1.1's number)
- 0xFEFD = DTLS 1.2

WHY THE WEIRD ENCODING: DTLS version numbers are defined as 1's-complement of the corresponding TLS version. This deliberately places DTLS values (0xFExx) far above any real TLS value (0x03xx) in numeric space so the two can never be confused, and it makes DTLS versions count DOWN as the protocol advances. There is no "DTLS 1.1", mirroring the fact that DTLS 1.0 paired with TLS 1.1 and DTLS 1.2 paired with TLS 1.2.

WHY "LEGACY" IN DTLS 1.3: just like TLS 1.3, DTLS 1.3 freezes this visible field (at 0xFEFD = DTLS 1.2) for middlebox compatibility and negotiates the actual version via the supported_versions extension inside the ClientHello/ServerHello. The value here is advisory and is NOT used to select the cipher or key schedule.

INITIAL CLIENTHELLO: the first ClientHello record MAY advertise 0xFEFF (DTLS 1.0) or 0xFEFD for the widest interoperability, exactly analogous to the TLS 1.0/1.2 dance in plain TLS.`,
    },
    {
      name: 'epoch',
      label: 'Epoch',
      bits: 16,
      note: 'Which cipher state produced this record. 0 = unencrypted (initial handshake); it increments on each key change.',
      desc: 'A 16-bit counter naming WHICH set of cryptographic keys was used to protect this record. It starts at 0 (the unencrypted initial handshake) and increments by one every time the protocol changes keys, so the receiver can pick the right decryption context even though UDP may interleave records from different epochs.',
      detail: `EPOCH (2 bytes, big-endian, RFC 9147 §4.2.2 / RFC 6347 §4.1) — a DTLS-only field, absent from TLS:
- Epoch 0: records sent before encryption is established (the plaintext ClientHello / ServerHello flight). This is the epoch shown in this example header.
- Epoch 1: the first protected epoch, installed after the handshake keys are derived.
- Each subsequent key change (e.g. a KeyUpdate in DTLS 1.3, or change_cipher_spec in DTLS 1.2) increments the epoch.

WHY IT EXISTS: TCP guarantees that a TLS record is delivered in order, so TLS knows that once it switches keys, every later record uses the new keys. UDP gives no such guarantee — a record encrypted under the OLD keys can arrive AFTER the key change. The epoch labels each record with the keying material that protected it, so the receiver never tries to decrypt an old-epoch record with new-epoch keys (which would fail the AEAD tag and be wrongly treated as an attack).

The sequence number below is namespaced PER EPOCH: it resets to 0 each time the epoch increments. The pair (epoch, sequence_number) is therefore the unique, replay-checkable identity of a record.`,
    },
    {
      name: 'sequenceNumber',
      label: 'Sequence number',
      bits: 48,
      // A 48-bit field is read as an exact integer (decimal display); the decode
      // also shows the 6 big-endian octets that actually sit on the wire.
      decode: (v) => {
        const octets = [40, 32, 24, 16, 8, 0].map((s) => (Math.floor(v / 2 ** s) % 256).toString(16).padStart(2, '0'));
        return `${octets.join(' ')} (record #${v} in this epoch)`;
      },
      note: '48-bit (6-octet) per-epoch counter. Explicit on the wire (unlike TLS) so out-of-order UDP datagrams can be replay-checked.',
      desc: 'A 48-bit counter, carried explicitly in every record, that numbers records WITHIN the current epoch. Plain TLS keeps its sequence number implicit (TCP delivers in order, so both sides just count); DTLS must put it on the wire because UDP datagrams can arrive out of order, be duplicated, or be lost.',
      detail: `SEQUENCE NUMBER (6 bytes = 48 bits, big-endian, RFC 9147 §4.2.2 / RFC 6347 §4.1):
- Counts records within ONE epoch, starting at 0, and resets to 0 whenever the epoch increments.
- It is the AEAD nonce input together with the epoch, and it drives the anti-replay window.

WHY 48 BITS AND WHY EXPLICIT: in TLS the 64-bit sequence number is implicit — it is never transmitted, because TCP delivers records in order so both endpoints stay in lockstep just by counting. UDP cannot promise that, so DTLS writes the number into every record. 48 bits (about 281 trillion records per epoch) is wide enough that wrap is practically impossible before a rekey, while keeping the header smaller than a full 64-bit field.

ANTI-REPLAY (RFC 9147 §4.5.1 / RFC 6347 §4.1.2.6): the receiver keeps a sliding window of recently-seen sequence numbers. A record whose number is below the window, or already marked seen, is silently discarded as a replay. This defends against an attacker capturing and re-injecting old datagrams — a threat that does not exist on TCP-based TLS.

DTLS 1.3 ENCRYPTED SEQUENCE NUMBERS: in protected DTLSCiphertext records, RFC 9147 §4.2.3 ENCRYPTS the (truncated) sequence number to deny a passive observer the ability to correlate and track records. The 48-bit field shown here is the FULL, cleartext sequence number used in the unencrypted DTLSPlaintext header (epoch 0).

This field is wider than 48 bits' worth of meaning to store as a single integer here, so it is modelled as a 6-byte byte string; its numeric value is the big-endian concatenation of those octets.`,
    },
    {
      name: 'length',
      label: 'Length',
      bits: 16,
      note: 'Length of the fragment that follows, in bytes. Must fit within the UDP datagram and not exceed 2^14.',
      desc: 'The number of bytes in the record fragment that immediately follows this 13-byte header. Unlike TLS over TCP, a DTLS record must fit entirely within one UDP datagram — records are never split across datagrams — so this length also bounds the record within the datagram.',
      detail: `LENGTH (2 bytes, big-endian, RFC 9147 §4):
- Counts only the fragment, NOT the 13-byte header. A DTLSPlaintext record on the wire is therefore 13 + length bytes.
- MUST NOT exceed 2^14 for a plaintext fragment (a ciphertext fragment may be slightly larger to hold the AEAD tag and inner content type), and MUST fit within the enclosing UDP datagram.

RECORD BOUNDARIES vs TCP: in TLS-over-TCP the length field re-frames a pure byte stream, and one record may span several TCP segments. In DTLS-over-UDP each datagram preserves message boundaries, so a record never crosses a datagram boundary. However, MULTIPLE DTLS records MAY be packed into a single UDP datagram (RFC 9147 §4.3), and this length field is what lets the receiver walk from one record to the next within that datagram — which is exactly why this spec bounds the PDU to 13 + length, so a following record does not leak into this one's payload.

NO IP FRAGMENTATION OF RECORDS: DTLS tries to keep each record ≤ the path MTU so the UDP datagram is not IP-fragmented; large handshake messages are instead split at the DTLS HANDSHAKE layer (the message_seq / fragment_offset / fragment_length header inside the fragment), not by IP.`,
    },
  ],
  // The DTLSPlaintext record header is a fixed 13 bytes (RFC 9147 §4).
  headerBytes: () => 13,
  // The whole record is the 13-byte header plus the declared fragment length, so a
  // following record packed into the same UDP datagram does not leak into payload.
  pduBytes: (h) => 13 + h.get('length'),
  // The fragment is a DTLS sub-protocol, not another registered packet protocol:
  // handshake/alert bodies are DTLS-internal and application_data is opaque
  // ciphertext. We deliberately stop here and leave the fragment as payload.
  next: () => null,
};
