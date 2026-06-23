// IPsec Authentication Header (AH). RFC 4302 (IP Authentication Header, 2005).
// AH provides connectionless integrity and data-origin authentication for IP
// datagrams, and optional anti-replay protection. It is carried directly in IP
// as protocol number 51 (IANA IP Protocol Numbers).
//
// WIRE FORMAT (RFC 4302 §2) — the fixed 12-byte portion this spec models:
//
//    0                   1                   2                   3
//    0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
//   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//   | Next Header   |  Payload Len  |          RESERVED             |
//   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//   |                 Security Parameters Index (SPI)               |
//   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//   |                    Sequence Number Field                      |
//   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//   |                                                               |
//   +                Integrity Check Value-ICV (variable)           |
//   |                                                               |
//   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//
// The ICV (the authentication tag) is VARIABLE length — it depends on the
// negotiated integrity algorithm (e.g. 96 bits for HMAC-SHA1-96). Its length is
// derived from Payload Len: total AH length in 32-bit words = (PayloadLen + 2),
// so the ICV occupies (PayloadLen + 2) * 4 - 12 bytes. We model the fixed
// 12-byte header here and leave the ICV (and everything after it) as the node
// payload, noting it below. The ICV is a cleartext authentication tag, not
// ciphertext — AH authenticates but does not encrypt (that is ESP, RFC 4303).
//
// NEXT HEADER demultiplexes the protected upper-layer/inner protocol exactly
// like IPv4's Protocol field (IANA IP Protocol Numbers): 4=IPv4 (tunnel mode),
// 6=TCP, 17=UDP, 41=IPv6, 50=ESP.
import type { ProtocolSpec } from '../core/types';

const NEXT_HEADER: Record<number, string> = {
  4: 'IPv4',
  6: 'TCP',
  17: 'UDP',
  41: 'IPv6',
  50: 'ESP',
};

// Next Header -> child protocol id. Mirrors IPv4's protocol dispatch.
const NEXT_TO_ID: Record<number, string> = {
  4: 'ipv4',
  6: 'tcp',
  17: 'udp',
  41: 'ipv6',
};

export const ah: ProtocolSpec = {
  id: 'ah',
  name: 'AH (IPsec)',
  layer: 3,
  summary:
    'IPsec Authentication Header (IP protocol 51): integrity + data-origin authentication (and optional anti-replay) for an IP datagram. It signs the packet but does NOT encrypt it — the upper layer stays in cleartext, with a keyed authentication tag (ICV) appended.',
  fields: [
    {
      name: 'nextHeader',
      label: 'Next Header',
      bits: 8,
      type: 'enum',
      enumMap: NEXT_HEADER,
      note: 'IANA protocol number of the data after AH.',
      desc: 'An 8-bit IANA IP Protocol Number identifying the protocol that follows the ICV — i.e. the protected upper-layer (transport mode) or inner IP packet (tunnel mode). 6=TCP, 17=UDP, 4=IPv4, 41=IPv6.',
      detail: `NEXT HEADER (8 bits, RFC 4302 §2.1): the type of the payload after the AH header, using the same IANA IP Protocol Numbers as IPv4's Protocol field.

TRANSPORT MODE vs TUNNEL MODE:
- Transport mode: AH sits between the original IP header and the upper-layer protocol, so Next Header is the transport protocol (6=TCP, 17=UDP, 1=ICMP).
- Tunnel mode: AH protects an entire inner IP datagram, so Next Header is 4 (IPv4) or 41 (IPv6).

COMMON VALUES:
4=IPv4 | 6=TCP | 17=UDP | 41=IPv6 | 50=ESP | 59=No Next Header

This is exactly the demultiplexing role IPv4's Protocol field plays — it tells the receiver which parser to run once AH has been verified and stripped.`,
    },
    {
      name: 'payloadLen',
      label: 'Payload Length',
      bits: 8,
      decode: (v) => `AH is ${(v + 2) * 4} bytes total (ICV = ${(v + 2) * 4 - 12} bytes)`,
      note: 'AH length in 32-bit words, minus 2.',
      desc: 'The length of the whole AH header in 32-bit (4-byte) words, MINUS 2. Despite the name it is not a payload count: total AH bytes = (PayloadLen + 2) * 4, so the ICV is (PayloadLen + 2)*4 - 12 bytes.',
      detail: `PAYLOAD LENGTH (8 bits, RFC 4302 §2.2): "specifies the length of AH in 32-bit words (4-byte units), minus 2."

WHY "MINUS 2": the field follows the IPv6 extension-header convention where a length of 0 would describe a 2-word (8-byte) header. AH's three fixed 32-bit words (Next Header+PayloadLen+Reserved, SPI, Sequence Number) = 3 words; the "minus 2" offset means those three words plus the ICV are counted, then 2 is subtracted.

COMPUTING THE ICV LENGTH:
  total AH bytes = (PayloadLen + 2) * 4
  ICV bytes      = total - 12   (the 12 fixed header bytes)

WORKED EXAMPLE — HMAC-SHA1-96 (a 96-bit / 12-byte ICV):
  3 fixed words + 3 ICV words = 6 words; PayloadLen = 6 - 2 = 4.
  total = (4 + 2) * 4 = 24 bytes; ICV = 24 - 12 = 12 bytes. ✓

The ICV is padded as needed to keep AH 32-bit aligned for IPv4 and 64-bit aligned for IPv6, so PayloadLen also accounts for any explicit ICV padding.`,
    },
    {
      name: 'reserved',
      label: 'Reserved',
      bits: 16,
      type: 'hex',
      note: 'MUST be zero on send; ignored on receive.',
      desc: 'A 16-bit reserved field. The sender MUST set it to zero; the receiver SHOULD ignore it (but it is still included in the ICV computation as transmitted).',
      detail: `RESERVED (16 bits, RFC 4302 §2.3): "reserved for future use. It MUST be set to 'zero' by the sender, and it SHOULD be ignored by the recipient."

ICV COVERAGE: although ignored on receipt, the field's transmitted value (zero) IS part of the integrity check — the ICV is computed over the AH header (with the ICV field itself zeroed), so a non-zero Reserved would change the computed tag.`,
    },
    {
      name: 'spi',
      label: 'SPI',
      bits: 32,
      type: 'hex',
      note: 'Identifies the Security Association; 0 and 1-255 are reserved.',
      desc: 'Security Parameters Index: a 32-bit value that, together with the destination IP and the protocol (AH), names the Security Association (SA) — the agreed keys and integrity algorithm — the receiver must use to verify this packet.',
      detail: `SPI (32 bits, RFC 4302 §2.4): an arbitrary value that the receiver uses, with the destination address and the security protocol (AH), to look up the Security Association for this datagram.

RESERVED VALUES:
- 0: "reserved for local, implementation-specific use and MUST NOT be sent on the wire."
- 1-255: reserved by IANA for future use.
- 256 and above: the usable range, normally chosen randomly by the receiver when the SA is established (e.g. by IKE).

DIRECTIONALITY: an SA is unidirectional, so a bidirectional IPsec session uses (at least) two SAs/SPIs, one per direction. The SPI is picked by the RECEIVER and advertised during key exchange, so the sender stamps the receiver's chosen SPI into each packet.`,
    },
    {
      name: 'sequenceNumber',
      label: 'Sequence Number',
      bits: 32,
      note: 'Monotonic per-SA counter for anti-replay.',
      desc: 'A monotonically increasing per-SA counter, starting at 1 for the first packet on an SA. It lets the receiver detect and reject replayed packets via a sliding window.',
      detail: `SEQUENCE NUMBER (32 bits, RFC 4302 §2.5): an unsigned counter the sender increments by 1 for every packet sent on a given SA. The first packet has sequence number 1.

ANTI-REPLAY: the receiver maintains a sliding window (default ≥ 32, recommended 64). A packet whose sequence number is below the window, or already seen within it, is discarded — defeating capture-and-resend attacks. Anti-replay is mandatory for the sender to support but the receiver may disable checking (e.g. for manually-keyed SAs).

NO WRAP WITHOUT REKEY: when the counter would wrap past 2^32 - 1, the SA must be torn down and renegotiated (a new SA with fresh keys) to avoid two packets sharing a sequence number under the same key.

EXTENDED SEQUENCE NUMBERS (ESN): an SA may negotiate a 64-bit counter; only the low-order 32 bits are transmitted in this field, while the high-order 32 bits are maintained at both ends and folded into the ICV computation. This field's wire width is always 32 bits.`,
    },
  ],
  // Fixed 12-byte AH header (3 x 32-bit words). The variable-length ICV that
  // follows is left in node.payload because its length is algorithm-dependent
  // and not self-describing within these 12 bytes. PayloadLen does encode the
  // total length: (payloadLen + 2) * 4 bytes of AH, of which the ICV is the part
  // after byte 12. We deliberately do NOT advance the header past the ICV here —
  // the ICV is shown as the leading payload bytes, after which the protected
  // upper-layer/inner protocol begins. (To dissect the inner protocol, a caller
  // would need to skip the ICV using PayloadLen.)
  headerBytes: () => 12,
  // Dispatch on Next Header, exactly like IPv4's Protocol field. ESP (50) has no
  // generic dissector here yet, so it returns null and dissection stops; 4/6/17/41
  // map to the registered child specs.
  next: (h) => NEXT_TO_ID[h.get('nextHeader')] ?? null,
};
