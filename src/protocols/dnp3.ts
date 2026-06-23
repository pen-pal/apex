// DNP3 — Distributed Network Protocol, data-link layer frame header.
// Standard: IEEE Std 1815-2012 (DNP3), which incorporates the FT3 frame format
// and the link-layer procedures of IEC 60870-5-1 / IEC 60870-5-2. DNP3 is a SCADA
// protocol used between control-system masters and outstations (RTUs/IEDs); over
// IP it runs on TCP or UDP port 20000.
//
// THE FRAME (IEEE 1815 §9, "Data Link Layer"):
//
//   +------+------+--------+---------+---------------+---------------+------+
//   | 0x05 | 0x64 | LENGTH | CONTROL | DESTINATION   | SOURCE        | CRC  |
//   | (sync, 2B)  | (1B)   | (1B)    | (2B, LE)      | (2B, LE)      | (2B) |
//   +------+------+--------+---------+---------------+---------------+------+
//   | ...user data, in blocks of 16 octets, each followed by its own 2-byte CRC ...|
//
// This spec models the fixed 10-byte data-link HEADER block (sync, length,
// control, destination, source) only. NOTE on the header CRC: the two start
// bytes through the source address form the first FT3 block and are immediately
// followed by a 2-byte CRC; that CRC and every later block CRC are part of the
// frame but are NOT part of this 10-byte header, so they fall into node.payload.
// We do not model them as fields, and `next` is null: above the data link sit the
// DNP3 TRANSPORT function (1 byte: FIN/FIR/sequence) and the APPLICATION layer
// (application control + function code + object headers), which are de-blocked
// from the CRC-interleaved user data — not a fixed bit grid we can transcribe
// honestly here. They, plus all block CRCs, remain in the payload (see the note
// on `length` and the top-of-file note).
//
// ENDIANNESS: DNP3 multi-byte integers in the link header are LITTLE-ENDIAN
// (IEEE 1815: "the first byte of the address is the low order byte and the second
// byte is the high order"). DESTINATION and SOURCE are therefore read with the
// engine's endian:'le' hook. The 0x0564 sync word is defined byte-by-byte (0x05
// then 0x64), so it is read big-endian as the literal on-wire value 0x0564.
import type { ProtocolSpec, ParsedHeader } from '../core/types';

// IEEE 1815 §9 / IEC 60870-5-2 link-layer function codes.
// PRIMARY frames (PRM=1) and SECONDARY frames (PRM=0) use the SAME 4-bit field
// but DIFFERENT code tables, so the meaning depends on PRM — decoded below.
const PRIMARY_FN: Record<number, string> = {
  0: 'RESET_LINK_STATES', // SEND/CONFIRM — reset of remote link
  1: 'RESET_USER_PROCESS', // SEND/CONFIRM — reset of user process (obsolete)
  2: 'TEST_LINK_STATES', // SEND/CONFIRM — test function for link
  3: 'CONFIRMED_USER_DATA', // SEND/CONFIRM — user data
  4: 'UNCONFIRMED_USER_DATA', // SEND/NO REPLY — unconfirmed user data
  9: 'REQUEST_LINK_STATUS', // REQUEST/RESPOND — request link status
};
const SECONDARY_FN: Record<number, string> = {
  0: 'ACK', // CONFIRM — positive acknowledgement
  1: 'NACK', // CONFIRM — message not accepted, link busy
  11: 'LINK_STATUS', // RESPOND — status of link
  14: 'NOT_SUPPORTED', // link service not functioning / not used
  15: 'NOT_SUPPORTED', // link service not implemented
};

export const dnp3: ProtocolSpec = {
  id: 'dnp3',
  name: 'DNP3',
  layer: 7,
  summary:
    'The DNP3 (IEEE 1815) data-link frame header — the SCADA protocol that carries telemetry and control between a master and outstations (RTUs/IEDs), here over TCP/UDP 20000. A 0x0564 sync word, a length, a control byte (direction + frame-count + link function code) and little-endian destination/source station addresses front every frame; the user data that follows is split into 16-byte blocks each guarded by its own CRC.',
  fields: [
    {
      name: 'start',
      label: 'Start bytes (sync)',
      bits: 16,
      type: 'hex',
      decode: (v) => (v === 0x0564 ? '0x0564 (valid DNP3 sync)' : `0x${v.toString(16).padStart(4, '0')} (INVALID — not a DNP3 frame)`),
      note: 'Always 0x0564 — the fixed two-byte frame delimiter.',
      desc: 'A fixed 2-byte synchronization word, 0x05 followed by 0x64, that marks the start of every DNP3 data-link frame. A receiver scans the byte stream for this pattern to find frame boundaries; it is not a length or type field, just a constant delimiter.',
      detail: `START / SYNC (2 bytes, IEEE 1815 §9): the literal pair 0x05 0x64 (on the wire, in this order) begins every frame. It is read here big-endian as the value 0x0564 because it is defined byte-by-byte, not as a little-endian integer.

WHY A SYNC WORD: DNP3 was designed for raw serial links with no framing of their own, so the receiver must resynchronize by hunting for 0x0564 in the octet stream. The chance of the pattern appearing by accident in user data is reduced because the immediately following LENGTH and the per-block CRCs let a receiver reject a false start.

OVER IP: even on TCP/UDP 20000 the same FT3 frame (sync word included) is carried verbatim, so a dissector keys on 0x0564 to recognize DNP3.`,
    },
    {
      name: 'length',
      label: 'Length',
      bits: 8,
      decode: (v) => `${v} octets (CONTROL + DEST + SOURCE + user data; excludes sync, this byte, and all CRCs)`,
      note: 'Counts CONTROL + DEST + SOURCE + user data. Excludes the sync word, this byte, and every CRC. Range 5..255.',
      desc: 'The number of octets in the frame from the CONTROL byte onward, counting CONTROL (1) + DESTINATION (2) + SOURCE (2) + all user data — but NOT the two sync bytes, NOT this length byte, and NOT any of the 2-byte block CRCs. The minimum is 5 (a header-only frame with no user data).',
      detail: `LENGTH (1 byte, IEEE 1815 §9 / IEC 60870-5-2): "specifies the count of user octets in the frame. The CONTROL, DESTINATION and SOURCE field sizes are included in this count." Specifically it counts CONTROL + DESTINATION + SOURCE + user data.

WHAT IT EXCLUDES: the 2-byte sync (0x0564), the LENGTH byte itself, and every CRC are NOT counted. Because CRCs are interleaved (one after the 8 header bytes, then one after each subsequent 16-byte data block), the on-wire frame is LONGER than LENGTH — a 16-byte-block expansion the LENGTH field deliberately hides so the count describes only meaningful octets.

RANGE: minimum 5 (header only, no user data — e.g. an ACK or a link-status frame); maximum 255. With the fixed 5 header octets that leaves up to 250 octets of user data, which the transport function then segments.

HEADER vs FRAME: this spec's header is a fixed 10 bytes (sync 2 + length 1 + control 1 + dest 2 + source 2 + the first block's 2-byte CRC). The first block CRC lives at the end of the header block but is modeled as payload here, not as a header field.`,
    },
    {
      name: 'control',
      label: 'Control',
      bits: 8,
      type: 'flags',
      // flagBits index 0 = MSB (bit 7). DIR=bit7, PRM=bit6, FCB/RES=bit5,
      // FCV/DFC=bit4, then the 4-bit function code (bits 3..0).
      flagBits: ['DIR', 'PRM', 'FCB/RES', 'FCV/DFC', 'FN3', 'FN2', 'FN1', 'FN0'],
      decode: (v) => {
        const dir = v & 0x80 ? 'DIR=1 (master->outstation)' : 'DIR=0 (outstation->master)';
        const prm = v & 0x40 ? 1 : 0;
        const fn = v & 0x0f;
        if (prm) {
          // PRM=1: bit5=FCB, bit4=FCV; function code from PRIMARY table.
          const fcb = v & 0x20 ? 1 : 0;
          const fcv = v & 0x10 ? 1 : 0;
          const name = PRIMARY_FN[fn] ?? 'reserved';
          return `${dir}, PRM=1 (primary), FCB=${fcb}, FCV=${fcv}, FN=${fn} (${name})`;
        }
        // PRM=0: bit5=RES (reserved), bit4=DFC (data flow control); SECONDARY table.
        const dfc = v & 0x10 ? 1 : 0;
        const name = SECONDARY_FN[fn] ?? 'reserved';
        return `${dir}, PRM=0 (secondary), DFC=${dfc}, FN=${fn} (${name})`;
      },
      note: 'DIR (0x80), PRM (0x40), then FCB/FCV (primary) or RES/DFC (secondary), then a 4-bit link function code.',
      desc: 'The link-control byte. Bit 7 DIR gives the physical direction (1 = master to outstation). Bit 6 PRM marks a primary (initiating) vs secondary (responding) frame. The next two bits and the low 4-bit function code are interpreted differently depending on PRM: a primary frame carries FCB/FCV and a primary function code; a secondary frame carries RES/DFC and a secondary function code.',
      detail: `CONTROL (1 byte, IEEE 1815 §9 / IEC 60870-5-2), bits MSB-first:
- bit 7 DIR — direction: 1 = frame sent FROM the master (toward an outstation); 0 = frame sent FROM an outstation (toward the master). It reflects the station's role, not who physically transmitted.
- bit 6 PRM — Primary Message: 1 = this frame is from the PRIMARY (initiating) station; 0 = from the SECONDARY (responding) station. PRM selects which of the two interpretations below applies.

WHEN PRM=1 (primary frame):
- bit 5 FCB — Frame Count Bit: toggles 0/1 on each successful SEND/CONFIRM to the same outstation, so a duplicate (lost-ACK retransmission) is detected.
- bit 4 FCV — Frame Count Valid: 1 = the FCB is meaningful and must be checked; 0 = ignore FCB (used by services like RESET_LINK_STATES and UNCONFIRMED_USER_DATA).
- bits 3..0 PRIMARY function code: 0=RESET_LINK_STATES, 1=RESET_USER_PROCESS, 2=TEST_LINK_STATES, 3=CONFIRMED_USER_DATA, 4=UNCONFIRMED_USER_DATA, 9=REQUEST_LINK_STATUS.

WHEN PRM=0 (secondary frame):
- bit 5 RES — reserved (0).
- bit 4 DFC — Data Flow Control: 1 = the secondary's buffer is full; the primary must stop sending CONFIRMED_USER_DATA (link-layer flow control / busy).
- bits 3..0 SECONDARY function code: 0=ACK, 1=NACK (link busy), 11=LINK_STATUS, 14/15=not supported.

EXAMPLE: control 0xC4 = 1100 0100 -> DIR=1, PRM=1, FCB=0, FCV=0, FN=4 = a master sending UNCONFIRMED_USER_DATA. Control 0x44 = 0100 0100 -> DIR=0, PRM=1, FCB=0, FCV=0, FN=4 = an outstation sending unsolicited unconfirmed data toward the master.`,
    },
    {
      name: 'destination',
      label: 'Destination address',
      bits: 16,
      endian: 'le',
      decode: (v) => {
        if (v === 0xffff) return '65535 (0xFFFF — all-stations broadcast)';
        if (v >= 0xfff0) return `${v} (0x${v.toString(16)} — reserved broadcast/self range)`;
        return `${v} (station ${v})`;
      },
      note: 'The DNP3 station address of the recipient. Little-endian. 0xFFFF = broadcast.',
      desc: 'The 16-bit DNP3 link address of the destination station, stored little-endian (low byte first). Each DNP3 device on a link has a unique address; the special value 0xFFFF is the all-stations broadcast. Addresses 0xFFF0..0xFFFF are reserved.',
      detail: `DESTINATION ADDRESS (2 bytes, little-endian, IEEE 1815 §9): the link-layer address of the station this frame is for. "The first byte of the address is the low order byte and the second byte is the high order," i.e. little-endian — so wire bytes 0x04 0x00 mean address 4, not 1024. The engine's endian:'le' hook reads the true value.

ADDRESS SPACE: 0x0000..0xFFEF are normal individual station addresses (0..65519). 0xFFF0..0xFFFD are reserved; 0xFFFE is a reserved "self-address" placeholder; 0xFFFF is the all-stations BROADCAST address (a master can address every outstation at once, e.g. a time sync). DNP3 link addresses are separate from any IP address — over TCP/UDP both endpoints still carry their DNP3 station addresses here.`,
    },
    {
      name: 'source',
      label: 'Source address',
      bits: 16,
      endian: 'le',
      decode: (v) => `${v} (station ${v})`,
      note: 'The DNP3 station address of the sender. Little-endian.',
      desc: 'The 16-bit DNP3 link address of the station that sent this frame, stored little-endian (low byte first). It lets the recipient know which station to direct its reply to. Like the destination, it is a DNP3 station number independent of any IP address.',
      detail: `SOURCE ADDRESS (2 bytes, little-endian, IEEE 1815 §9): the link address of the originating station, low byte first (endian:'le'). On a request the master's address appears here; on the response the outstation's address does. There is no broadcast source — a source address always identifies one real station so the recipient can reply.

PAIRING: together (destination, source) name the two endpoints of the link conversation. A receiver also uses the source to maintain per-station link state (the FCB expected next, link reset status), which is why FCB/FCV in the control byte are tracked per source-destination pair.`,
    },
  ],
  // The data-link HEADER block is 8 octets (sync 2 + length 1 + control 1 +
  // dest 2 + source 2) followed by a 2-byte CRC over those 8 octets — 10 bytes
  // total. We treat all 10 as the header so the first block CRC does not leak
  // into the payload as if it were user data. (We don't surface that CRC as a
  // field; it sits at the tail of the header block.)
  headerBytes: (): number => 10,
  // Above the link layer sit the DNP3 transport function and application layer,
  // de-blocked from CRC-interleaved user data — not a fixed bit grid, and the
  // transport/application protocols are not modeled, so dissection stops here.
  // The remaining (still CRC-interleaved) user data falls through as node.payload.
  next: (_h: ParsedHeader): string | null => null,
};
