// WireGuard — a fast, modern VPN tunnel built on Noise_IKpsk2.
// Reference: "WireGuard: Next Generation Kernel Network Tunnel" (Jason A.
// Donenfeld), the WireGuard whitepaper, §5.4 "Messages"
// (https://www.wireguard.com/papers/wireguard.pdf, also summarised at
// https://www.wireguard.com/protocol/). WireGuard runs over UDP, by
// convention on port 51820.
//
// THE COMMON HEADER
// -----------------
// Every WireGuard message begins with the same 4-byte header:
//   u8  message_type      (1 = Handshake Initiation, 2 = Handshake Response,
//                          3 = Cookie Reply, 4 = Transport Data)
//   u8  reserved_zero[3]  (3 bytes, MUST be zero on send; ignored on receive)
// Implementations actually read these first 4 bytes as a single little-endian
// u32, so message_type is the low byte and the reserved[3] are the high three
// zero bytes. Because message_type is a single octet, its byte order is moot;
// we model it as a u8 + a 24-bit reserved field, which is exactly the 4 bytes
// on the wire.
//
// ENDIANNESS — WireGuard IS LITTLE-ENDIAN
// ---------------------------------------
// Unusually for a network protocol (most IETF protocols are big-endian), the
// whitegram states "All integer assignments in WireGuard are little-endian,
// unless otherwise noted." So sender_index, receiver_index and counter are read
// least-significant-byte-first. We mark those fields endian:'le'. The opaque
// cryptographic blobs (ephemeral keys, AEAD ciphertexts, MACs) are raw byte
// strings with no integer interpretation.
//
// WHAT WE MODEL — THE 4-BYTE HEADER, THEN OPAQUE CRYPTO
// ----------------------------------------------------
// After the 4-byte header, each message type has a fixed cryptographic body:
//
//   Type 1 Handshake Initiation (148 bytes total):
//     sender_index(4) ephemeral(32) enc_static(48) enc_timestamp(28)
//     mac1(16) mac2(16)
//   Type 2 Handshake Response (92 bytes total):
//     sender_index(4) receiver_index(4) ephemeral(32) enc_nothing(16)
//     mac1(16) mac2(16)
//   Type 3 Cookie Reply (64 bytes total):
//     receiver_index(4) nonce(24) enc_cookie(32)
//   Type 4 Transport Data (16+ bytes):
//     receiver_index(4) counter(8) encrypted_encapsulated_packet(variable)
//
// Almost all of this is CIPHERTEXT or random/ephemeral key material:
// `ephemeral` is a one-time Curve25519 public key; `encrypted_static`,
// `encrypted_timestamp`, `encrypted_nothing`, `encrypted_cookie` and
// `encrypted_encapsulated_packet` are ChaCha20-Poly1305 AEAD outputs
// (ciphertext + 16-byte tag); mac1/mac2 are keyed-BLAKE2s MACs. Apex shows the
// cleartext header (type + the cleartext sender/receiver indices) and treats
// the rest as the opaque encrypted body — it falls through as node.payload and
// is NEVER decoded into invented plaintext. There is no inner protocol to
// dissect (next => null): the real tunnelled IP packet only exists after the
// AEAD is decrypted with keys Apex does not have.
import type { ProtocolSpec } from '../core/types';

const MESSAGE_TYPE: Record<number, string> = {
  1: 'Handshake Initiation',
  2: 'Handshake Response',
  3: 'Cookie Reply',
  4: 'Transport Data',
};

export const wireguard: ProtocolSpec = {
  id: 'wireguard',
  name: 'WireGuard',
  layer: 7,
  summary:
    'A minimal, modern VPN over UDP/51820 built on the Noise protocol framework (Noise_IKpsk2) with Curve25519, ChaCha20-Poly1305 and BLAKE2s. Every message starts with a 4-byte header (a 1-byte type + 3 reserved zero bytes); the body is cryptographic — ephemeral keys, AEAD ciphertexts and MACs — so Apex shows the cleartext header and treats the encrypted remainder as opaque, never inventing plaintext. Integers are little-endian.',
  fields: [
    {
      name: 'messageType',
      label: 'Message type',
      bits: 8,
      type: 'enum',
      enumMap: MESSAGE_TYPE,
      note: '1=Initiation, 2=Response, 3=Cookie Reply, 4=Transport Data.',
      desc: 'The single byte that names the WireGuard message. There are exactly four: Handshake Initiation (1) and Response (2) perform the 1-RTT Noise_IKpsk2 handshake; Cookie Reply (3) is a DoS-mitigation challenge under load; Transport Data (4) carries an encrypted tunnelled IP packet.',
      detail: `MESSAGE TYPE (1 byte, the low byte of a little-endian u32):
- 1 = Handshake Initiation  (initiator -> responder, 148 bytes)
- 2 = Handshake Response    (responder -> initiator, 92 bytes)
- 3 = Cookie Reply          (under load, to rate-limit, 64 bytes)
- 4 = Transport Data        (an encrypted data packet, 16+ bytes)

THE HANDSHAKE (Noise_IKpsk2, 1-RTT): the initiator sends type 1; the responder
answers with type 2; after that single round trip both sides have derived a pair
of symmetric ChaCha20-Poly1305 keys and exchange type-4 data messages. Keys are
rotated by re-handshaking roughly every 2 minutes.

WHY A FULL u32 IS READ: implementations parse the first four bytes as a
little-endian u32 and switch on it. Since the type occupies only the least-
significant byte and the other three bytes are reserved zero, the u32 value
equals the type byte.`,
    },
    {
      name: 'reserved',
      label: 'Reserved',
      bits: 24,
      type: 'hex',
      note: 'Three zero bytes. MUST be 0 on send; ignored on receive.',
      desc: 'Three reserved bytes that follow the type byte, completing a 4-byte aligned header. They MUST be set to zero by senders and are ignored by receivers, so the whole first word reads as the message type.',
      detail: `RESERVED (3 bytes = 24 bits):
- Sent as zero, ignored on receipt (whitepaper §5.4). They pad the type byte out
  to a clean 32-bit word and exist for possible future use.
- Some middleboxes/forks repurpose these bytes; standard WireGuard requires them
  to be zero. The Linux kernel historically did not validate them, prompting
  patches to "respect WG protocol reserved bytes."`,
    },
  ],
  // The cleartext header is a fixed 4 bytes (type + 3 reserved). Everything
  // after it is message-type-specific cryptographic material (indices, ephemeral
  // public key, AEAD ciphertexts, MACs, or the encrypted transport packet) and
  // falls through as the opaque payload. See the top-of-file comment.
  headerBytes: () => 4,
  // The encrypted body is not a nested protocol Apex can dissect: the tunnelled
  // IP packet only exists after AEAD decryption with keys we do not have.
  next: () => null,
};
