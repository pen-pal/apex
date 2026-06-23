// TFTP — Trivial File Transfer Protocol. RFC 1350 (THE TFTP PROTOCOL, REVISION 2).
// Related: RFC 906 (bootstrapping), and the option extensions RFC 2347 (option
// negotiation), RFC 2348 (blksize), RFC 2349 (timeout/tsize). This spec models
// only the base RFC 1350 wire format.
//
// TFTP runs over UDP. The server listens on the well-known port 69, but only the
// initial request (RRQ/WRQ) is sent there: the server then replies from a freshly
// chosen ephemeral TID (transport ID = UDP port), and the rest of the transfer
// uses that port pair. TFTP is "trivial" — no authentication, no directory
// listing, no security — and is used for booting diskless hosts, loading router
// firmware, and PXE network boot.
//
// THE ONLY FIXED FIELD IS THE 2-BYTE OPCODE
// -----------------------------------------
// RFC 1350 §5 defines five packet types, and EVERY TFTP packet begins with the
// same 2-byte big-endian Opcode. After that, the layout is OPCODE-DEPENDENT and
// largely VARIABLE-LENGTH (NUL-terminated ASCII strings), so it cannot be modelled
// honestly as a fixed `Field[]`. We transcribe only the Opcode as a field, set
// headerBytes() => 2, and let the remainder fall through as `node.payload`. The
// byte view then shows the real opcode-specific bytes (e.g. the ASCII filename).
//
//   Type   Op  Format (RFC 1350 §5)
//   ----   --  --------------------------------------------------------------
//   RRQ     1  | 01 02 bytes | Filename | 0 | Mode | 0 |   (read request)
//   WRQ     2  | 01 02 bytes | Filename | 0 | Mode | 0 |   (write request)
//   DATA    3  | 01 02 bytes | Block #  (2B) | Data (0-512 bytes) |
//   ACK     4  | 01 02 bytes | Block #  (2B) |
//   ERROR   5  | 01 02 bytes | ErrorCode(2B) | ErrMsg | 0 |
//
// RRQ/WRQ: "Filename" is a NUL-terminated ASCII string; "Mode" is one of
//   "netascii", "octet", or "mail" (case-insensitive), also NUL-terminated.
//
// FRAMING & THE LOCKSTEP TRANSFER (RFC 1350 §1, §2):
//   - DATA blocks are numbered from 1 and each carries exactly 512 bytes of file
//     data — EXCEPT the final block, which carries 0-511 bytes. A short (< 512)
//     DATA block signals end-of-file. So a file that is an exact multiple of 512
//     ends with an extra zero-length DATA block.
//   - Transfer is strict lockstep: the sender transmits one DATA block and waits
//     for the matching ACK (same Block #) before sending the next. This is the
//     classic "stop-and-wait" ARQ — simple but slow over high-latency links.
//   - Loss recovery is by timeout-and-retransmit of the unacknowledged packet.
//     Because both sides retransmit on timeout, a duplicated ACK can trigger the
//     "Sorcerer's Apprentice" bug (RFC 1350 notes this).
//
// We do not model the variable opcode bodies as fields (they are strings and
// counts that are not at fixed offsets across packet types); they are left as the
// payload, and this note documents them so the teaching is complete.
import type { ProtocolSpec } from '../core/types';

const OPCODE: Record<number, string> = {
  1: 'RRQ (Read Request)',
  2: 'WRQ (Write Request)',
  3: 'DATA',
  4: 'ACK',
  5: 'ERROR',
};

export const tftp: ProtocolSpec = {
  id: 'tftp',
  name: 'TFTP',
  layer: 7,
  summary:
    'A minimal file-transfer protocol over UDP/69 used for network boot (PXE) and firmware loads. Every packet starts with a 2-byte Opcode (RRQ/WRQ/DATA/ACK/ERROR); the rest is opcode-specific and variable (NUL-terminated filename+mode strings, or a block number and up to 512 data bytes), so Apex shows that body as raw payload bytes. Transfers run in strict 512-byte lockstep with one ACK per DATA block.',
  fields: [
    {
      name: 'opcode',
      label: 'Opcode',
      bits: 16,
      type: 'enum',
      enumMap: OPCODE,
      note: 'The 2-byte packet type. The only fixed field in TFTP; everything after it depends on this value.',
      desc: 'A 16-bit big-endian operation code identifying the packet type: 1=RRQ, 2=WRQ, 3=DATA, 4=ACK, 5=ERROR (RFC 1350 §5). It is the only field at a fixed offset in TFTP — the bytes that follow are laid out differently for each opcode.',
      detail: `OPCODE (16 bits, network order) — RFC 1350 §5:
  1  RRQ   Read Request  — client asks to read (download) a file from the server
  2  WRQ   Write Request — client asks to write (upload) a file to the server
  3  DATA  carries a 2-byte Block # followed by 0-512 bytes of file data
  4  ACK   acknowledges a Block # (and, for a WRQ, ACK of block 0 confirms the request)
  5  ERROR carries a 2-byte ErrorCode + a NUL-terminated message, and aborts the transfer

WHAT FOLLOWS THE OPCODE (opcode-dependent, hence left as payload here):
  RRQ/WRQ:  Filename\\0 Mode\\0   — two NUL-terminated ASCII strings. Mode is
            "netascii" (line-ending translation), "octet" (raw bytes), or the
            obsolete "mail". Case-insensitive.
  DATA:     Block#(2B) | Data(0-512B). Blocks start at 1.
  ACK:      Block#(2B). ACK of block 0 answers a WRQ.
  ERROR:    ErrorCode(2B) | ErrMsg\\0. Codes 0-7 (e.g. 1=File not found,
            2=Access violation, 6=File already exists).

WHY ONLY THE OPCODE IS A FIELD: the remaining layout is variable-length
NUL-terminated strings (RRQ/WRQ) or a count plus raw bytes (DATA/ACK/ERROR),
not fixed-width integers at constant offsets. Modelling them as fixed Fields
would misrepresent the wire, so Apex reads the 2-byte opcode and exposes the
rest as raw payload bytes.

PORTS / TID: the first RRQ or WRQ goes to UDP port 69; the server answers from a
new ephemeral port (its Transport ID), and the transfer continues on that port
pair. Each side uses the other's source port as the destination for the rest of
the exchange.`,
    },
  ],
  // Only the 2-byte opcode is a fixed header. Everything after it is
  // opcode-dependent and variable, so it falls through as node.payload.
  headerBytes: () => 2,
  // The opcode body is application/file data (filename+mode strings, or block
  // number + file bytes); there is no further protocol to dissect, so stop here.
  next: () => null,
};
