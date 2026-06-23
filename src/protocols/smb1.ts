// SMB1 / CIFS — the SMB Header (fixed 32 bytes). [MS-CIFS] section 2.2.3.1
// "The SMB Header" (Microsoft Open Specifications, MS-CIFS, also published as the
// SNIA CIFS Technical Reference). SMB1 is the original Server Message Block /
// Common Internet File System protocol; it predates and was superseded by SMB2
// ([MS-SMB2]). Command codes, the Flags byte, and the Flags2 word below are
// transcribed verbatim from [MS-CIFS]. SMB1 runs over TCP — historically on the
// NetBIOS Session Service (port 139, [RFC 1001]/[RFC 1002]) and later on
// "direct-hosted" TCP (port 445).
//
// ENDIANNESS
// ----------
// Like SMB2 (and unlike Apex's IETF protocols Ethernet/IPv4/TCP), SMB1 is a
// Microsoft/x86 protocol whose multi-byte integer fields are stored
// LITTLE-ENDIAN on the wire. Each such field below is marked `endian: 'le'` so the
// engine's generic little-endian hook reads its true value directly (e.g. a TID of
// 0x0800 appears on the wire as bytes 0x00 0x08). The two fields NOT marked
// little-endian are:
//   * Protocol[4] — [MS-CIFS] defines it byte-by-byte as 0xFF 'S' 'M' 'B', so the
//     plain big-endian read 0xFF534D42 is exactly the on-wire value (no swap).
//   * SecurityFeatures[8] — an opaque 8-byte field (a signature, or a
//     Key/CID/SequenceNumber triple over connectionless transport), modeled as
//     raw bytes; byte order is interpretation-dependent and not a single integer.
//
// WHY ONLY THE HEADER
// -------------------
// This spec models the fixed 32-byte SMB header only. What follows is the
// command-specific message body: a 1-byte WordCount, that many 2-byte parameter
// words, a 2-byte ByteCount, and ByteCount bytes of data ([MS-CIFS] 2.2.3.2/3).
// That body is variable and command-specific (and for AndX commands can chain
// further blocks), so it cannot be transcribed honestly as a fixed bit grid — it
// falls through as node.payload (see `next: null`).
//
// OUT OF SCOPE: the 4-byte NetBIOS Session Service / Direct-TCP length prefix that
// precedes the SMB header on the wire ([RFC 1002] / [MS-SMB2] 2.1) is transport
// framing, not part of the SMB header — we model from the 0xFF 'S' 'M' 'B' marker
// onward, exactly as the SMB2 spec does for its 0xFE 'S' 'M' 'B' marker.
import type { ProtocolSpec, ParsedHeader } from '../core/types';

// [MS-CIFS] 2.2.2.1: SMB_COM command codes (the subset most commonly seen on the
// wire). Values are the one-byte Command field; "ANDX" commands can chain a
// follow-on command in the same message via an AndX block in the body.
const COMMAND: Record<number, string> = {
  0x04: 'SMB_COM_CLOSE',
  0x0a: 'SMB_COM_READ',
  0x0b: 'SMB_COM_WRITE',
  0x2b: 'SMB_COM_ECHO',
  0x2e: 'SMB_COM_READ_ANDX',
  0x2f: 'SMB_COM_WRITE_ANDX',
  0x71: 'SMB_COM_TREE_DISCONNECT',
  0x72: 'SMB_COM_NEGOTIATE',
  0x73: 'SMB_COM_SESSION_SETUP_ANDX',
  0x74: 'SMB_COM_LOGOFF_ANDX',
  0x75: 'SMB_COM_TREE_CONNECT_ANDX',
};

export const smb1: ProtocolSpec = {
  id: 'smb1',
  name: 'SMB1/CIFS',
  layer: 7,
  summary:
    'The fixed 32-byte SMB1 (CIFS) header ([MS-CIFS] 2.2.3.1) that fronts every legacy Server Message Block message over TCP/139 or /445: a 0xFF "SMB" marker, a one-byte command, an NTSTATUS, two flag fields, the process/tree/user/multiplex identifiers, and an 8-byte security signature. Like SMB2 it stores multi-byte fields LITTLE-ENDIAN, read here via the engine\'s endian:\'le\' hook. This is the protocol SMB2/3 replaced.',
  fields: [
    {
      name: 'protocol',
      label: 'Protocol',
      bits: 32,
      type: 'hex',
      note: '0xFF "SMB" — marks a legacy SMB1/CIFS message.',
      desc: 'A fixed 4-byte marker, 0xFF followed by the ASCII letters "S", "M", "B" (bytes 0xFF 0x53 0x4D 0x42). It distinguishes SMB1/CIFS from SMB2/3, whose marker is 0xFE "SMB".',
      detail: `PROTOCOL (4 bytes, [MS-CIFS] 2.2.3.1): MUST contain the 4-byte literal 0xFF, 'S', 'M', 'B' in that transmission order (bytes 0xFF 0x53 0x4D 0x42).

This field is defined byte-by-byte (a magic constant), NOT as a little-endian integer, so unlike every other multi-byte field in this header the engine's big-endian read (0xFF534D42) is exactly the on-wire value — no byte-swap needed.

HISTORY: in the earliest SMB documentation the first byte (0xFF) was a message-type marker and the remaining three ('SMB') a server-type identifier. SMB2 later flipped the first byte from 0xFF to 0xFE (0xFE 'S' 'M' 'B') as the cheap, unambiguous way to mark the redesigned wire format introduced with Windows Vista / Server 2008. A receiver dispatches on this first byte before parsing anything else.`,
    },
    {
      name: 'command',
      label: 'Command',
      bits: 8,
      type: 'enum',
      enumMap: COMMAND,
      note: 'The one-byte SMB operation (NEGOTIATE 0x72, SESSION_SETUP 0x73, …).',
      desc: 'A one-byte command code identifying the operation: NEGOTIATE (0x72), SESSION_SETUP_ANDX (0x73), TREE_CONNECT_ANDX (0x75), READ_ANDX (0x2E), WRITE_ANDX (0x2F), CLOSE (0x04), and so on ([MS-CIFS] 2.2.2.1). The body that follows the header is the structure for this command.',
      detail: `COMMAND (1 byte, [MS-CIFS] 2.2.2.1). Common codes:
0x04 SMB_COM_CLOSE              0x0A SMB_COM_READ
0x0B SMB_COM_WRITE             0x2B SMB_COM_ECHO
0x2E SMB_COM_READ_ANDX         0x2F SMB_COM_WRITE_ANDX
0x71 SMB_COM_TREE_DISCONNECT   0x72 SMB_COM_NEGOTIATE
0x73 SMB_COM_SESSION_SETUP_ANDX 0x74 SMB_COM_LOGOFF_ANDX
0x75 SMB_COM_TREE_CONNECT_ANDX

TYPICAL SESSION FLOW: NEGOTIATE (agree a dialect) -> SESSION_SETUP_ANDX (authenticate) -> TREE_CONNECT_ANDX (mount a share \\\\server\\share) -> open/READ_ANDX/WRITE_ANDX -> CLOSE -> TREE_DISCONNECT -> LOGOFF_ANDX.

"ANDX" COMMANDS: several commands (suffix _ANDX) can chain a follow-on command in the same message via an AndX block in the body, reducing round trips — the ancestor of SMB2 compounding. Being one byte, the Command field is endianness-neutral. The single command field is one of the visible differences from SMB2, whose Command is a 2-byte field.`,
    },
    {
      name: 'status',
      label: 'Status (NTSTATUS)',
      bits: 32,
      type: 'hex',
      endian: 'le',
      note: 'Server-to-client error code (NTSTATUS or legacy SMBSTATUS).',
      desc: 'A 4-byte field used to communicate error/status from the server to the client. When SMB_FLAGS2_NT_STATUS (0x4000) is set in Flags2 it is a 32-bit NTSTATUS code ([MS-ERREF]); otherwise it is the legacy SMBSTATUS form (a 1-byte ErrorClass, a reserved byte, and a 2-byte ErrorCode). In a client request it is 0.',
      detail: `STATUS (4 bytes, little-endian, [MS-CIFS] 2.2.3.1): how the server reports success or failure.
- If Flags2.SMB_FLAGS2_NT_STATUS (0x4000) is set: this is a 32-bit NTSTATUS code. 0x00000000 = STATUS_SUCCESS; e.g. 0xC000006D = STATUS_LOGON_FAILURE, 0xC0000022 = STATUS_ACCESS_DENIED.
- If that bit is clear: the legacy SMBSTATUS layout — ErrorClass (1 byte) + Reserved (1 byte) + ErrorCode (2 bytes) — e.g. class DOS, code ERRbadfile.

In a CLIENT REQUEST the field is set to 0 (there is no error to report yet). Modern Windows clients set SMB_FLAGS2_NT_STATUS, so the NTSTATUS interpretation is the usual one.

ENDIANNESS: NTSTATUS values are conventionally written as 32-bit numbers (e.g. 0xC000006D); on the wire they are little-endian, read here with endian:'le' so the displayed value matches the conventional form.`,
    },
    {
      name: 'flags',
      label: 'Flags',
      bits: 8,
      type: 'flags',
      // flagBits index 0 = MSB (bit 7). [MS-CIFS] 2.2.3.1 Flags byte:
      // 0x80 REPLY (bit7), 0x40 OPBATCH (bit6), 0x20 OPLOCK (bit5),
      // 0x10 CANONICALIZED_PATHS (bit4), 0x08 CASE_INSENSITIVE (bit3),
      // 0x04 Reserved (bit2), 0x02 BUF_AVAIL (bit1), 0x01 LOCK_AND_READ_OK (bit0).
      flagBits: [
        'REPLY',                // bit 7 (0x80)
        'OPBATCH',              // bit 6 (0x40)
        'OPLOCK',               // bit 5 (0x20)
        'CANONICALIZED_PATHS',  // bit 4 (0x10)
        'CASE_INSENSITIVE',     // bit 3 (0x08)
        'RESERVED',             // bit 2 (0x04)
        'BUF_AVAIL',            // bit 1 (0x02)
        'LOCK_AND_READ_OK',     // bit 0 (0x01)
      ],
      decode: (v) => {
        const set: string[] = [];
        if (v & 0x80) set.push('REPLY');
        if (v & 0x40) set.push('OPBATCH');
        if (v & 0x20) set.push('OPLOCK');
        if (v & 0x10) set.push('CANONICALIZED_PATHS');
        if (v & 0x08) set.push('CASE_INSENSITIVE');
        if (v & 0x02) set.push('BUF_AVAIL');
        if (v & 0x01) set.push('LOCK_AND_READ_OK');
        return (set.length ? set.join(', ') : 'none') + ` (0x${(v & 0xff).toString(16).toUpperCase().padStart(2, '0')})`;
      },
      note: 'REPLY (0x80) marks a response; the rest are mostly legacy path/oplock options.',
      desc: 'An 8-bit bitmask of message features. The key bit is SMB_FLAGS_REPLY (0x80): set on responses (server->client), clear on requests. Other bits are largely legacy (case-insensitive/canonicalized paths, exclusive/batch oplock requests, an obsolete buffer-available hint).',
      detail: `FLAGS (1 byte, bitmask, [MS-CIFS] 2.2.3.1):
- 0x01 SMB_FLAGS_LOCK_AND_READ_OK — set in a NEGOTIATE response if the server supports LOCK_AND_READ / WRITE_AND_UNLOCK.
- 0x02 SMB_FLAGS_BUF_AVAIL — obsolete; MUST be 0 and ignored.
- 0x04 (reserved) — MUST be 0.
- 0x08 SMB_FLAGS_CASE_INSENSITIVE — pathnames are case-insensitive.
- 0x10 SMB_FLAGS_CANONICALIZED_PATHS — paths are already canonical (upper-case, '\\'-separated).
- 0x20 SMB_FLAGS_OPLOCK — requesting an exclusive OpLock (only in deprecated OPEN/CREATE).
- 0x40 SMB_FLAGS_OPBATCH — requesting a batch OpLock (only meaningful if OPLOCK is also set).
- 0x80 SMB_FLAGS_REPLY — set => this message is a server RESPONSE; clear => a client request. The unambiguous request/response discriminator.

flagBits is laid out MSB-first: index 0 = bit 7 = REPLY (0x80), down to index 7 = bit 0 = LOCK_AND_READ_OK (0x01).`,
    },
    {
      name: 'flags2',
      label: 'Flags2',
      bits: 16,
      type: 'flags',
      endian: 'le',
      // flagBits index 0 = MSB (bit 15) of the little-endian 16-bit value.
      // [MS-CIFS] 2.2.3.1 Flags2: 0x8000 UNICODE(bit15), 0x4000 NT_STATUS(bit14),
      // 0x2000 PAGING_IO(bit13), 0x1000 DFS(bit12), 0x0040 IS_LONG_NAME(bit6),
      // 0x0004 SECURITY_SIGNATURE(bit2), 0x0002 EAS(bit1), 0x0001 LONG_NAMES(bit0).
      flagBits: [
        'UNICODE',           // bit 15 (0x8000)
        'NT_STATUS',         // bit 14 (0x4000)
        'PAGING_IO',         // bit 13 (0x2000)
        'DFS',               // bit 12 (0x1000)
        '',                  // bit 11
        '',                  // bit 10
        '',                  // bit 9
        '',                  // bit 8
        '',                  // bit 7
        'IS_LONG_NAME',      // bit 6 (0x0040)
        '',                  // bit 5
        '',                  // bit 4
        '',                  // bit 3
        'SECURITY_SIGNATURE', // bit 2 (0x0004)
        'EAS',               // bit 1 (0x0002)
        'LONG_NAMES',        // bit 0 (0x0001)
      ],
      decode: (v) => {
        const set: string[] = [];
        if (v & 0x8000) set.push('UNICODE');
        if (v & 0x4000) set.push('NT_STATUS');
        if (v & 0x2000) set.push('PAGING_IO');
        if (v & 0x1000) set.push('DFS');
        if (v & 0x0040) set.push('IS_LONG_NAME');
        if (v & 0x0004) set.push('SECURITY_SIGNATURE');
        if (v & 0x0002) set.push('EAS');
        if (v & 0x0001) set.push('LONG_NAMES');
        return (set.length ? set.join(', ') : 'none') + ` (0x${(v & 0xffff).toString(16).toUpperCase().padStart(4, '0')})`;
      },
      note: 'UNICODE (0x8000), NT_STATUS (0x4000), long names, EAs, DFS, signing-supported.',
      desc: 'A 16-bit bitmask of higher-level features negotiated for the connection. The two most consequential bits: SMB_FLAGS2_UNICODE (0x8000), meaning strings are UTF-16LE rather than OEM 8-bit; and SMB_FLAGS2_NT_STATUS (0x4000), meaning the Status field is a 32-bit NTSTATUS.',
      detail: `FLAGS2 (2 bytes, little-endian bitmask, [MS-CIFS] 2.2.3.1). Unspecified bits are reserved and MUST be 0.
- 0x0001 SMB_FLAGS2_LONG_NAMES — file names may exceed 8.3.
- 0x0002 SMB_FLAGS2_EAS — the client understands extended attributes.
- 0x0004 SMB_FLAGS2_SMB_SECURITY_SIGNATURE — signing is supported/requested, or this message is signed.
- 0x0040 SMB_FLAGS2_IS_LONG_NAME — reserved; not implemented.
- 0x1000 SMB_FLAGS2_DFS — resolve paths through the Distributed File System.
- 0x2000 SMB_FLAGS2_PAGING_IO (a.k.a. READ_IF_EXECUTE) — read allowed with execute-only permission.
- 0x4000 SMB_FLAGS2_NT_STATUS — the Status field is a 32-bit NTSTATUS code (vs legacy SMBSTATUS).
- 0x8000 SMB_FLAGS2_UNICODE — strings in this message are 16-bit Unicode (UTF-16LE), not OEM characters.

ENDIANNESS: the 2-byte field is read little-endian (endian:'le'), so wire bytes 0x01 0xC8 are the value 0xC801 = UNICODE|NT_STATUS|LONG_NAMES. flagBits is laid out MSB-first over that value (UNICODE = bit 15 = index 0).`,
    },
    {
      name: 'pidHigh',
      label: 'PID (high)',
      bits: 16,
      endian: 'le',
      note: 'High 16 bits of the client process ID; combined with PIDLow.',
      desc: 'If nonzero, the high-order 16 bits of the client process identifier (PID). It is combined with the PIDLow field (lower 16 bits) to form a full 32-bit PID identifying which client process issued the request.',
      detail: `PID HIGH (2 bytes, little-endian, [MS-CIFS] 2.2.3.1): the upper half of a 32-bit process id. Early SMB had only the 16-bit PIDLow; PIDHigh was added later to widen the PID space, so on many requests it is 0.

WHY A PID IS ON THE WIRE: SMB1 multiplexes several client processes over one connection. The (PID, MID) pair lets the server (and the client's redirector) match a response to the exact process and outstanding request that issued it — a role SMB2 later folded into its per-connection MessageId.`,
    },
    {
      name: 'securityFeatures',
      label: 'Security features',
      bits: 64,
      type: 'bytes',
      note: '8-byte message signature (or Key/CID/SequenceNumber on connectionless transport).',
      desc: 'An opaque 8-byte field with three interpretations ([MS-CIFS] 2.2.3.1). When SMB signing is negotiated it is an 8-byte SecuritySignature protecting the message against tampering. Over a connectionless transport it is instead a Key (4 bytes) + CID (2 bytes) + SequenceNumber (2 bytes). Otherwise it is reserved and MUST be 0.',
      detail: `SECURITY FEATURES (8 bytes, [MS-CIFS] 2.2.3.1) — three possible meanings:
1. SIGNING NEGOTIATED: SecuritySignature[8] — an 8-byte cryptographic signature (MD5-based for SMB1) over the message, letting the peer detect modification in transit. The signer zeroes this field, computes the MAC, then writes the 8-byte result here.
2. CONNECTIONLESS TRANSPORT: Key (4 bytes) + CID (2 bytes) + SequenceNumber (2 bytes) — used to validate/order messages on a connectionless transport.
3. NEITHER: reserved; the client MUST set it to 0 and the server MUST ignore it.

WIDTH: 8 bytes = 64 bits, beyond the engine's exact numeric range (<= 48 bits), and being an opaque blob whose internal byte order depends on interpretation, it is modeled as raw 'bytes' per the Apex contract rather than a single integer. (Note SMB2 doubled this to a 16-byte Signature.)`,
    },
    {
      name: 'reserved',
      label: 'Reserved',
      bits: 16,
      type: 'hex',
      endian: 'le',
      note: 'Reserved; SHOULD be 0x0000.',
      desc: 'A 2-byte reserved field. Per [MS-CIFS] it SHOULD be set to 0x0000 by the sender and is ignored on receipt.',
      detail: `RESERVED (2 bytes, little-endian, [MS-CIFS] 2.2.3.1): reserved for future use; SHOULD be 0x0000. It sits between the 8-byte SecurityFeatures field and the TID, padding the header out so the identifier fields land at their fixed offsets (TID at byte 24, PIDLow 26, UID 28, MID 30).`,
    },
    {
      name: 'tid',
      label: 'TID (tree ID)',
      bits: 16,
      type: 'hex',
      endian: 'le',
      note: 'Tree identifier — the connected share; 0xFFFF / 0 before TREE_CONNECT.',
      desc: 'A 2-byte tree identifier (TID) naming the connected share (\\\\server\\share) this command targets, as returned by a prior TREE_CONNECT_ANDX response. Before a tree is connected (NEGOTIATE, SESSION_SETUP) it is 0 or 0xFFFF.',
      detail: `TID — TREE ID (2 bytes, little-endian, [MS-CIFS] 2.2.3.1): a handle to a connected share. A client obtains a TID from a TREE_CONNECT_ANDX response, stamps it on every command that targets files on that share, and releases it with TREE_DISCONNECT.

0xFFFF is used to mean "no tree" in some requests; NEGOTIATE and SESSION_SETUP_ANDX precede any tree connect, so their TID is not meaningful. This is the SMB1 analogue of SMB2's 4-byte TreeId.`,
    },
    {
      name: 'pidLow',
      label: 'PID (low)',
      bits: 16,
      endian: 'le',
      note: 'Low 16 bits of the client process ID; combined with PIDHigh.',
      desc: 'The lower 16 bits of the client process identifier (PID). Combined with PIDHigh it forms the full 32-bit PID; together with MID it lets the server match a response to the issuing process and request.',
      detail: `PID LOW (2 bytes, little-endian, [MS-CIFS] 2.2.3.1): the lower half of the 32-bit PID. In the original SMB this 16-bit field was the entire PID; PIDHigh was added later to extend it.

The (PID, MID) tuple is SMB1's request-tracking key: a client may have several processes and several outstanding requests multiplexed on one connection, and the server echoes both fields in each response so the redirector can route it back to the right caller.`,
    },
    {
      name: 'uid',
      label: 'UID (user ID)',
      bits: 16,
      type: 'hex',
      endian: 'le',
      note: 'User/session identifier from SESSION_SETUP; 0 before authentication.',
      desc: 'A 2-byte user identifier (UID) naming the authenticated session this command belongs to, assigned by the server in a SESSION_SETUP_ANDX response. It is 0 before authentication (e.g. in NEGOTIATE).',
      detail: `UID — USER ID (2 bytes, little-endian, [MS-CIFS] 2.2.3.1): identifies the authenticated user session. The client sends SESSION_SETUP_ANDX with credentials; the server validates them and returns a UID, which the client then carries on all subsequent commands so the server can apply that user's access rights.

It is 0 in the NEGOTIATE exchange because no authentication has happened yet. This is the SMB1 analogue of SMB2's 8-byte SessionId.`,
    },
    {
      name: 'mid',
      label: 'MID (multiplex ID)',
      bits: 16,
      type: 'hex',
      endian: 'le',
      note: 'Multiplex ID pairing a response with its request.',
      desc: 'A 2-byte multiplex identifier (MID). Together with the PID it uniquely identifies an outstanding request on the connection; the server echoes it in the response so the client can match reply to request.',
      detail: `MID — MULTIPLEX ID (2 bytes, little-endian, [MS-CIFS] 2.2.3.1): distinguishes the multiple requests a single process may have in flight at once. The (PID, MID) pair is the matching key: a client picks a MID per request, the server copies PID+MID into the response, and the client's redirector uses them to deliver the reply to the waiting caller.

This is the conceptual ancestor of SMB2's MessageId, which replaced the (PID, MID, UID, TID) tuple-matching scheme with a single monotonically increasing per-connection message number.`,
    },
  ],
  // The SMB1 header is a fixed 32 bytes ([MS-CIFS] 2.2.3.1). Everything after it is
  // the command-specific body (WordCount + parameter words + ByteCount + data,
  // variable and command-specific) and falls through as node.payload.
  headerBytes: (): number => 32,
  // The body is variable and command-specific with no generic child protocol to
  // dissect, so dissection stops at the header.
  next: (_h: ParsedHeader): string | null => null,
};
