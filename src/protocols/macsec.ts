// MACsec — Media Access Control Security. IEEE Std 802.1AE (the SecTAG and ICV
// are defined in clause 9; this model follows IEEE 802.1AE-2018). MACsec is a
// HOP-BY-HOP Layer-2 security protocol: each link encrypts and/or
// integrity-protects Ethernet frames independently, so a frame is decrypted and
// re-encrypted at every MACsec-capable bridge (unlike end-to-end IPsec/TLS).
//
// WHERE THIS LAYER SITS
// ---------------------
// MACsec inserts a Security TAG (SecTAG) into an Ethernet II frame right where
// the EtherType normally goes — immediately after the Source MAC. A NIC reads
// the MACsec EtherType 0x88E5 there to recognise a MACsec frame, so in Apex's
// encapsulation that 0x88E5 has ALREADY been consumed as the Ethernet EtherType
// (exactly as the 0x8100 TPID is for an 802.1Q tag). This spec therefore models
// the SecTAG PROPER, which begins at the TCI/AN octet:
//
//   MACsec EtherType  16b  0x88E5   <- read as the Ethernet EtherType (NOT here)
//   --- SecTAG proper (this spec) ---
//   TCI/AN             8b   V ES SC SCB E C | AN(2b)
//   SL (Short Length)  8b   2 reserved bits + 6-bit short length
//   Packet Number     32b   per-SA anti-replay counter (also the IV)
//   [ SCI ]           64b   OPTIONAL — present iff the SC bit (TCI 0x20) is set:
//                           48-bit transmitter MAC + 16-bit Port Identifier
//
// SecTAG length: 6 octets without SCI, 14 octets with SCI (IEEE 802.1AE-2018,
// 9.5: SECTAG_LEN_WITHOUT_SC / SECTAG_LEN_WITH_SC).
//
// AFTER THE SECTAG: the Secure Data (the user data, which is ENCRYPTED when the
// TCI E bit is set) and then a 16-octet Integrity Check Value (ICV) TRAILER over
// the whole Secure Frame (IEEE 802.1AE-2018, 9.8 / 14.6, GCM-AES gives a 16-octet
// ICV). Because the Secure Data is opaque without the SAK (Secure Association
// Key) — which is never on the wire — this dissector does NOT decrypt it or
// invent an inner protocol: next() returns null (honoring the project's
// "encryption is opaque" creed).
//
// ABOUT THE 16-OCTET ICV TRAILER: the ICV sits at the very END of the frame and
// authenticates the whole Secure Frame. It is carved off cleanly via the generic
// engine hook `trailerBytes` (reserve N bytes from the end of a PDU, independent
// of any length field) — so node.payload is just the encrypted Secure Data and
// node.trailer is the 16-byte ICV. No MACsec-specific logic lives in src/core/;
// the same hook also serves FCoE's EOF and Ethernet's FCS.
//
// TCI/AN bit layout (octet 1 of the SecTAG, MSB-first) — masks per the IEEE
// 802.1AE clause-9 SecTAG figure (also packet-macsec.c in Wireshark):
//   0x80 V   — Version (MUST be 0)
//   0x40 ES  — End Station
//   0x20 SC  — SCI present (when set, the 8-octet SCI follows)
//   0x10 SCB — Single Copy Broadcast (EPON)
//   0x08 E   — Encryption (Secure Data is encrypted)
//   0x04 C   — Changed Text (Secure Data differs from the user data)
//   0x03 AN  — Association Number (2 bits): which SA (0..3) within the SC
import type { ProtocolSpec, ParsedHeader } from '../core/types';

export const macsec: ProtocolSpec = {
  id: 'macsec',
  name: 'MACsec (802.1AE)',
  layer: 2,
  summary:
    'IEEE 802.1AE hop-by-hop Layer-2 security. A SecTAG (read via EtherType 0x88E5) carries the TCI flags, the Association Number, and a Packet Number used both as the anti-replay counter and the cipher IV; an optional Secure Channel Identifier names the channel. The user data that follows is encrypted (E bit) and a 16-byte ICV trailer authenticates the whole frame — opaque without the Secure Association Key.',
  fields: [
    {
      name: 'tci',
      label: 'TCI flags',
      bits: 6,
      type: 'flags',
      // flagBits[0] = most-significant bit of the field. This field is the top
      // 6 bits of the TCI/AN octet; the low 2 bits are the AN field below.
      flagBits: ['V', 'ES', 'SC', 'SCB', 'E', 'C'],
      note: 'Tag Control Information (top 6 bits of octet 1). SC=1 means an 8-byte SCI follows; E=1 means the user data is encrypted.',
      desc: 'The six Tag Control Information flags in the most-significant bits of the SecTAG\'s first octet. They state the protocol version, whether the optional SCI is present, and whether/how the user data is protected (encrypted and/or its text changed).',
      detail: `TCI FLAGS (6 bits, MSB-first within octet 1 of the SecTAG):
0x80 V   = Version. MUST be 0 in IEEE 802.1AE; a non-zero value is invalid.
0x40 ES  = End Station. Set when the frame is sourced/sunk by an end station and
           the SCI's MAC is therefore the station's own Source MAC. ES and SC
           are mutually exclusive (if SC=1, an explicit SCI is carried instead).
0x20 SC  = Secure Channel present. When 1, the 8-octet SCI is explicitly encoded
           in the SecTAG (header grows from 6 to 14 bytes). When 0, the receiver
           derives the SCI implicitly (e.g. Source MAC + a default Port Id 0x0001,
           or, with ES/SCB, a well-known value).
0x10 SCB = Single Copy Broadcast. Used with EPON to indicate the frame used the
           Single-Copy-Broadcast capability; ES/SCB encode an implicit SCI.
0x08 E   = Encryption. 1 = the Secure Data is encrypted (confidentiality on).
0x04 C   = Changed Text. 1 = the Secure Data is not bit-for-bit the user data
           (i.e. it was encrypted or otherwise transformed). The pair (E,C):
             E=0,C=0 -> integrity only, data in the clear (authenticated)
             E=1,C=1 -> confidentiality + integrity (the usual case)
             E=1,C=0 and E=0,C=1 are invalid/reserved per 802.1AE Table 9-1.

WHY THE IV MATTERS HERE: with the default GCM-AES cipher suite, the SC/ES/SCB
bits determine how the receiver reconstructs the SCI, which together with the
Packet Number forms the 96-bit GCM nonce (IV). Get the SCI derivation wrong and
the ICV check fails.`,
    },
    {
      name: 'an',
      label: 'Association Number (AN)',
      bits: 2,
      note: 'Which Secure Association (0-3) within the Secure Channel protects this frame — selects the SAK currently in use.',
      desc: 'The 2-bit Association Number in the low bits of octet 1. A Secure Channel holds up to four Secure Associations (each with its own key); the AN names the one in force, letting a key roll over to a fresh SA without dropping frames.',
      detail: `ASSOCIATION NUMBER (2 bits, the low 2 bits of the TCI/AN octet, mask 0x03):
Range 0-3. Within one Secure Channel (named by the SCI) there can be up to four
Secure Associations (SAs) at once; each SA has a distinct Secure Association Key
(SAK) and its own Packet Number space.

KEY ROLLOVER: MKA (the MACsec Key Agreement protocol, IEEE 802.1X-2010) installs
a new SAK under a new AN while the old one is still receiving, then switches the
transmit AN. Because the AN travels in every frame, the receiver always knows
which of its installed keys to use, so rekeying is hitless.

The (SCI, AN) pair uniquely identifies the SA; together with the Packet Number it
makes each frame's GCM nonce unique, which is mandatory for GCM security.`,
    },
    {
      name: 'reservedSL',
      label: 'SL reserved',
      bits: 2,
      type: 'hex',
      note: 'Top 2 bits of the SL octet — reserved, transmitted as 0.',
      desc: 'The two most-significant bits of the Short Length octet are reserved by IEEE 802.1AE and sent as zero; only the low 6 bits carry a length.',
    },
    {
      name: 'sl',
      label: 'Short Length (SL)',
      bits: 6,
      note: 'Octets of user data when a frame is short (1-47); 0 means the frame is 48 bytes or longer and the real length is taken from the frame itself.',
      desc: 'Short Length: the number of octets of Secure Data when that data is shorter than 48 bytes. It exists because Ethernet pads small frames to a 64-byte minimum, so the receiver needs to know how much of the (possibly padded) Secure Data is genuine before the ICV.',
      detail: `SHORT LENGTH (SL, 6 bits, low bits of octet 2, mask 0x3F; the upper 2 bits are
reserved/0):
- SL = 1..47: the User Data (Secure Data minus any pad) is exactly SL octets.
  Used only when the protected data is shorter than 48 octets, because Ethernet's
  64-octet minimum frame size would otherwise pad it and the receiver could not
  tell padding from data ahead of the ICV.
- SL = 0: the Secure Data is 48 octets or more; its length is determined from the
  overall frame length (no short-length disambiguation needed).

This is purely a length hint for locating the ICV trailer; it does not change the
field layout of the SecTAG.`,
    },
    {
      name: 'pn',
      label: 'Packet Number (PN)',
      bits: 32,
      note: 'Per-SA monotonically increasing counter. Doubles as anti-replay sequence number AND the low 32 bits of the GCM IV. When it nears 2^32-1 the SAK must be rekeyed.',
      desc: 'A 32-bit per-Secure-Association counter that increments for every protected frame. It serves two jobs: the receiver\'s replay window rejects old/duplicate PNs, and the same value forms part of the GCM-AES nonce, so a unique PN guarantees a unique IV per key.',
      detail: `PACKET NUMBER (PN, 32 bits, big-endian / network order):
RFC-equivalent role to a sequence number, but in IEEE 802.1AE it is dual-purpose:

1. ANTI-REPLAY: each SA starts its PN at 1. The receiver maintains a replay
   window (replayWindow); a frame whose PN is below the window's lower edge is
   discarded as a replay. With replay protection strict, frames must arrive in
   order.

2. INITIALIZATION VECTOR: for the default GCM-AES cipher suite the 96-bit nonce
   is SCI (64 bits) || PN (32 bits). GCM is catastrophically broken if a nonce is
   ever reused under the same key, so the PN MUST NOT repeat for a given SAK.

REKEY: because the PN is only 32 bits, an SA can protect at most ~4.29 billion
frames. As the PN approaches 0xFFFFFFFF, MKA installs a fresh SAK under a new AN
and resets the PN to 1. (IEEE 802.1AEbw adds an optional 64-bit Extended Packet
Number — XPN — to push this limit out for high-speed links.)`,
    },
    {
      name: 'sci',
      label: 'Secure Channel Identifier (SCI)',
      bits: 64,
      // 64 bits > 48, so the engine reads this into ParsedField.bytes and formats
      // it as a byte run (type 'bytes' -> space-separated hex), which keeps the
      // full 8-octet SCI intact (a numeric 'hex' would lose precision past 48 bits).
      type: 'bytes',
      note: 'OPTIONAL — present only when the SC bit is set. 48-bit transmitter MAC + 16-bit Port Identifier; names the Secure Channel (and seeds the GCM IV).',
      desc: 'The 8-byte Secure Channel Identifier, carried only when the TCI SC bit is set. It is the transmitter\'s 48-bit MAC address followed by a 16-bit Port Identifier, and it globally names the Secure Channel this frame belongs to.',
      detail: `SECURE CHANNEL IDENTIFIER (SCI, 64 bits) — CONDITIONAL: present in the SecTAG
ONLY when the TCI SC bit (0x20) is set. Structure:
  - bits 0-47 : the transmitting station's 48-bit MAC address (Source Address),
  - bits 48-63: a 16-bit Port Identifier (a Common Port number, >= 1), which lets
                one MAC host several Secure Channels.

WHEN OMITTED (SC=0): the SecTAG is 6 bytes and the receiver derives the SCI
implicitly — typically the frame's Source MAC with a default Port Identifier of
0x0001, or a well-known value when ES/SCB are set (point-to-point / EPON cases).
Carrying the SCI explicitly costs 8 bytes but is required when a station runs
multiple channels or when the implicit derivation is ambiguous.

ROLE IN CRYPTO: the SCI is the high 64 bits of the GCM-AES nonce (SCI || PN), so
both ends must agree on it exactly — an implicit-SCI mismatch shows up as an ICV
failure, not a parse error.`,
    },
  ],
  // SecTAG length depends on the SC bit: 6 bytes (TCI/AN + SL + PN) without the
  // SCI, 14 bytes with it. The engine reads the parsed TCI flags via this generic
  // conditional hook — no MACsec-specific logic lives in core. headerBytes covers
  // ONLY the SecTAG; the Secure Data is payload and the ICV is the trailer below.
  // (IEEE 802.1AE-2018, 9.5: SECTAG_LEN_WITHOUT_SC=6, SECTAG_LEN_WITH_SC=14.)
  headerBytes: (h: ParsedHeader) => (scPresent(h) ? 14 : 6),
  // The 16-octet ICV (IEEE 802.1AE 14.6) is end-anchored: reserve it as a trailer
  // so node.payload is just the (opaque) Secure Data and node.trailer is the ICV.
  trailerBytes: () => 16,
  // The Secure Data is encrypted/opaque (no SAK on the wire) and the true inner
  // EtherType lives inside that ciphertext, so we never invent an inner protocol.
  next: () => null,
};

function scPresent(h: ParsedHeader): boolean {
  // SC is the 3rd most-significant TCI flag (mask 0x20). The 6-bit `tci` field is
  // [V ES SC SCB E C] MSB-first, so SC is bit index 2 from the MSB: value & 0b001000.
  return (h.get('tci') & 0b001000) !== 0;
}
