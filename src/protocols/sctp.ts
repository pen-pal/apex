// SCTP — Stream Control Transmission Protocol common header.
// RFC 9260 (obsoletes RFC 4960), section 3.1 "SCTP Common Header Format".
// SCTP is an IP-layer transport (IP Protocol Number 132) that, like TCP, is
// reliable and connection-oriented, but adds multi-streaming (independent,
// in-order streams within one association, avoiding head-of-line blocking) and
// multi-homing (an endpoint can advertise several IP addresses for failover).
//
// PACKET SHAPE (RFC 9260 §3):
//   +----------------------------+
//   | Common Header (12 bytes)   |   <- THIS spec models exactly these 12 bytes
//   +----------------------------+
//   | Chunk #1                   |   \
//   | Chunk #2                   |    >  one or more variable-length chunks
//   | ...                        |   /
//   +----------------------------+
//
// The common header is a FIXED 12 bytes: Source Port (16), Destination Port (16),
// Verification Tag (32), Checksum (32). Everything after it is a sequence of
// CHUNKS, each a TLV: Chunk Type (8) + Chunk Flags (8) + Chunk Length (16) +
// Chunk Value (Length-4 bytes), padded to a 4-byte boundary. Because the chunk
// area is variable and chunk-type-specific (DATA, INIT, SACK, HEARTBEAT, …), it
// is not a single fixed bit grid and cannot be transcribed honestly as Fields —
// so this spec models only the common header and lets the chunks fall through as
// node.payload. The chunk format and type codes are documented in the Checksum
// field's detail and in the `next`/note below so the teaching stays complete.
//
// CHECKSUM — CRC32c, NOT the Internet checksum (RFC 9260 §3.1, Appendix A):
// SCTP protects the whole packet with a CRC-32c (Castagnoli polynomial,
// 0x1EDC6F41 / reflected 0x82F63B78), the same hardware-friendly CRC used by
// iSCSI and ext4 — a much stronger error check than TCP/UDP's 16-bit ones-
// complement sum. The sender zeroes the 4-byte Checksum field, computes CRC32c
// over the entire packet, and writes the 32-bit result into the field (the wire
// bytes are the CRC in little-endian order). This spec shows the field as opaque
// hex; the test anchors it to a real CRC32c computed off a hand-built INIT packet.
import type { ProtocolSpec, ParsedHeader } from '../core/types';

export const sctp: ProtocolSpec = {
  id: 'sctp',
  name: 'SCTP',
  layer: 4,
  summary:
    'A reliable, message-oriented transport over IP protocol 132 (RFC 9260). Its fixed 12-byte common header carries just two ports, a 32-bit Verification Tag that binds packets to one association, and a CRC32c checksum — then one or more variable-length chunks (DATA, INIT, SACK, HEARTBEAT, …) follow as the payload. SCTP adds multi-streaming and multi-homing on top of TCP-like reliability.',
  fields: [
    {
      name: 'srcPort',
      label: 'Source port',
      bits: 16,
      desc: 'The 16-bit port of the sending SCTP endpoint. Together with the destination port and the source/destination IP addresses it identifies the association. RFC 9260 forbids port 0.',
      detail: `SOURCE PORT (16 bits, RFC 9260 §3.1): "This field identifies the sending port." It MUST NOT be 0.

ASSOCIATIONS, NOT CONNECTIONS: SCTP's analogue of a TCP connection is an "association", identified by the pair of ports plus the sets of IP addresses each endpoint advertises. Because of multi-homing an association can span several IP addresses on each side, so it is not pinned to a single 4-tuple the way a TCP connection is.

WELL-KNOWN SCTP USES: SCTP is the transport for telephony signalling (SIGTRAN: M3UA on port 2905, M2PA 3565), Diameter (3868), WebRTC data channels (over DTLS), and 5G core interfaces (NGAP, etc.). Like TCP it has a separate 16-bit port space.

ENDIANNESS: 16-bit big-endian (network order).`,
    },
    {
      name: 'dstPort',
      label: 'Destination port',
      bits: 16,
      desc: 'The 16-bit port of the receiving SCTP endpoint. The receiver uses it (with the IP addresses) to demultiplex the packet to the right association/socket. RFC 9260 forbids port 0.',
      detail: `DESTINATION PORT (16 bits, RFC 9260 §3.1): "This field identifies the receiving port." It MUST NOT be 0.

NO "NEXT PROTOCOL" FIELD: like TCP and UDP, the SCTP common header has no field naming an upper-layer protocol — the destination port stands in for it (e.g. 2905 = M3UA, 3868 = Diameter). This dissector therefore stops at the common header and exposes the chunks as payload rather than guessing a child by port.

DEMULTIPLEXING: a host finds the matching association from the (source port, destination port, source addresses, destination addresses) tuple, then validates the Verification Tag before processing any chunk.`,
    },
    {
      name: 'verificationTag',
      label: 'Verification tag',
      bits: 32,
      type: 'hex',
      note: 'Per-association magic value; MUST be 0 in a packet carrying an INIT chunk.',
      desc: 'A 32-bit value identifying the association to the receiver. Each side picks a random Initiate Tag during the handshake; every later packet must carry the peer\'s tag in this field, so a stale or blind packet is rejected. A packet that contains an INIT chunk MUST set this to 0.',
      detail: `VERIFICATION TAG (32 bits, RFC 9260 §3.1): "The receiver of this packet uses the Verification Tag to validate the sender of this packet."

HANDSHAKE BINDING: during the 4-way INIT / INIT ACK / COOKIE ECHO / COOKIE ACK setup, each endpoint chooses a random 32-bit Initiate Tag (in its INIT/INIT ACK). For the rest of the association, every packet an endpoint sends carries its PEER's Initiate Tag in this field. A receiver drops any packet whose Verification Tag does not match the value it chose — this is SCTP's defence against blind injection/spoofing and against stale packets from a previous association (it plays the role TCP's sequence-number checks play, but as an explicit per-association nonce).

THE INIT EXCEPTION: "A packet containing an INIT chunk MUST have a zero Verification Tag." The sender of the very first INIT has not yet learned the peer's tag, so it sends 0; the matching INIT ACK then echoes nothing here either (it uses 0) and the real tags travel inside the INIT / INIT ACK chunk bodies as the Initiate Tag. This is why a captured INIT shows Verification Tag = 0x00000000.

WIDTH: 32 bits, shown as hex.`,
    },
    {
      name: 'checksum',
      label: 'Checksum (CRC32c)',
      bits: 32,
      type: 'hex',
      note: 'CRC32c (Castagnoli) over the whole packet — NOT the 16-bit Internet checksum. Computed with this field zeroed.',
      desc: 'A 32-bit CRC32c (Castagnoli polynomial) over the entire SCTP packet — the common header plus all chunks. Unlike TCP/UDP\'s weak 16-bit ones-complement sum, CRC32c reliably catches multi-bit errors. The sender zeroes this field, computes the CRC, then writes the result in.',
      detail: `CHECKSUM (32 bits, RFC 9260 §3.1 and Appendix A): SCTP uses the CRC32c algorithm — the Castagnoli CRC-32, generator polynomial 0x1EDC6F41 (reflected form 0x82F63B78), the same CRC used by iSCSI, Btrfs, and ext4 and accelerated by the x86 CRC32 instruction.

WHY CRC32c, NOT THE INTERNET CHECKSUM: RFC 4960/9260 adopted CRC32c (originally introduced for SCTP by RFC 3309) because the 16-bit one's-complement sum used by TCP/UDP misses many common error patterns. CRC32c gives far stronger detection of multi-bit and burst errors over the whole packet.

COMPUTATION (Appendix B reference procedure):
1. The sender sets the 4-byte Checksum field to 0.
2. It computes CRC32c over the entire SCTP packet (common header + every chunk, including any padding).
3. It places the 32-bit result into the Checksum field; on the wire the four CRC bytes appear in little-endian order.
A receiver zeroes the field again, recomputes, and compares; a mismatch means the packet is discarded.

COVERAGE: the CRC covers the SCTP packet only — it does NOT include an IP pseudo-header (no source/destination IP), unlike the TCP/UDP checksum. Misdelivery is instead guarded by the ports + Verification Tag check. This field is shown here as opaque hex; the accompanying test anchors it to a real CRC32c value computed off a hand-built INIT packet.`,
    },
  ],
  // The SCTP common header is a fixed 12 bytes (4 fields: 16 + 16 + 32 + 32 bits).
  headerBytes: (): number => 12,
  // After the common header come one or more variable-length CHUNKS, each a TLV:
  //   Chunk Type (8 bits) | Chunk Flags (8 bits) | Chunk Length (16 bits) | Value...
  // padded to a 4-byte boundary. Common Chunk Types (RFC 9260 §3.2):
  //   0=DATA, 1=INIT, 2=INIT ACK, 3=SACK, 4=HEARTBEAT, 5=HEARTBEAT ACK,
  //   6=ABORT, 7=SHUTDOWN, 8=SHUTDOWN ACK, 9=ERROR, 10=COOKIE ECHO,
  //   11=COOKIE ACK, 14=SHUTDOWN COMPLETE.
  // The chunk area is variable and chunk-type-specific (not one fixed bit grid),
  // so there is no generic child protocol to dissect: the chunks fall through as
  // node.payload and dissection stops at the common header.
  next: (_h: ParsedHeader): string | null => null,
};
