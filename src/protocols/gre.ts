// GRE — Generic Routing Encapsulation. RFC 2784 (March 2000), updated by
// RFC 2890 (Key and Sequence Number Extensions). GRE is itself carried in IP
// as protocol number 47 (IANA Protocol Numbers registry).
//
// GRE is a tunnelling protocol: it wraps one network-layer packet ("the payload
// packet") inside another so it can ride across an intervening network. The
// Protocol Type field identifies the payload using EtherType values (the same
// 16-bit codes Ethernet uses), so GRE can tunnel IPv4, IPv6, or even whole
// Ethernet frames (Transparent Ethernet Bridging, used by NVGRE/overlays).
//
// THE RFC 2784 HEADER (the mandatory first 4 bytes), bits MSB-first:
//   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//   |C|       Reserved0       | Ver |         Protocol Type         |
//   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//   bit 0      : C  (Checksum Present)
//   bits 1-12  : Reserved0 (must be 0 on transmit per RFC 2784)
//   bits 13-15 : Ver (Version Number — MUST be 0 for RFC 2784 GRE)
//   bits 16-31 : Protocol Type (EtherType of the payload packet)
//
// OPTIONAL FIELDS (OUT OF SCOPE HERE): when C=1, two more 16-bit fields follow —
// Checksum and Reserved1 — making the header 8 bytes. RFC 2890 further adds an
// optional 32-bit Key (when K=1) and 32-bit Sequence Number (when S=1), each
// gated by a bit inside the Reserved0 region. We model ONLY the mandatory
// 4-byte RFC 2784 header and dispatch to the payload when C=0; a frame with the
// optional words would need those extra bytes accounted for (see the note on the
// Checksum-Present field). headerBytes is therefore a constant 4 here.
import type { ProtocolSpec } from '../core/types';

// Protocol Type uses EtherType values (RFC 2784 §2.3, "the protocol type of the
// payload packet ... values defined in [RFC1700] and ... the IEEE EtherType").
const ETHERTYPE: Record<number, string> = {
  0x0800: 'IPv4',
  0x86dd: 'IPv6',
  0x6558: 'Transparent Ethernet Bridging',
};
// Dispatch to the child protocol id by EtherType.
const ETHERTYPE_TO_ID: Record<number, string> = {
  0x0800: 'ipv4',
  0x86dd: 'ipv6',
  0x6558: 'ethernet', // Transparent Ethernet Bridging carries a full Ethernet frame
};

export const gre: ProtocolSpec = {
  id: 'gre',
  name: 'GRE',
  layer: 3,
  summary:
    'A tunnelling protocol carried directly in IP (protocol 47). Its 4-byte header (RFC 2784) just flags an optional checksum, pins the version to 0, and names the encapsulated payload by EtherType — letting it wrap IPv4, IPv6, or a whole Ethernet frame inside another IP packet.',
  fields: [
    {
      name: 'checksumPresent',
      label: 'Checksum Present (C)',
      bits: 1,
      decode: (v) => (v ? '1 — Checksum + Reserved1 words follow (header is 8 bytes)' : '0 — no optional fields'),
      note: 'When 1, a Checksum and Reserved1 word follow the 4-byte base header.',
      desc: 'The single flag bit of RFC 2784 GRE. When set to 1, a 16-bit Checksum and a 16-bit Reserved1 field are present immediately after this base header, extending it from 4 to 8 bytes. When 0, the payload packet begins right after byte 4.',
      detail: `CHECKSUM PRESENT (C), 1 bit — the most-significant bit of the GRE header.

C = 0: the mandatory header is exactly 4 bytes and the payload follows immediately.
C = 1: two extra 16-bit fields follow the base header:
  - Checksum: the IP (one's complement) checksum over the GRE header AND the
    payload packet (RFC 2784 §2.5).
  - Reserved1: present whenever Checksum is present; sent as 0.
This makes the header 8 bytes when C=1.

RFC 2890 EXTENSION: GRE reuses two bits inside the Reserved0 region as flags —
K (Key Present) and S (Sequence Number Present) — each adding a 32-bit word.
NVGRE (RFC 7637) repurposes the Key as a 24-bit Virtual Subnet ID for overlays.

SCOPE OF THIS MODEL: Apex parses only the mandatory 4-byte RFC 2784 header, so
when C=1 the optional words are NOT split out as fields — they would instead
appear at the start of the payload. The byte view still shows them honestly as
raw bytes; we just do not claim field structure we are not decoding.`,
    },
    {
      name: 'reserved0',
      label: 'Reserved0',
      bits: 12,
      type: 'hex',
      note: 'Must be sent as 0 in RFC 2784; later RFCs reuse some of these bits as flags.',
      desc: 'Twelve reserved bits between the Checksum-Present flag and the Version. RFC 2784 requires a sender to set them to 0 and a receiver to ignore bits it does not understand. Extensions (RFC 2890, NVGRE) repurpose specific bits here as the Key/Sequence-present flags.',
      detail: `RESERVED0 (12 bits), immediately after the C bit.

RFC 2784 requires the Reserved0 field (bits 1-12) be sent as 0, and that a
conformant receiver discard packets with any of these bits set unless it also
implements the historical RFC 1701 flag bits.

EXTENSION USE of bits inside the overall flag region (counting from bit 0 = C),
per RFC 2890:
  - bit 0: C (Checksum Present)   — the field above
  - bit 1: Reserved (sent as 0)
  - bit 2: K (Key Present)        — RFC 2890
  - bit 3: S (Sequence Number Present) — RFC 2890
Each of K and S, when set, adds a 32-bit word after this header.
The original RFC 1701 GRE also defined R (Routing) and the Recursion Control
sub-field here; RFC 2784 deprecated those, which is why most of this space is
now simply zero on the wire.`,
    },
    {
      name: 'version',
      label: 'Version (Ver)',
      bits: 3,
      decode: (v) => (v === 0 ? '0 — RFC 2784 GRE' : `${v} (non-zero; 1 = PPTP-style GRE, RFC 2637)`),
      note: 'MUST be 0 for RFC 2784 GRE. Version 1 is the PPTP enhanced GRE (RFC 2637).',
      desc: 'A 3-bit version number. RFC 2784 mandates the value 0 for standard GRE. Version 1 designates the "Enhanced GRE" used by PPTP (RFC 2637), which has a different optional-field layout.',
      detail: `VERSION (3 bits): "The Version Number field MUST contain the value zero."
(RFC 2784 §2.4).

VERSION 0: standard GRE as described here — Protocol Type names the payload, and
the only base flag is Checksum Present.

VERSION 1: "Enhanced GRE" defined by PPTP (RFC 2637). It overloads the header
with an Acknowledgement bit, a mandatory Key (used as a Call ID), and a
Sequence Number, and is specific to the Point-to-Point Tunnelling Protocol —
not interoperable with the version-0 format above.`,
    },
    {
      name: 'protocolType',
      label: 'Protocol Type',
      bits: 16,
      type: 'enum',
      enumMap: ETHERTYPE,
      note: 'EtherType of the encapsulated payload — selects the next layer.',
      desc: 'The EtherType of the payload packet, using the same 16-bit codes as Ethernet. This is how GRE tells the far end what it tunnelled: 0x0800 = IPv4, 0x86DD = IPv6, 0x6558 = Transparent Ethernet Bridging (a full Ethernet frame).',
      detail: `PROTOCOL TYPE (16 bits, EtherType values — RFC 2784 §2.3):
  0x0800 = IPv4
  0x86DD = IPv6
  0x6558 = Transparent Ethernet Bridging (TEB) — the payload is an entire
           Ethernet frame; this is what NVGRE and bridged GRE overlays use to
           carry layer-2 traffic over an IP core.
  0x880B = PPP (used by PPTP, version-1 GRE)
  0x22EB = ERSPAN (mirrored switch traffic)

WHY ETHERTYPE: reusing the IEEE EtherType registry means GRE inherits a ready
namespace for "what protocol is inside" without inventing its own, and the same
0x0800/0x86DD constants you already know from Ethernet apply unchanged.

DISPATCH: Apex maps 0x0800 -> ipv4 and 0x86DD -> ipv6 to continue dissecting the
tunnelled packet; 0x6558 would hand off to an inner Ethernet frame.`,
    },
  ],
  // Mandatory RFC 2784 header is 4 bytes. (When C=1 the real header is 8 bytes;
  // see the Checksum-Present field note — the optional words are out of scope and
  // would fall through into the payload here.)
  headerBytes: () => 4,
  // Dispatch to the tunnelled payload by its EtherType.
  next: (h) => ETHERTYPE_TO_ID[h.get('protocolType')] ?? null,
};
