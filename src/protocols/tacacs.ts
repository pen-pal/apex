// TACACS+ (Terminal Access Controller Access-Control System Plus).
// RFC 8907 — "The Terminal Access Controller Access-Control System Plus
// (TACACS+) Protocol" (Internet Standard). Header layout: RFC 8907 §4.1.
//
// TACACS+ runs over TCP, by convention on port 49 (assigned by IANA). It is
// Cisco's AAA protocol and, unlike RADIUS, it separates Authentication,
// Authorization, and Accounting into independent request/reply exchanges and
// encrypts (obfuscates) the ENTIRE packet body, not just selected attributes.
//
// This spec models the fixed 12-byte common header (RFC 8907 §4.1). Everything
// after it is the BODY, whose layout depends on the packet type
// (authentication §5.1, authorization §6.1, accounting §7.1). In production the
// body is OBFUSCATED (RFC 8907 §4.5): it is XORed with a pseudo-pad derived from
// MD5(session_id, shared_key, version, seq_no, ...). Recovering the cleartext
// needs the pre-shared key, which is out of scope — so we stop at the header and
// leave the body as opaque payload, exactly as a key-less observer sees it.
import type { ProtocolSpec } from '../core/types';

// RFC 8907 §4.1 — packet types carried in the 1-byte "type" field.
const PACKET_TYPE: Record<number, string> = {
  1: 'TAC_PLUS_AUTHEN (authentication)',
  2: 'TAC_PLUS_AUTHOR (authorization)',
  3: 'TAC_PLUS_ACCT (accounting)',
};

// RFC 8907 §4.1 — the 8-bit flags field. flagBits[0] is the most-significant
// bit (0x80); only two bits are defined by the protocol:
//   bit 0x01 (index 7, LSB) = TAC_PLUS_UNENCRYPTED_FLAG
//   bit 0x04 (index 5)      = TAC_PLUS_SINGLE_CONNECT_FLAG
const FLAG_BITS = [
  '-', // 0x80
  '-', // 0x40
  '-', // 0x20
  '-', // 0x10
  '-', // 0x08
  'SINGLE_CONNECT', // 0x04
  '-', // 0x02
  'UNENCRYPTED', // 0x01
];

export const tacacs: ProtocolSpec = {
  id: 'tacacs',
  name: 'TACACS+',
  layer: 7,
  summary: "Cisco's AAA protocol over TCP 49: a 12-byte common header (version, type, seq_no, flags, session_id, length) in front of an obfuscated Authentication/Authorization/Accounting body.",
  fields: [
    {
      name: 'version',
      label: 'Version',
      bits: 8,
      type: 'hex',
      decode: (v) => `major ${(v >> 4) & 0xf} (0x${((v >> 4) & 0xf).toString(16)}), minor ${v & 0xf}`,
      note: 'High nibble = major version (always 0xc); low nibble = minor version (0x0, or 0x1 for some auth types).',
      desc: 'A single byte split into two nibbles: the high nibble is the major version (TAC_PLUS_MAJOR_VER, always 0xc) and the low nibble is the minor version. 0xc0 is the default; 0xc1 marks the few authentication exchanges that need a revised minor version (e.g. PAP/CHAP login).',
      detail: `VERSION (1 byte = two 4-bit nibbles, RFC 8907 §4.1):
- High nibble — major version (TAC_PLUS_MAJOR_VER): fixed at 0xc. There has only ever been one TACACS+ major version; any other value means this is not TACACS+ (or is the obsolete legacy TACACS/XTACACS, which used different major numbers).
- Low nibble — minor version (TAC_PLUS_MINOR_VER):
  - 0x0 (TAC_PLUS_MINOR_VER_DEFAULT) — the default for almost all exchanges.
  - 0x1 (TAC_PLUS_MINOR_VER_ONE) — used for specific authentication actions where the body format changed, notably inbound ASCII login plus the PAP, CHAP, and MS-CHAP login flows (RFC 8907 §5.1, §5.4.2).

So the common combined values you see on the wire are 0xc0 and 0xc1. The minor version lets the two ends agree on the BODY format without changing the header.`,
    },
    {
      name: 'type',
      label: 'Type',
      bits: 8,
      type: 'enum',
      enumMap: PACKET_TYPE,
      note: '1 = authentication, 2 = authorization, 3 = accounting. This selects which body parser applies.',
      desc: 'Which of the three AAA functions this packet belongs to: authentication (1, proving who you are), authorization (2, what you are allowed to do), or accounting (3, recording what you did). Unlike RADIUS, TACACS+ keeps these three as separate exchanges, and this byte tells the receiver which body layout to expect.',
      detail: `TYPE (1 byte, RFC 8907 §4.1):
- 0x01 TAC_PLUS_AUTHEN — Authentication. Proves an identity (login). Body layouts: START (§5.1), REPLY (§5.2), CONTINUE (§5.3).
- 0x02 TAC_PLUS_AUTHOR — Authorization. Asks "is this user permitted to run this command / open this service?" Body: REQUEST (§6.1), RESPONSE (§6.2).
- 0x03 TAC_PLUS_ACCT — Accounting. Records that an action started, is in progress (watchdog), or stopped. Body: REQUEST (§7.1), REPLY (§7.2).

THE BIG DIFFERENCE FROM RADIUS: RADIUS fuses authentication and authorization into one Access-Request/Access-Accept exchange. TACACS+ deliberately splits all three (the second "A" of AAA is a first-class, separate transaction). That is why a single device administration session can show multiple TACACS+ exchanges of different types over the same TCP connection (see the SINGLE_CONNECT flag).`,
    },
    {
      name: 'seqNo',
      label: 'Sequence no.',
      bits: 8,
      note: 'Per-session packet counter. The client sends odd numbers (1,3,5...), the server even (2,4,6...). Starts at 1; the session ends if it would exceed 255.',
      desc: 'A 1-based sequence number scoped to this session. The very first packet of a session is 1; each side increments by one for its next packet. The client always uses odd sequence numbers and the server always uses even ones, so the parity of this byte tells you who sent the packet.',
      detail: `SEQ_NO (1 byte, RFC 8907 §4.1):
- The first packet in a session MUST have seq_no = 1. Each subsequent packet increments it by exactly 1.
- The client (the device asking, e.g. a router) sends ODD seq_no values (1, 3, 5, ...). The server (the TACACS+ daemon) sends EVEN values (2, 4, 6, ...). A mismatch is a protocol error.
- seq_no is also folded into the obfuscation pad (it is one of the MD5 inputs), so every packet in a session uses a DIFFERENT pad — replaying or reordering changes the keystream.
- If seq_no would wrap past 255 (its maximum in one byte), the session MUST be aborted and a new session started. This caps any single session at 255 packets and forces fresh session state.`,
    },
    {
      name: 'flags',
      label: 'Flags',
      bits: 8,
      type: 'flags',
      flagBits: FLAG_BITS,
      note: '0x01 UNENCRYPTED (body is cleartext — banned in production); 0x04 SINGLE_CONNECT (multiplex sessions on one TCP connection).',
      desc: 'A bitmask controlling how the connection behaves. Two bits are defined: UNENCRYPTED (0x01) says the body was NOT obfuscated and is plain text, and SINGLE_CONNECT (0x04) tells the peer that multiple independent sessions may be multiplexed over this one TCP connection.',
      detail: `FLAGS (1 byte, RFC 8907 §4.1) — only two bits are defined (others MUST be 0):
- 0x01 TAC_PLUS_UNENCRYPTED_FLAG: when SET, the body is NOT obfuscated — it is cleartext on the wire. RFC 8907 §4.5 / §10.5.1 is blunt: this "MUST NOT be used in production"; it exists only for debugging or when an underlying secure transport (e.g. TLS via RFC 9105) already protects the channel. When CLEAR (the normal case), the body is XOR-obfuscated with the MD5-derived pad.
- 0x04 TAC_PLUS_SINGLE_CONNECT_FLAG: set in the FIRST two packets of a connection to negotiate "single connect mode" — the ability to multiplex several distinct TACACS+ sessions (different session_id values) over one long-lived TCP connection, instead of opening a fresh TCP connection per session. Both sides must agree; if the server clears it in its reply, the client closes the connection after the current session.

WHY "obfuscation", not "encryption": the body protection is a home-grown MD5/XOR stream, not a modern cipher. It provides confidentiality only as strong as MD5 and the shared key, offers no integrity guarantee, and is why RFC 9105 layers TACACS+ over TLS 1.3. Hence this implementation treats a normal (UNENCRYPTED clear) body as opaque ciphertext.`,
    },
    {
      name: 'sessionId',
      label: 'Session ID',
      bits: 32,
      type: 'hex',
      note: 'A random 32-bit ID tying together all packets of one AAA session; also an input to the obfuscation pad.',
      desc: 'A cryptographically random 32-bit identifier chosen by the client at the start of a session. Every packet belonging to the same Authentication, Authorization, or Accounting exchange carries this value, letting both ends correlate request and reply — and letting several sessions share one TCP connection in single-connect mode.',
      detail: `SESSION_ID (4 bytes, big-endian, RFC 8907 §4.1):
- Chosen by the client at session start and MUST be cryptographically random (RFC 8907 §10.5.2) — predictable session IDs weaken the obfuscation, because session_id is the FIRST input to the MD5 pad: MD5_1 = MD5(session_id || key || version || seq_no), then MD5_n = MD5(session_id || key || version || seq_no || MD5_{n-1}). The concatenated MD5 blocks form the pseudo-pad that is XORed over the body.
- It stays constant for every packet of a single session (the seq_no changes, the session_id does not).
- In single-connect mode, distinct concurrent sessions on the same TCP connection are told apart purely by their session_id.`,
    },
    {
      name: 'length',
      label: 'Length',
      bits: 32,
      note: 'Length of the body in bytes (NOT counting this 12-byte header). The full PDU is 12 + length.',
      desc: 'The size, in bytes, of the body that follows this 12-byte header. It does not include the header itself, so a complete TACACS+ packet on the wire is exactly 12 + length bytes. The receiver reads precisely this many body bytes before expecting the next packet.',
      detail: `LENGTH (4 bytes, big-endian, RFC 8907 §4.1):
- Counts ONLY the body (the type-specific AUTHEN/AUTHOR/ACCT structure), never the 12-byte header. Total packet size = 12 + length.
- This is what lets TACACS+ frame messages over TCP, which is a boundary-less byte stream: the receiver reads 12 header bytes, learns the body length, then reads exactly that many more bytes to complete the packet.
- RFC 8907 §4.1 warns implementations to bound this value (it recommends capping bodies at a sane maximum, commonly 2^16 bytes) and to drop sessions whose declared length is implausibly large, to resist memory-exhaustion attacks from a forged header.
- Because the body is obfuscated, the length is of the CLEARTEXT body; the obfuscation is a byte-for-byte XOR pad, so it does not change the length.`,
    },
  ],
  // Fixed 12-byte common header (RFC 8907 §4.1).
  headerBytes: () => 12,
  // The whole PDU is the 12-byte header plus the declared body length, so a
  // following packet on the same TCP stream (single-connect mode) or any TCP
  // re-segmentation does not leak into this packet's body.
  pduBytes: (h) => 12 + h.get('length'),
  // The body is a TACACS+-internal AUTHEN/AUTHOR/ACCT structure and is normally
  // obfuscated (XOR with an MD5-derived pad keyed by the pre-shared secret).
  // Without the shared key it is opaque, so we stop here and leave it as payload.
  next: () => null,
};
