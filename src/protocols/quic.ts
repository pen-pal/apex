// QUIC long-header packet — fixed prefix only. RFC 9000 (QUIC transport),
// with header-protection details from RFC 9001 (QUIC-TLS).
//
// HONESTY NOTE: QUIC packets are mostly encrypted and use variable-length,
// length-prefixed fields. This spec models ONLY the fixed long-header prefix
// that is in cleartext and fixed-width: the first byte (RFC 9000 §17.2) and the
// 32-bit Version. It STOPS after Version (headerBytes = 5). Everything after
// — Destination Connection ID Length (1 byte) + Destination Connection ID
// (0-20 bytes), Source Connection ID Length (1 byte) + Source Connection ID
// (0-20 bytes), then type-specific length-prefixed fields and the AEAD-encrypted
// payload — is length-prefixed and/or encrypted and is therefore left to fall
// through as `payload`. It is NOT modeled as fixed fields because its offsets
// depend on the CID lengths and most of it is ciphertext (RFC 9000 §17.2,
// RFC 9001 §5). The low 4 bits of the first byte are themselves header-protected
// (encrypted) on the wire per RFC 9001 §5.4, so they are shown as opaque.
import type { ProtocolSpec, ParsedHeader } from '../core/types';

// Long Packet Type, first byte bits 5-4 (RFC 9000 §17.2, Table 5). These two
// bits are NOT header-protected, so they are genuinely readable in cleartext.
const LONG_PACKET_TYPE: Record<number, string> = {
  0: 'Initial',
  1: '0-RTT',
  2: 'Handshake',
  3: 'Retry',
};

// Child protocol id by long packet type. The contents are encrypted, so even
// when implemented these would only expose the encrypted-record shape.
const TYPE_TO_ID: Record<number, string> = {
  0: 'quic-initial',
  1: 'quic-0rtt',
  2: 'quic-handshake',
  3: 'quic-retry',
};

export const quic: ProtocolSpec = {
  id: 'quic',
  name: 'QUIC (long header)',
  layer: 7,
  summary:
    'A UDP-based, encrypted transport. Only the long-header prefix (first byte + version) is in cleartext and fixed-width; connection IDs are length-prefixed and the payload is encrypted.',
  fields: [
    {
      name: 'headerForm',
      label: 'Header Form',
      bits: 1,
      decode: (v) => (v === 1 ? 'Long Header (1)' : 'Short Header (0)'),
      note: '1 = long header (used during connection setup).',
      desc: 'The most-significant bit of the first byte. 1 selects the long header form (used for Initial, 0-RTT, Handshake, and Retry packets during connection establishment); 0 selects the short header used for application data once the connection is up.',
      detail: `HEADER FORM (1 bit, first byte bit 7, RFC 9000 §17.2/§17.3):
- 1 = Long Header: carries the version and both connection IDs, so it is self-describing. Used while the connection is being established (Initial, 0-RTT, Handshake) and for Retry/Version Negotiation.
- 0 = Short Header (RFC 9000 §17.3): used after the handshake completes for 1-RTT application data. It omits the version and the source CID — the receiver already knows them — to cut per-packet overhead.

This spec models the LONG header only. A short-header packet would have a different layout (no version field), so a real dissector branches on this bit before reading anything else.

UNPROTECTED: this bit is in cleartext. It is not covered by QUIC header protection, so on-path observers can always distinguish long vs short header packets.`,
    },
    {
      name: 'fixedBit',
      label: 'Fixed Bit',
      bits: 1,
      decode: (v) => (v === 1 ? 'set (1) — valid QUIC' : 'clear (0) — not standard QUIC'),
      note: 'Must be 1 for standard QUIC; a 0 here is used by other UDP protocols (greasing).',
      desc: 'The second-most-significant bit of the first byte, fixed to 1 for standard QUIC packets. A packet with this bit clear is not a valid QUIC packet and may be discarded; the bit lets QUIC coexist with other UDP-based protocols (e.g. it lets demultiplexers distinguish QUIC from STUN on the same port).',
      detail: `FIXED BIT (1 bit, first byte bit 6, RFC 9000 §17.2):
- Always 1 in standard QUIC. RFC 9000 calls a packet with this bit cleared invalid; an endpoint that receives one MAY discard it.
- It is sometimes called the "QUIC bit." Because demultiplexing QUIC against other UDP protocols (STUN, DTLS, etc.) on shared ports relies on it, it must be set.

GREASING (RFC 9287): endpoints can negotiate the "grease_quic_bit" transport parameter, after which the peer is permitted to send packets with this bit cleared. This deliberately exercises (greases) the bit so middleboxes do not ossify on it always being 1. Without that negotiation, the bit must be 1.

UNPROTECTED: like the Header Form and Long Packet Type bits, the Fixed Bit is in cleartext and not covered by header protection.`,
    },
    {
      name: 'longPacketType',
      label: 'Long Packet Type',
      bits: 2,
      type: 'enum',
      enumMap: LONG_PACKET_TYPE,
      note: '0=Initial, 1=0-RTT, 2=Handshake, 3=Retry.',
      desc: 'Bits 5-4 of the first byte. Identifies which long-header packet this is: Initial (carries the ClientHello / ServerHello), 0-RTT (early application data), Handshake (later handshake messages), or Retry (server-forced address validation). These two bits are in cleartext, so the packet type is observable on the wire.',
      detail: `LONG PACKET TYPE (2 bits, first byte bits 5-4, RFC 9000 §17.2 Table 5):
- 0 (0b00) = Initial — carries CRYPTO frames with the TLS ClientHello/ServerHello and is protected with keys derived from a well-known salt and the Destination Connection ID (RFC 9001 §5.2). "Encrypted" here means tamper-evident, not confidential, because anyone can derive the Initial keys.
- 1 (0b01) = 0-RTT — early application data a client can send before the handshake finishes, protected with the 0-RTT keys. Subject to replay, so it is limited to idempotent data.
- 2 (0b10) = Handshake — later handshake CRYPTO frames, protected with handshake keys that on-path observers cannot derive.
- 3 (0b11) = Retry — sent by a server to force address validation; it carries a token and a Retry Integrity Tag instead of an encrypted payload (RFC 9001 §5.8) and has no packet number.

UNPROTECTED: these two type bits are NOT covered by header protection (RFC 9001 §5.4), so this spec can decode them honestly. The 4 bits below them ARE protected.`,
    },
    {
      name: 'typeSpecificBits',
      label: 'Type-Specific bits (protected)',
      bits: 4,
      type: 'hex',
      decode: () => 'header-protected (encrypted) — opaque on the wire',
      note: 'Low 4 bits of byte 0; header-protected (encrypted) per RFC 9001 §5.4, so not interpretable here.',
      desc: 'The four least-significant bits of the first byte. For Initial/0-RTT/Handshake these encode 2 reserved bits plus the 2-bit Packet Number Length, but they are masked by QUIC header protection (RFC 9001 §5.4) and so appear as ciphertext in a raw capture. We do NOT decode them — their plaintext value is only recoverable with the header-protection keys, which we do not have.',
      detail: `TYPE-SPECIFIC BITS (4 bits, first byte bits 3-0):
For Initial, 0-RTT, and Handshake packets the unprotected meaning is (RFC 9000 §17.2):
- Bits 3-2: Reserved (must be 0 once unmasked); a non-zero value after removing protection is a PROTOCOL_VIOLATION.
- Bits 1-0: Packet Number Length minus one — the packet number is encoded in (this value + 1) bytes, i.e. 1 to 4 bytes.

HEADER PROTECTION (RFC 9001 §5.4): "The four least significant bits of the first byte are protected for packets with long headers." A mask derived from a sample of the (already AEAD-encrypted) packet payload is XORed into these bits. Therefore, in a raw capture, these bits are CIPHERTEXT — you cannot read the packet number length or confirm the reserved bits are zero without the header-protection key.

For Retry packets these 4 bits are unused/arbitrary and Retry has no packet number at all.

WHY WE SHOW THEM AS OPAQUE: faking a decode would violate the project's correctness creed. The honest statement is "header-protected; value not recoverable from the capture alone."`,
    },
    {
      name: 'version',
      label: 'Version',
      bits: 32,
      type: 'hex',
      decode: (v) =>
        v === 0x00000001
          ? '0x00000001 — QUIC v1 (RFC 9000)'
          : v === 0x00000000
            ? '0x00000000 — Version Negotiation'
            : `0x${v.toString(16).padStart(8, '0')}`,
      note: '0x00000001 = QUIC v1 (RFC 9000); 0x00000000 = Version Negotiation.',
      desc: 'A 32-bit version identifier, present only in long-header packets. 0x00000001 is QUIC version 1 (RFC 9000). The reserved value 0x00000000 marks a Version Negotiation packet, by which a server lists the versions it supports when it does not speak the version the client offered.',
      detail: `VERSION (32 bits, big-endian, RFC 9000 §17.2 / §15):
- 0x00000001 = QUIC version 1 (RFC 9000). This is the version negotiated by HTTP/3 today.
- 0x00000000 = Version Negotiation packet (RFC 9000 §17.2.1): not a real version, but a signal. A server that does not support the client's version replies with a long header whose Version is 0 and whose body is the list of versions it DOES support.
- 0x?a?a?a?a (the "0x?a?a?a?a" GREASE pattern, RFC 9000 §15 / RFC 8701-style greasing): reserved versions of the form 0x?a?a?a?a are guaranteed to be unsupported, used to keep version negotiation paths exercised.
- 0x6b3343cf = QUIC v2 (RFC 9369), which renumbers some constants but reuses this same field.

WHY ONLY IN LONG HEADERS: short-header (1-RTT) packets omit the version because, by the time they are used, both endpoints have already agreed on it during the handshake. Carrying it every packet would waste 4 bytes per packet.

ENDIANNESS: network byte order. The bytes 00 00 00 01 = QUIC v1.`,
    },
  ],
  // Fixed prefix only: first byte (1 byte) + Version (4 bytes) = 5 bytes.
  // Everything after (Dest CID Length + Dest CID + Source CID Length + Source
  // CID + length-prefixed fields + encrypted payload) is variable/encrypted and
  // intentionally falls through as payload (see top-of-file HONESTY NOTE).
  headerBytes: () => 5,
  // Dispatch by long packet type. These child ids are not implemented yet; the
  // engine stops gracefully and they are ready for later. The contents are
  // encrypted, so any future child can at most show the encrypted-record shape.
  next: (h: ParsedHeader) => TYPE_TO_ID[h.get('longPacketType')] ?? null,
};
