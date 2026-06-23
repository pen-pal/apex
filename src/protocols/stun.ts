// STUN — Session Traversal Utilities for NAT, fixed 20-byte message header.
// RFC 8489 §5 ("STUN Message Structure"), which obsoletes RFC 5389 (itself a
// revision of the original RFC 3489). STUN lets a host behind a NAT discover the
// public IP:port the NAT maps it to; it is the foundation of ICE connectivity
// checks in WebRTC (RFC 8445) and runs over UDP/TCP/TLS, classically on port 3478
// (TLS 5349). The canonical request is "Binding" — "what does my address look
// like from out there?"
//
// THE HEADER (20 bytes, RFC 8489 §5), big-endian (network order):
//
//    0                   1                   2                   3
//    0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
//   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//   |0 0|     STUN Message Type     |         Message Length        |
//   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//   |                         Magic Cookie                          |
//   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//   |                                                               |
//   |                     Transaction ID (96 bits)                  |
//   |                                                               |
//   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//
// WHAT THIS SPEC MODELS, AND WHAT IT DOES NOT
// -------------------------------------------
// We transcribe the fixed 20-byte header exactly. After it comes a list of
// TLV ATTRIBUTES (RFC 8489 §14): each is a 16-bit Type, a 16-bit Length, and a
// value padded to a 4-byte boundary (e.g. MAPPED-ADDRESS / XOR-MAPPED-ADDRESS,
// USERNAME, MESSAGE-INTEGRITY, FINGERPRINT). Those are variable, optional, and
// order-significant — not a fixed bit grid — so they are NOT modeled as fields:
// `pduBytes` bounds the message at 20 + Message Length so the attributes are the
// node.payload of this layer (and trailing UDP padding/FCS cannot leak in), and
// `next` returns null because the attributes are not a further dissectable
// child protocol.
//
// THE MESSAGE TYPE FIELD is subtle: the leading 2 bits of the message MUST be
// zero, and the remaining 14 bits interleave a 12-bit METHOD with a 2-bit CLASS
// (bits C1 and C0 sit at positions 8 and 4 of the 16-bit word). We read the full
// 16-bit word as `messageType` and decode the well-known combinations; the two
// leading zero bits are simply the top of that word (so a valid STUN message
// always has messageType < 0x4000).
import type { ProtocolSpec, ParsedHeader } from '../core/types';

// RFC 8489 §5 / §18.1: well-known (method, class) combinations as 16-bit values.
// Method "Binding" = 0x001; classes Request=00, Indication=01, Success=10,
// Error=11 are spread across bits 4 (C0) and 8 (C1) of the word.
const MESSAGE_TYPE: Record<number, string> = {
  0x0001: 'Binding Request',
  0x0011: 'Binding Indication',
  0x0101: 'Binding Success Response',
  0x0111: 'Binding Error Response',
};

// Decode the 2-bit class spread across bit 8 (C1) and bit 4 (C0) of the 16-bit
// message-type word: class = (C1 << 1) | C0.
const CLASS_NAME = ['Request', 'Indication', 'Success Response', 'Error Response'];
function decodeMessageType(v: number): string {
  const known = MESSAGE_TYPE[v];
  const c1 = (v >> 8) & 1;
  const c0 = (v >> 4) & 1;
  const cls = (c1 << 1) | c0;
  // Method = the 12 method bits gathered from the word (M11..M0). For the only
  // standardized method, Binding, this is 0x001 regardless of class bits.
  const method = ((v >> 2) & 0xf80) | ((v >> 1) & 0x0070) | (v & 0x000f);
  const methodName = method === 0x001 ? 'Binding' : `method 0x${method.toString(16).toUpperCase()}`;
  const base = `${methodName} ${CLASS_NAME[cls]}`;
  return known ? `${known} (0x${v.toString(16).toUpperCase().padStart(4, '0')})` : `${base} (0x${v.toString(16).toUpperCase().padStart(4, '0')})`;
}

export const stun: ProtocolSpec = {
  id: 'stun',
  name: 'STUN',
  layer: 7,
  summary:
    'Session Traversal Utilities for NAT (RFC 8489): a 20-byte message over UDP/TCP that lets a host behind a NAT learn its public IP:port. A Binding Request asks "what is my address from out there?"; the response carries it in an XOR-MAPPED-ADDRESS attribute. STUN is the backbone of WebRTC/ICE connectivity checks. The TLV attributes after the header are the opaque payload here.',
  fields: [
    {
      name: 'messageType',
      label: 'Message type',
      bits: 16,
      type: 'enum',
      enumMap: MESSAGE_TYPE,
      decode: decodeMessageType,
      note: 'Top 2 bits are zero; the rest encode a 12-bit method + 2-bit class. 0x0001=Binding Request, 0x0101=Binding Success Response, 0x0111=Binding Error Response.',
      desc: 'The 16-bit type word. Its most-significant 2 bits MUST be zero (so a STUN message can be told apart from other protocols on a shared port). The remaining 14 bits interleave a 12-bit METHOD (what operation — only "Binding", 0x001, is standardized) with a 2-bit CLASS (Request / Indication / Success Response / Error Response).',
      detail: `MESSAGE TYPE (16 bits, RFC 8489 §5), big-endian. Bit layout of the word:

  bits:  0  1 | 2  3  4  5  6  7  8  9 10 11 12 13 14 15
         0  0 | M11 M10 M9 M8 M7 C1 M6 M5 M4 C0 M3 M2 M1 M0

- LEADING 2 BITS (bits 0-1): "the most significant 2 bits of every STUN message MUST be zeroes." This lets a demultiplexer on a shared UDP 5-tuple (WebRTC muxes STUN, DTLS, RTP, ...) recognize STUN — its first byte is 0x00-0x3F.
- METHOD (12 bits M11..M0, interleaved): the operation. The only IANA-registered method is Binding = 0x001.
- CLASS (2 bits, C1 at position 8, C0 at position 4): 00=Request, 01=Indication, 10=Success Response, 11=Error Response. class = (C1<<1)|C0.

WELL-KNOWN VALUES (method=Binding):
  0x0001 Binding Request          0x0011 Binding Indication
  0x0101 Binding Success Response 0x0111 Binding Error Response

WHY INTERLEAVED: RFC 5389 carved the class bits out of the middle of the old RFC 3489 16-bit type so that existing method numbers kept their low bits, preserving wire compatibility. The bit-spreading is the price of that backward compatibility.`,
    },
    {
      name: 'messageLength',
      label: 'Message length',
      bits: 16,
      decode: (v) => `${v} bytes of attributes (excludes the 20-byte header)` + (v % 4 === 0 ? '' : ' [INVALID: not a multiple of 4]'),
      note: 'Bytes of attributes AFTER the 20-byte header. Always a multiple of 4 (each attribute is padded to a 4-byte boundary), so the low 2 bits are 0.',
      desc: 'The size in bytes of the message AFTER the 20-byte header — i.e. the total length of the TLV attribute list. It does NOT include the header itself. Because every attribute is padded to a 4-byte boundary, this length is always a multiple of 4, so its low 2 bits are always zero.',
      detail: `MESSAGE LENGTH (16 bits, RFC 8489 §5), big-endian: "MUST contain the size of the message in bytes, not including the 20-byte STUN header." So the whole message on the wire is 20 + MessageLength bytes.

ALWAYS A MULTIPLE OF 4: "Since all STUN attributes are padded to a multiple of 4 bytes, the last 2 bits of this field are always zero." A non-multiple-of-4 value indicates a malformed message.

BOUNDS THE PDU HERE: the dissector uses 20 + MessageLength as pduBytes, so the attribute bytes are exactly the node.payload of this layer and any trailing transport padding (UDP/Ethernet) cannot leak into them.

A bare Binding Request (no attributes) carries MessageLength = 0 — a 20-byte message and nothing else.`,
    },
    {
      name: 'magicCookie',
      label: 'Magic cookie',
      bits: 32,
      type: 'hex',
      decode: (v) => (v === 0x2112a442 ? '0x2112A442 (valid STUN per RFC 5389/8489)' : `0x${(v >>> 0).toString(16).toUpperCase().padStart(8, '0')} (INVALID — expected 0x2112A442)`),
      note: 'Fixed constant 0x2112A442 — marks an RFC 5389/8489 STUN message and seeds the XOR-MAPPED-ADDRESS obfuscation.',
      desc: 'A fixed 32-bit constant, 0x2112A442, in network byte order. It marks the message as modern (RFC 5389/8489) STUN rather than the legacy RFC 3489 format, and its value is also XORed into addresses in XOR-MAPPED-ADDRESS so that NATs which rewrite raw IP addresses inside payloads cannot corrupt them.',
      detail: `MAGIC COOKIE (32 bits, RFC 8489 §5): "The Magic Cookie field MUST contain the fixed value 0x2112A442 in network byte order."

WHY IT EXISTS: in the original RFC 3489 these 4 bytes were the top of a 128-bit transaction ID. RFC 5389 carved them out as a constant so a receiver can detect whether the sender speaks the modern, magic-cookie-aware dialect (with XOR-MAPPED-ADDRESS, FINGERPRINT, etc.).

THE XOR TRICK: some older NATs inspect packet payloads and rewrite any 4 bytes that look like the client's private IP. XOR-MAPPED-ADDRESS obfuscates the reflexive address by XORing it with the magic cookie (and, for the port and IPv6 cases, the transaction ID), so the address no longer appears verbatim in the packet and survives such NATs intact. The cookie is the fixed half of that XOR key.`,
    },
    {
      name: 'transactionId',
      label: 'Transaction ID',
      bits: 96,
      type: 'bytes',
      note: '96-bit (12-byte) random identifier; the response echoes it to match a reply to its request.',
      desc: 'A 96-bit (12-byte) identifier chosen randomly by the client. The server copies it verbatim into its response, so a client can match a reply to the request it sent (STUN has no connection state of its own). It must be cryptographically random to stop an attacker from forging or guessing responses.',
      detail: `TRANSACTION ID (96 bits = 12 bytes, RFC 8489 §5): "used to uniquely identify STUN transactions. For request/response transactions, the transaction ID is chosen by the STUN client for the request and echoed by the server in the response."

WIDTH: 96 bits far exceeds the engine's exact numeric range (<= 48 bits), so per the Apex contract this field is modeled as 'bytes' — shown as its 12 raw octets (big-endian on the wire) rather than a decimal.

RANDOMNESS MATTERS: "MUST be uniformly and randomly chosen ... and SHOULD be cryptographically random." Because UDP is spoofable, the only thing tying a response to a request is this ID plus the 5-tuple; a predictable ID would let an off-path attacker inject forged Binding responses (e.g. lying about the reflexive address to redirect media).

HISTORY: in RFC 3489 the transaction ID was 128 bits; RFC 5389 took the top 32 bits to make room for the Magic Cookie, leaving 96. It also seeds the XOR obfuscation of the port and of IPv6 addresses in XOR-MAPPED-ADDRESS.`,
    },
  ],
  // Fixed 20-byte header.
  headerBytes: (): number => 20,
  // The whole message is the 20-byte header plus MessageLength bytes of TLV
  // attributes, so bound the PDU there — the attributes become node.payload and
  // any trailing transport padding/FCS is kept out.
  pduBytes: (h: ParsedHeader): number => 20 + h.get('messageLength'),
  // The TLV attribute list (XOR-MAPPED-ADDRESS, MESSAGE-INTEGRITY, ...) is not a
  // separately registered child protocol — it is STUN's own variable body — so
  // dissection stops here and the attributes remain in node.payload.
  next: (): string | null => null,
};
