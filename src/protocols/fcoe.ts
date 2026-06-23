// FCoE — Fibre Channel over Ethernet. T11 FC-BB-5 (INCITS 462-2010).
//
// REFERENCE: ANSI/INCITS 462-2010, "Fibre Channel — Backbone-5 (FC-BB-5)",
// section 7 (FCoE frame format). FCoE is NOT an IETF protocol; its authoritative
// reference is the T11 FC-BB-5 standard. The SOF/EOF frame-delimiter encodings it
// carries are the same code points used by RFC 3643 ("Fibre Channel Frame
// Encapsulation"); the field offsets below are transcribed from FC-BB-5 and
// cross-checked against the Wireshark FCoE dissector (epan/dissectors/packet-fcoe.c),
// the de-facto reference implementation.
//
// WHAT FCoE IS
// ------------
// FCoE carries a complete, unmodified Fibre Channel (FC) frame inside an Ethernet
// frame, so a single converged Ethernet fabric can transport both LAN (IP) traffic
// and SAN (storage / SCSI-over-FC) traffic. It rides directly on Ethernet — there
// is NO IP and NO TCP/UDP layer — using a dedicated EtherType, 0x8906. (A separate
// protocol, FIP, EtherType 0x8914, handles VLAN/FCF discovery and login; the frames
// modeled here are the FCoE *data* frames, 0x8906.)
//
// ENCAPSULATION STACK ON THE WIRE (FC-BB-5 §7.4):
//   Ethernet header (DA/SA, optional 802.1Q tag, EtherType 0x8906)
//   FCoE header        (14 bytes — modeled here)
//   ── Encapsulated FC frame ──
//     FC frame header  (24 bytes: R_CTL, D_ID, S_ID, TYPE, F_CTL, SEQ_ID,
//                       DF_CTL, SEQ_CNT, OX_ID, RX_ID, Parameter)
//     FC payload       (0..2112 bytes of FC data — e.g. a SCSI command/data)
//     FC CRC           (4 bytes — Fibre Channel's own CRC over the FC frame)
//   FCoE trailer       (EOF (1 byte) + 3 reserved bytes = 4 bytes)
//   Ethernet FCS       (4 bytes)
//
// THE 14-BYTE FCoE HEADER (FC-BB-5 §7.4, T11 format):
//   byte 0:    Version (upper 4 bits) | Reserved (lower 4 bits)
//   bytes 1-12: Reserved (12 bytes = 96 bits, all zero — present to pad the frame
//               so the encapsulated FC frame's SOF lands on a fixed offset and to
//               help meet Ethernet's 64-byte minimum)
//   byte 13:   SOF (encoded Start-of-Frame delimiter of the FC frame)
//
//   Field widths in bits: Version(4) + Reserved(4) + Reserved(96) + SOF(8) = 112
//   bits = 14 bytes. The SOF is the LAST byte of the FCoE header; the EOF travels
//   separately in the FCoE trailer (after the FC CRC), because in native FC the SOF
//   and EOF are ordered-set delimiters that bracket the frame.
import type { ProtocolSpec, ParsedHeader } from '../core/types';

// FC frame Start-of-Frame delimiter encodings (FC-BB-5 / RFC 3643 Table 2).
// The class-3 (datagram, no ACK) delimiters SOFi3/SOFn3 are the common case for
// FCP (SCSI over FC); the others are included for completeness so real captures
// decode. "i" = Initiate (first frame of a sequence), "n" = Normal (subsequent).
const SOF: Record<number, string> = {
  0x28: 'SOFf  (fabric)',
  0x29: 'SOFi4 (class-4 initiate)',
  0x2d: 'SOFi2 (class-2 initiate)',
  0x2e: 'SOFi3 (class-3 initiate)',
  0x31: 'SOFn4 (class-4 normal)',
  0x35: 'SOFn2 (class-2 normal)',
  0x36: 'SOFn3 (class-3 normal)',
  0x39: 'SOFc4 (class-4 connect)',
};

export const fcoe: ProtocolSpec = {
  id: 'fcoe',
  name: 'FCoE',
  layer: 2, // rides directly on Ethernet (EtherType 0x8906) — no IP, no TCP/UDP
  summary:
    'Fibre Channel over Ethernet (T11 FC-BB-5): a 14-byte header on Ethernet (EtherType 0x8906) that carries a complete, unmodified Fibre Channel frame, letting one converged Ethernet fabric run both LAN (IP) and SAN (storage) traffic. The header is mostly reserved padding — its real content is the FC frame delimiter (SOF) that brackets the encapsulated FC frame.',
  fields: [
    {
      name: 'version',
      label: 'Version',
      bits: 4,
      note: 'FCoE version — MUST be 0 for FC-BB-5.',
      desc: 'The 4-bit FCoE version, occupying the upper nibble of the first byte. FC-BB-5 defines version 0 only, so this MUST be 0; a non-zero value is from an unknown/future encapsulation and the frame is discarded. These 4 bits also satisfy the IEEE EtherType sub-type requirement.',
      detail: `VERSION (4 bits, upper nibble of byte 0, FC-BB-5 §7.4):
- MUST be 0b0000 (0) for FCoE as standardized in FC-BB-5. There is no version 1+ defined; receivers that see a non-zero version discard the frame.
- A single 4-bit version field is all the per-frame versioning FCoE carries — everything else needed to interpret the frame (which FC frame, which class of service) lives in the encapsulated FC frame itself, not in the FCoE shim.

WHY SO MINIMAL: FCoE's design goal was to add the *smallest possible* shim so that an unmodified Fibre Channel frame could traverse Ethernet. The header therefore contributes almost no semantics of its own — just a version, a frame-start delimiter (SOF), and reserved padding.`,
    },
    {
      name: 'reserved1',
      label: 'Reserved',
      bits: 4,
      type: 'hex',
      note: 'Reserved low nibble of byte 0 — zero. (Distinguishes T11 from pre-standard FCoE.)',
      desc: 'The lower 4 bits of the first byte, reserved and set to zero. Byte-aligning the version field, these bits also help a dissector tell the standardized T11 FCoE format apart from the obsolete pre-standard format, where byte 1 was non-zero.',
      detail: `RESERVED (4 bits, lower nibble of byte 0, FC-BB-5 §7.4): set to zero on transmit, ignored on receive. Together with the 96 reserved bits that follow, this completes the all-zero padding region of the header.

HISTORICAL NOTE: an early, pre-standard FCoE draft packed a frame length and SOF into just 2 header bytes. The Wireshark dissector still distinguishes the two by testing byte 1: zero => the 14-byte T11 (FC-BB-5) format modeled here; non-zero => the obsolete 2-byte format. Real FCoE today is always the T11 form.`,
    },
    {
      name: 'reserved2',
      label: 'Reserved (padding)',
      bits: 96, // 12 bytes — exceeds 48-bit numeric range, so modeled as 'bytes'
      type: 'bytes',
      note: '12 reserved bytes — all zero. Pads the header so the FC frame starts at a fixed offset.',
      desc: 'Twelve reserved bytes (bits of byte 1 through byte 12), all set to zero. This padding gives the FCoE header its fixed 14-byte size: it puts the encapsulated FC frame at a constant offset and contributes to meeting Ethernet\'s 64-byte minimum frame length.',
      detail: `RESERVED PADDING (12 bytes = 96 bits, bytes 1..12, FC-BB-5 §7.4): all zero on transmit, ignored on receive.

WHY 12 BYTES OF NOTHING:
- FIXED OFFSET: a constant-size 14-byte header means the encapsulated FC frame's header always begins at the same byte offset, simplifying hardware (CNA / FCoE switch ASIC) parsing.
- MINIMUM FRAME SIZE: Ethernet requires a minimum 64-byte frame. Short FC frames plus this padding help reach that minimum without separate Ethernet pad bytes leaking into the FC frame.

WIDTH: 96 bits exceeds the engine's exact numeric range (<= 48 bits), so per the Apex contract this field is modeled as 'bytes' and shown as its 12 raw octets (all 0x00 in a valid frame) rather than a single number.`,
    },
    {
      name: 'sof',
      label: 'SOF (Start of Frame)',
      bits: 8,
      type: 'enum',
      enumMap: SOF,
      note: 'Encoded FC Start-of-Frame delimiter — SOFi3 (0x2E) / SOFn3 (0x36) for class-3.',
      desc: 'The last byte of the FCoE header: the encoded Start-of-Frame ordered set that, in native Fibre Channel, marks the beginning of a frame and signals its class of service. For class-3 FCP (SCSI) traffic this is SOFi3 (0x2E, first frame of a sequence) or SOFn3 (0x36, subsequent frames). The matching EOF delimiter travels in the FCoE trailer after the FC CRC.',
      detail: `SOF (1 byte, byte 13 — the last byte of the FCoE header; FC-BB-5 §7.4, encoding per RFC 3643 Table 2):
In native Fibre Channel, SOF and EOF are not bytes but 40-bit "ordered sets" transmitted on the serial link to bracket each frame. FCoE/FCIP encode them as the single-byte values below so they survive on Ethernet:
  0x28 SOFf   (fabric)              0x29 SOFi4 (class-4 initiate)
  0x2D SOFi2  (class-2 initiate)    0x2E SOFi3 (class-3 initiate)
  0x31 SOFn4  (class-4 normal)      0x35 SOFn2 (class-2 normal)
  0x36 SOFn3  (class-3 normal)      0x39 SOFc4 (class-4 connect)

NAMING: the digit is the FC class of service; "i" (Initiate) marks the first frame of a sequence, "n" (Normal) marks the rest. CLASS 3 is connectionless, unacknowledged datagram delivery — the workhorse for FCP (SCSI over FC), so SOFi3 / SOFn3 dominate real storage captures.

WHY SOF IS HERE BUT EOF IS NOT: a native FC frame is SOF | FC-header | payload | FC-CRC | EOF. FCoE keeps that ordering: SOF is the final byte of the FCoE *header* (immediately before the FC frame), while EOF sits in the FCoE *trailer*, after the 4-byte FC CRC, so the encapsulated bytes still read SOF .. FC-CRC .. EOF in order.`,
    },
  ],
  // The FCoE header is a fixed 14 bytes (FC-BB-5 §7.4, T11 format). No length field
  // in this header bounds the PDU — the FC frame's own structure and the Ethernet
  // frame length do — so there is no pduBytes here.
  headerBytes: (): number => 14,
  // The FCoE TRAILER is a fixed 4 bytes at the very END of the frame (FC-BB-5 §7.4):
  // a 1-byte EOF (End-of-Frame delimiter, e.g. EOFn/EOFt) + 3 reserved bytes. It is
  // end-anchored (no length field points at it), so we reserve it generically — the
  // encapsulated FC frame stays in node.payload and the EOF+reserved go to node.trailer.
  trailerBytes: (): number => 4,
  // The payload is then the complete encapsulated Fibre Channel frame: a 24-byte FC
  // frame header (R_CTL, D_ID, S_ID, TYPE, F_CTL, SEQ_ID, DF_CTL, SEQ_CNT, OX_ID,
  // RX_ID, Parameter), 0..2112 bytes of FC payload, and the FC frame's own 4-byte
  // CRC. No FC dissector is registered, so dissection stops and the FC frame remains
  // in node.payload intact.
  next: (_h: ParsedHeader): string | null => null,
};
