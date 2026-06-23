// SMB2 / SMB3 Packet Header (SYNC), 64 bytes. [MS-SMB2] section 2.2.1.2
// "SMB2 Packet Header - SYNC" (Microsoft Open Specifications, MS-SMB2). SMB2 is
// not an IETF protocol — its authoritative reference is the Microsoft Open
// Specification [MS-SMB2]; command codes and Flags bits below are transcribed
// verbatim from that document (revision current as of 2026). SMB2 runs over
// "Direct TCP" on port 445.
//
// ENDIANNESS
// ----------
// Every other protocol in Apex (Ethernet, IPv4, TCP, …) is BIG-ENDIAN (network
// byte order). SMB2 is the odd one out: per [MS-SMB2], all of its multi-byte
// integer fields are stored LITTLE-ENDIAN on the wire (it is a Microsoft/x86
// protocol). The engine has a generic `endian: 'le'` field hook for exactly this
// — so each multi-byte field below is marked `endian: 'le'` and the engine reads
// its true value directly (StructureSize wire bytes 0x40 0x00 -> 64). The one
// field NOT marked little-endian is ProtocolId: [MS-SMB2] defines it byte-by-byte
// as 0xFE 'S' 'M' 'B', so the plain (big-endian) read 0xFE534D42 is exactly the
// on-wire value.
//
// WHY ONLY THE HEADER
// -------------------
// This spec models the fixed 64-byte SYNC header only. The variable,
// command-specific body that follows (e.g. the SMB2 NEGOTIATE Request structure,
// [MS-SMB2] 2.2.3, with its dialect array and negotiate contexts) is not a
// fixed bit grid, so it cannot be transcribed honestly as Field entries — it
// falls through as node.payload (see the `note` on the header and `next: null`).
// The ASYNC header variant (SMB2_FLAGS_ASYNC_COMMAND set) replaces the
// Reserved+TreeId fields with a single 8-byte AsyncId; this spec models the SYNC
// form, which is what NEGOTIATE / SESSION_SETUP and most client requests use.
//
// OUT OF SCOPE: the 4-byte Direct-TCP / NetBIOS Session Service (NBSS) length
// prefix that precedes the SMB2 header on port 445 ([MS-SMB2] 2.1, RFC 1002) is
// a transport framing word, not part of the SMB2 header — we model from the
// 0xFE 'S' 'M' 'B' marker onward.
import type { ProtocolSpec, ParsedHeader } from '../core/types';

// [MS-SMB2] 2.2.1.2: Command codes.
const COMMAND: Record<number, string> = {
  0: 'NEGOTIATE',
  1: 'SESSION_SETUP',
  2: 'LOGOFF',
  3: 'TREE_CONNECT',
  4: 'TREE_DISCONNECT',
  5: 'CREATE',
  6: 'CLOSE',
  7: 'FLUSH',
  8: 'READ',
  9: 'WRITE',
  10: 'LOCK',
  11: 'IOCTL',
  12: 'CANCEL',
  13: 'ECHO',
  14: 'QUERY_DIRECTORY',
  15: 'CHANGE_NOTIFY',
  16: 'QUERY_INFO',
  17: 'SET_INFO',
  18: 'OPLOCK_BREAK',
};

export const smb2: ProtocolSpec = {
  id: 'smb2',
  name: 'SMB2/3',
  layer: 7,
  summary:
    'The fixed 64-byte SMB2/SMB3 header (SYNC form, [MS-SMB2] 2.2.1.2) that fronts every Server Message Block message over TCP/445: a 0xFE "SMB" marker, the command, credits, flags, and the message/session identifiers. SMB2 stores its multi-byte fields LITTLE-ENDIAN on the wire, read here via the engine\'s endian:\'le\' hook.',
  fields: [
    {
      name: 'protocolId',
      label: 'Protocol ID',
      bits: 32,
      type: 'hex',
      note: '0xFE "SMB" — marks an SMB2/3 message.',
      desc: 'A fixed 4-byte marker, 0xFE followed by the ASCII letters "S", "M", "B" (bytes 0xFE 0x53 0x4D 0x42). It distinguishes SMB2/3 from the legacy SMB1 protocol, whose marker is 0xFF "SMB".',
      detail: `PROTOCOL ID (4 bytes, [MS-SMB2] 2.2.1.2): MUST be 0xFE, 'S', 'M', 'B' (in network/transmission order). As a value this is written 0x424D53FE in little-endian notation, but on the wire — and as Apex reads it big-endian — the bytes are 0xFE 0x53 0x4D 0x42 = 0xFE534D42.

This field is defined byte-by-byte (a magic constant), NOT as a little-endian integer, so unlike every other field in this header the engine's big-endian read (0xFE534D42) is exactly the on-wire value — no byte-swap needed.

SMB1 vs SMB2: SMB1 (CIFS) begins 0xFF 'S' 'M' 'B'; flipping the first byte from 0xFF to 0xFE was the cheap, unambiguous way to mark the redesigned SMB2 wire format introduced with Windows Vista / Server 2008. A receiver dispatches on this first byte before parsing anything else.`,
    },
    {
      name: 'structureSize',
      label: 'Structure size',
      bits: 16,
      endian: 'le',
      note: 'Always 64 — the size of this header. Wire bytes 0x40 0x00 (LE).',
      desc: 'The size of the SMB2 header structure in bytes. Per [MS-SMB2] this MUST be 64. On the wire it is the little-endian 16-bit value 0x0040 (bytes 0x40 0x00).',
      detail: `STRUCTURE SIZE (2 bytes, little-endian, [MS-SMB2] 2.2.1.2): MUST be set to 64, the size in bytes of the SMB2 header.

ENDIANNESS DEMO: the wire bytes are 0x40 0x00; read little-endian (the engine's endian:'le' hook) that is 0x0040 = 64. A naive big-endian reader would instead see 0x4000 = 16384 — the clearest illustration of why SMB2's little-endianness must be handled explicitly.

NOTE: SMB2 structures generally lead with a StructureSize field. In command bodies the value is often the fixed size PLUS ONE (an odd number) to flag the presence of a variable buffer that follows; for the header itself it is exactly 64.`,
    },
    {
      name: 'creditCharge',
      label: 'Credit charge',
      bits: 16,
      endian: 'le',
      decode: (v) => `${v} credit${v === 1 ? '' : 's'}`,
      note: 'Credits this request consumes (0 in SMB 2.0.2).',
      desc: 'The number of "credits" this command consumes. SMB2 credits are a flow-control window: the server grants credits and each request spends CreditCharge of them, bounding how much concurrent/large work a client can have outstanding.',
      detail: `CREDIT CHARGE (2 bytes, little-endian, [MS-SMB2] 2.2.1.2):
- In the SMB 2.0.2 dialect this field MUST be 0 and is ignored on receipt.
- In SMB 2.1 and later it is the number of credits the command consumes. Large-MTU operations (big READ/WRITE/IOCTL) charge more than one credit, computed (per [MS-SMB2] 3.1.5.2) as roughly 1 + (max(SendPayload, Expected) - 1) / 65536.

CREDITS = SMB2's flow control: a request also carries CreditRequest (below) asking for more, and the response carries CreditResponse granting them. The client's running balance limits how many requests — and how much data — it may have in flight, replacing SMB1's single-outstanding-request limit and enabling SMB2's pipelining.`,
    },
    {
      name: 'status',
      label: 'Status / ChannelSequence',
      bits: 32,
      type: 'hex',
      endian: 'le',
      note: 'NTSTATUS in responses; 0 / ChannelSequence in requests.',
      desc: 'A 4-byte field that is interpreted differently by direction and dialect. In a response it is the NTSTATUS result code ([MS-ERREF] 2.3). In a request it is reserved/zero in SMB 2.0.2–2.1, or ChannelSequence (2 bytes) + Reserved (2 bytes) in the SMB 3.x family.',
      detail: `STATUS / (ChannelSequence, Reserved) (4 bytes, little-endian, [MS-SMB2] 2.2.1.2):
- RESPONSE (all dialects): the Status field — an NTSTATUS code. 0x00000000 = STATUS_SUCCESS; e.g. 0xC000006D = STATUS_LOGON_FAILURE, 0xC0000022 = STATUS_ACCESS_DENIED, 0x80000005 = STATUS_BUFFER_OVERFLOW (used benignly during SESSION_SETUP/GSS continuation).
- REQUEST, SMB 2.0.2 / 2.1: the Status field — the client MUST set it to 0 and the server ignores it.
- REQUEST, SMB 3.x: ChannelSequence (2 bytes) followed by Reserved (2 bytes). ChannelSequence lets the server detect stale writes after a channel/connection change (multichannel), guarding against replays of an old write on a new channel.

ENDIANNESS: NTSTATUS values are conventionally written as 32-bit numbers (e.g. 0xC000006D); on the wire they are little-endian, read here with endian:'le' so the displayed value matches the conventional form.`,
    },
    {
      name: 'command',
      label: 'Command',
      bits: 16,
      type: 'enum',
      enumMap: COMMAND,
      endian: 'le',
      note: 'Which SMB2 operation this is (NEGOTIATE, READ, WRITE, …).',
      desc: 'The SMB2 command code identifying the operation: NEGOTIATE (0), SESSION_SETUP (1), TREE_CONNECT (3), CREATE (5), READ (8), WRITE (9), IOCTL (11), and so on ([MS-SMB2] 2.2.1.2). The body that follows the header is the structure for this command.',
      detail: `COMMAND (2 bytes, little-endian, [MS-SMB2] 2.2.1.2). Full set:
0x00 NEGOTIATE        0x01 SESSION_SETUP    0x02 LOGOFF
0x03 TREE_CONNECT     0x04 TREE_DISCONNECT  0x05 CREATE
0x06 CLOSE            0x07 FLUSH            0x08 READ
0x09 WRITE            0x0A LOCK             0x0B IOCTL
0x0C CANCEL           0x0D ECHO            0x0E QUERY_DIRECTORY
0x0F CHANGE_NOTIFY    0x10 QUERY_INFO       0x11 SET_INFO
0x12 OPLOCK_BREAK

TYPICAL SESSION FLOW: NEGOTIATE (agree dialect/capabilities) -> SESSION_SETUP (authenticate, usually NTLM/Kerberos over GSS-API/SPNEGO) -> TREE_CONNECT (mount a share \\\\server\\share) -> CREATE (open a file/pipe) -> READ/WRITE/IOCTL -> CLOSE -> TREE_DISCONNECT -> LOGOFF.

ENDIANNESS: the value 0 (NEGOTIATE) is endianness-symmetric, but larger codes are not — wire bytes 0x05 0x00 (CREATE) are read little-endian as 5 (a naive big-endian read would give 0x0500 = 1280).`,
    },
    {
      name: 'creditRequest',
      label: 'Credit request/response',
      bits: 16,
      endian: 'le',
      decode: (v) => `${v} credit${v === 1 ? '' : 's'}`,
      note: 'Credits requested (request) or granted (response).',
      desc: 'In a request, the number of credits the client is asking the server to grant; in a response, the number of credits the server is granting. Paired with CreditCharge it implements SMB2 credit-based flow control.',
      detail: `CREDIT REQUEST / CREDIT RESPONSE (2 bytes, little-endian, [MS-SMB2] 2.2.1.2):
- REQUEST: how many credits the client requests be added to its balance.
- RESPONSE: how many credits the server actually grants.

A client typically requests at least as many credits as the CreditCharge it spent, so its window does not shrink; servers grant more to allow deeper pipelining. Running out of credits stalls the client until the server grants more — the SMB2 analogue of a TCP zero-window.

ENDIANNESS: wire bytes 0x01 0x00 (request 1 credit) are read little-endian as 1 (a naive big-endian read would give 0x0100 = 256).`,
    },
    {
      name: 'flags',
      label: 'Flags',
      bits: 32,
      type: 'flags',
      endian: 'le',
      // flagBits is MSB-first over the little-endian value: index i tests bit
      // (31 - i). SERVER_TO_REDIR (0x1) = bit 0 -> index 31, ASYNC (0x2) -> 30,
      // RELATED (0x4) -> 29, SIGNED (0x8) -> 28, PRIORITY (0x70) -> 25..27,
      // DFS (0x10000000) -> bit 28 -> index 3, REPLAY (0x20000000) -> index 2.
      flagBits: [
        '', '', 'REPLAY_OPERATION', 'DFS_OPERATIONS', '', '', '', '', // idx 0..7  (bits 31..24)
        '', '', '', '', '', '', '', '',                              // idx 8..15  (bits 23..16)
        '', '', '', '', '', '', '', '',                              // idx 16..23 (bits 15..8)
        '', 'PRIORITY', 'PRIORITY', 'PRIORITY', 'SIGNED', 'RELATED_OPERATIONS', 'ASYNC_COMMAND', 'SERVER_TO_REDIR', // idx 24..31 (bits 7..0)
      ],
      decode: (v) => {
        const set: string[] = [];
        if (v & 0x00000001) set.push('SERVER_TO_REDIR');
        if (v & 0x00000002) set.push('ASYNC_COMMAND');
        if (v & 0x00000004) set.push('RELATED_OPERATIONS');
        if (v & 0x00000008) set.push('SIGNED');
        const prio = (v & 0x00000070) >> 4;
        if (prio) set.push(`PRIORITY=${prio}`);
        if (v & 0x10000000) set.push('DFS_OPERATIONS');
        if (v & 0x20000000) set.push('REPLAY_OPERATION');
        return (set.length ? set.join(', ') : 'none') + ` (0x${(v >>> 0).toString(16).toUpperCase().padStart(8, '0')})`;
      },
      note: 'SERVER_TO_REDIR (=response), ASYNC, RELATED, SIGNED, priority, DFS, REPLAY.',
      desc: 'A 4-byte bitmask describing how to process the message. The key bit is SERVER_TO_REDIR (0x1): set on responses, clear on requests. Other bits mark async, compounded (RELATED), signed, DFS, and replay operations, plus a 3-bit I/O priority (SMB 3.1.1).',
      detail: `FLAGS (4 bytes, little-endian bitmask, [MS-SMB2] 2.2.1.2):
- 0x00000001 SMB2_FLAGS_SERVER_TO_REDIR — set => this is a RESPONSE (server->client). Clear => request. ("Redir" = the client-side redirector.)
- 0x00000002 SMB2_FLAGS_ASYNC_COMMAND — this is the ASYNC header form (Reserved+TreeId become an 8-byte AsyncId). MUST be clear for the SYNC header this spec models.
- 0x00000004 SMB2_FLAGS_RELATED_OPERATIONS — part of a compounded chain; this message reuses the SessionId/TreeId/FileId of the previous one in the chain (NextCommand links them).
- 0x00000008 SMB2_FLAGS_SIGNED — the 16-byte Signature field is a valid HMAC/CMAC over the message (mandatory for signed sessions; tamper protection).
- 0x00000070 SMB2_FLAGS_PRIORITY_MASK — 3-bit I/O priority 0..7 (SMB 3.1.1 only).
- 0x10000000 SMB2_FLAGS_DFS_OPERATIONS — a Distributed File System operation.
- 0x20000000 SMB2_FLAGS_REPLAY_OPERATION — a replayed command (SMB 3.x, persistent handles).

ENDIANNESS: the 4-byte Flags field is read little-endian (endian:'le'), so the value above is the true 32-bit bitmask; the flagBits grid is laid out MSB-first over that value (SERVER_TO_REDIR = bit 0 = the last cell).`,
    },
    {
      name: 'nextCommand',
      label: 'Next command',
      bits: 32,
      endian: 'le',
      decode: (v) => (v === 0 ? '0 (last/only message in this PDU)' : `offset ${v} bytes to the next compounded header`),
      note: 'Byte offset to the next chained SMB2 header, or 0.',
      desc: 'For a compounded request/response, the offset in bytes from the start of this header to the next 8-byte-aligned SMB2 header in the same TCP payload. 0 means this is the only message, or the last one in the chain.',
      detail: `NEXT COMMAND (4 bytes, little-endian, [MS-SMB2] 2.2.1.2): SMB2 compounding lets several messages share one Direct-TCP PDU. NextCommand is the offset to the next header (8-byte aligned); a chain of CREATE+READ+CLOSE, for example, opens, reads, and closes a file in a single round trip.

RELATED vs UNRELATED chains: with SMB2_FLAGS_RELATED_OPERATIONS set, later messages inherit the SessionId/TreeId/FileId (0xFFFFFFFFFFFFFFFF in the body) of the earlier one — the canonical "open-read-close in one shot" pattern. Without it, each message is independent but still batched for fewer round trips.

This spec models a single header; following compounded headers (if NextCommand != 0) appear within node.payload here.`,
    },
    {
      name: 'messageId',
      label: 'Message ID',
      bits: 64,
      type: 'bytes',
      note: '8-byte little-endian message sequence number.',
      desc: 'An 8-byte value uniquely identifying this message across all messages on the same SMB2 transport connection. The response echoes the request\'s MessageId so the two can be paired (SMB2 has no separate request/response port). Shown as raw bytes (little-endian on the wire).',
      detail: `MESSAGE ID (8 bytes, little-endian, [MS-SMB2] 2.2.1.2): a per-connection sequence number. The first message (NEGOTIATE) uses MessageId 0; it then increments by the CreditCharge of each request, so MessageIds and the credit window stay aligned. 0xFFFFFFFFFFFFFFFF is reserved (used for some unsolicited/oplock-break messages).

WIDTH: 64 bits exceeds the engine's exact numeric range (<= 48 bits), so per the Apex contract this field is modeled as 'bytes' and shown as its 8 raw octets rather than a decimal — the bytes are little-endian, so the least-significant byte is first.`,
    },
    {
      name: 'reserved',
      label: 'Reserved (ProcessId)',
      bits: 32,
      type: 'hex',
      endian: 'le',
      note: 'Reserved; Windows often sets 0x0000FEFF.',
      desc: 'A 4-byte Reserved field that the client SHOULD set to 0 and the server MAY ignore. Historically this carried a ProcessId, and many Windows clients still emit 0x0000FEFF here (the legacy SMB1 "PID high/low" sentinel), which is why captures often show 0xFEFF rather than 0.',
      detail: `RESERVED / ProcessId (4 bytes, little-endian, [MS-SMB2] 2.2.1.2): per the spec the client SHOULD set this to 0 and the server MAY ignore it. In the original SMB2 design it held the client's process id; Windows commonly leaves the value 0x0000FEFF (little-endian wire bytes 0xFF 0xFE 0x00 0x00), a sentinel inherited from SMB1's reserved PID, so do not be surprised to see 0xFEFF on the wire instead of all-zero.

In the ASYNC header form (SMB2_FLAGS_ASYNC_COMMAND set), this 4-byte field together with the following TreeId is reinterpreted as a single 8-byte AsyncId.`,
    },
    {
      name: 'treeId',
      label: 'Tree ID',
      bits: 32,
      type: 'hex',
      endian: 'le',
      note: 'Identifies the connected share; 0 for NEGOTIATE/SESSION_SETUP.',
      desc: 'Identifies the tree connect (the mounted share \\\\server\\share) this command applies to, as returned by a prior TREE_CONNECT response. It MUST be 0 for messages that precede a tree connect: NEGOTIATE, SESSION_SETUP, LOGOFF, ECHO, CANCEL.',
      detail: `TREE ID (4 bytes, little-endian, [MS-SMB2] 2.2.1.2): a handle to a connected share. A client gets a TreeId from a TREE_CONNECT response, then stamps it on every CREATE/READ/WRITE that targets files on that share, and clears it (with TREE_DISCONNECT) when done.

MUST be 0 for NEGOTIATE, SESSION_SETUP, LOGOFF, ECHO, and CANCEL (these are not scoped to a share). In the ASYNC header form this 4-byte field is part of the 8-byte AsyncId instead.`,
    },
    {
      name: 'sessionId',
      label: 'Session ID',
      bits: 64,
      type: 'bytes',
      note: '8-byte session handle; 0 for NEGOTIATE.',
      desc: 'An 8-byte handle identifying the authenticated session this command belongs to, established by SESSION_SETUP. It MUST be 0 for the NEGOTIATE request/response (no session exists yet). Shown as raw little-endian bytes.',
      detail: `SESSION ID (8 bytes, little-endian, [MS-SMB2] 2.2.1.2): returned by the server in the final SESSION_SETUP response and then carried on every subsequent message so the server can locate the user's authenticated session, signing keys, and (in SMB3) encryption keys.

MUST be 0 for the NEGOTIATE request and response, because authentication has not happened yet. WIDTH: 64 bits, so per the Apex contract it is modeled as 'bytes' (8 raw octets, little-endian) rather than a decimal.`,
    },
    {
      name: 'signature',
      label: 'Signature',
      bits: 128,
      type: 'bytes',
      note: '16-byte message signature, or all-zero if unsigned.',
      desc: 'A 16-byte cryptographic signature over the whole message, present only when SMB2_FLAGS_SIGNED is set; otherwise this field MUST be all zero. Signing protects against tampering and message injection on the connection.',
      detail: `SIGNATURE (16 bytes, [MS-SMB2] 2.2.1.2 and 3.1.5.1): when SMB2_FLAGS_SIGNED is set, this is the message's signature computed with the session's signing key:
- SMB 2.x: HMAC-SHA256 (truncated to 16 bytes).
- SMB 3.x: AES-128-CMAC; SMB 3.1.1 may also use AES-128-GMAC.
The signer zeroes this field, computes the MAC over the entire message, then writes the 16-byte result here. A verifier repeats the computation and compares.

WHEN ALL ZERO: if the message is unsigned, the field MUST be 0 — exactly the case in a NEGOTIATE request, which happens before any session key exists. WIDTH: 128 bits (16 bytes), well over the 48-bit numeric limit, so it is modeled as 'bytes' per the Apex contract. Being a raw opaque hash, a byte array is also the only honest representation.`,
    },
  ],
  // The SMB2 header is a fixed 64 bytes (StructureSize). Everything after it is
  // the command-specific body (variable, not a fixed bit grid) and falls through
  // as node.payload — see the top-of-file note.
  headerBytes: (): number => 64,
  // The command body is variable and command-specific; there is no generic child
  // protocol to dissect, so dissection stops at the header. Compounded messages
  // (NextCommand != 0) likewise remain within the payload.
  next: (_h: ParsedHeader): string | null => null,
};
