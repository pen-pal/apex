// SSH — Secure Shell Transport Layer Protocol, the Binary Packet Protocol.
// RFC 4253 (SSH Transport Layer Protocol). Message numbers: RFC 4253 §12.
// Related: RFC 4251 (architecture), RFC 4252 (auth), RFC 4254 (connection).
// SSH runs over TCP, by convention on port 22.
//
// THE VERSION-STRING LINE COMES FIRST (RFC 4253 §4.2)
// ---------------------------------------------------
// Before ANY binary packet, both sides exchange an ASCII identification line:
//
//   SSH-protoversion-softwareversion SP comments CR LF      (e.g. "SSH-2.0-OpenSSH_9.6\r\n")
//
// This line is plain US-ASCII terminated by CR LF and is NOT a binary packet —
// it is read by scanning for "\r\n", exactly like an HTTP request-line. The
// protoversion for SSH-2 is the literal "2.0". A server MAY emit informational
// lines first (each CR LF terminated, none beginning with "SSH-"). This spec
// models the BINARY PACKET that follows that line, not the line itself.
//
// THE BINARY PACKET PROTOCOL (RFC 4253 §6)
// ----------------------------------------
//   uint32    packet_length     -- length of the rest of the packet, NOT
//                                  including 'mac' and NOT including these 4 bytes.
//                                  i.e. it counts padding_length + payload + padding.
//   byte      padding_length    -- length of 'random padding' (>= 4, <= 255)
//   byte[n1]  payload           -- n1 = packet_length - padding_length - 1
//   byte[n2]  random padding    -- n2 = padding_length, arbitrary content
//   byte[m]   mac               -- Message Authentication Code; m = mac length,
//                                  0 until a MAC algorithm is negotiated.
// The total length of (packet_length || padding_length || payload || padding)
// MUST be a multiple of max(cipher block size, 8), and padding is at least 4
// bytes, so even the very first plaintext KEXINIT packet is block-padded.
//
// WHAT WE MODEL HONESTLY
// ----------------------
// We model only the fixed 5-byte cleartext frame head: packet_length (32) +
// padding_length (8). headerBytes() => 5. Everything after — payload, padding,
// and MAC — falls through as node.payload.
//
// ENCRYPTION (RFC 4253 §6.3, §6.4): after key exchange completes (the
// SSH_MSG_NEWKEYS exchange), EVERYTHING from packet_length onward is ENCRYPTED
// and a MAC is appended, so on a real established session you cannot even read
// packet_length, let alone the payload. We do NOT invent decrypted plaintext for
// such packets — that would require the negotiated session keys, which is out of
// scope. The only packets whose head is genuinely cleartext on the wire are the
// pre-NEWKEYS ones (the initial KEXINIT and key-exchange messages), since those
// are sent under the "none" cipher before keys exist. next() returns null:
// the payload is an SSH message whose meaning depends on its first byte (the
// message number, e.g. 20 = KEXINIT) and, once encrypted, is opaque.
import type { ProtocolSpec } from '../core/types';

// SSH message numbers (the first byte of an unencrypted payload). RFC 4253 §12,
// RFC 4252 §6, RFC 4254 §9. Used only to teach what payload[0] would mean on a
// cleartext packet — we do not dissect the payload itself.
const MSG_NUMBERS: Record<number, string> = {
  1: 'SSH_MSG_DISCONNECT',
  2: 'SSH_MSG_IGNORE',
  3: 'SSH_MSG_UNIMPLEMENTED',
  4: 'SSH_MSG_DEBUG',
  5: 'SSH_MSG_SERVICE_REQUEST',
  6: 'SSH_MSG_SERVICE_ACCEPT',
  20: 'SSH_MSG_KEXINIT',
  21: 'SSH_MSG_NEWKEYS',
  30: 'SSH_MSG_KEXDH_INIT',
  31: 'SSH_MSG_KEXDH_REPLY',
  50: 'SSH_MSG_USERAUTH_REQUEST',
  51: 'SSH_MSG_USERAUTH_FAILURE',
  52: 'SSH_MSG_USERAUTH_SUCCESS',
  90: 'SSH_MSG_CHANNEL_OPEN',
  94: 'SSH_MSG_CHANNEL_DATA',
};

export const ssh: ProtocolSpec = {
  id: 'ssh',
  name: 'SSH',
  layer: 7,
  summary:
    'The Secure Shell transport over TCP/22. After an ASCII version line ("SSH-2.0-...\\r\\n"), traffic becomes a stream of Binary Packets: a 32-bit packet_length, an 8-bit padding_length, then payload + random padding + MAC. Once key exchange finishes the whole packet (length included) is ENCRYPTED — Apex shows the cleartext frame head and the encrypted-record shape honestly rather than inventing plaintext.',
  fields: [
    {
      name: 'packetLength',
      label: 'Packet length',
      bits: 32,
      desc: 'The number of bytes that follow in this packet, NOT counting these 4 bytes and NOT counting the trailing MAC. It therefore equals padding_length (1) + payload + random padding.',
      detail: `PACKET LENGTH (uint32, big-endian) — RFC 4253 §6:
"The length of the packet in bytes, not including 'mac' or the 'packet_length' field itself."

WHAT IT COUNTS:
  packet_length = 1 (padding_length byte) + len(payload) + len(random padding)
So the payload length is:  payload = packet_length - padding_length - 1.

WHAT IT DOES NOT COUNT:
  - its own 4 bytes
  - the appended MAC (whose size depends on the negotiated MAC algorithm; 0 before keys exist)

WHOLE-PACKET ALIGNMENT: (packet_length || padding_length || payload || padding)
must be a multiple of max(cipher block size, 8). Combined with "padding >= 4
bytes" this means every packet, even the first cleartext KEXINIT, is padded out
to a block boundary.

ENCRYPTED AFTER KEX: once the SSH_MSG_NEWKEYS exchange completes, this field is
itself encrypted — a sniffer cannot read it. The implementation must decrypt the
first cipher block to recover the length. Apex does not have the session keys, so
for an established session it treats the bytes as opaque ciphertext.

LIMIT: RFC 4253 §6.1 requires all implementations handle an uncompressed payload
of up to 32768 bytes and a total packet size of up to 35000 bytes; implementations
reject absurd lengths to resist memory-exhaustion.

ENDIANNESS: 32-bit big-endian (network byte order).`,
    },
    {
      name: 'paddingLength',
      label: 'Padding length',
      bits: 8,
      decode: (v) => `${v} bytes of random padding`,
      desc: 'How many bytes of random padding sit at the end of the packet (after the payload). At least 4 and at most 255 bytes; the padding pushes the packet to a cipher-block boundary.',
      detail: `PADDING LENGTH (byte) — RFC 4253 §6:
"The length of 'random padding' (bytes)." Constraints: "There MUST be at least
four bytes of padding ... and a maximum of 255 bytes of padding."

WHY PAD AT ALL:
  - Block ciphers (CBC/CTR with a block size) require the encrypted region to be
    a whole number of blocks; padding makes (packet_length || padding_length ||
    payload || padding) a multiple of max(block size, 8).
  - The padding is RANDOM, which also frustrates traffic analysis of payload size
    at the block-size granularity.

RECOVERING THE PAYLOAD SIZE:
  payload_bytes = packet_length - padding_length - 1

NOT A LENGTH OF THE WHOLE PDU: this is only the trailing padding, so unlike a
UDP/IP length field it does not by itself bound the PDU. The MAC (if any) follows
the padding and is sized by the negotiated MAC algorithm, not by this field.`,
    },
  ],
  // The cleartext frame head is a fixed 5 bytes: packet_length (4) + padding_length (1).
  // The payload + random padding + MAC follow and fall through as node.payload.
  // (After key exchange these bytes are encrypted; see the top-of-file note.)
  headerBytes: () => 5,
  // The first byte of an UNENCRYPTED payload is the SSH message number (e.g. 20 =
  // KEXINIT). The SSH message body has no further generic child to dissect, and on
  // an established session it is encrypted and opaque, so dissection stops here.
  next: () => null,
};

// Exported only so a UI/teaching layer can label payload[0] of a cleartext
// packet; the engine never reads this.
export const SSH_MSG_NUMBERS = MSG_NUMBERS;
