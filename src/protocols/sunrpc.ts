// ONC / Sun RPC — Remote Procedure Call, message header. RFC 5531 (Remote
// Procedure Call Protocol Version 2), which obsoletes RFC 1831/1057. Sun RPC is
// the framing layer beneath NFS, the mount protocol, NIS, and is itself reached
// through the portmapper / rpcbind (program 100000) on port 111. It runs over
// both UDP and TCP.
//
// THE RPC MESSAGE (RFC 5531 §9), XDR-encoded, big-endian. Every XDR "unsigned
// int" is a 32-bit value occupying 4 octets:
//
//   struct rpc_msg {
//     unsigned int xid;
//     union switch (msg_type mtype) {        // CALL = 0, REPLY = 1
//     case CALL:  call_body  cbody;
//     case REPLY: reply_body rbody;
//     } body;
//   };
//
//   struct call_body {
//     unsigned int rpcvers;   // MUST equal 2
//     unsigned int prog;      // program number  (e.g. 100000 = portmap)
//     unsigned int vers;      // program version
//     unsigned int proc;      // procedure number within the program
//     opaque_auth  cred;      // credentials  (flavor + opaque body<400>)
//     opaque_auth  verf;      // verifier     (flavor + opaque body<400>)
//     /* procedure-specific parameters start here */
//   };
//
// WHAT THIS SPEC MODELS, AND WHAT IT DOES NOT
// -------------------------------------------
// We transcribe the fixed 24-byte CALL prefix exactly: xid, mtype, then the four
// call_body identifiers (rpcvers, prog, vers, proc). These six 32-bit words are
// at fixed offsets for every CALL message and are the part that identifies WHICH
// remote procedure is being invoked.
//
// We deliberately stop there (headerBytes => 24) because what follows is variable
// length and not a fixed grid:
//   * cred and verf are each an opaque_auth = a 32-bit flavor + a 32-bit length +
//     that many opaque bytes (XDR-padded to a 4-byte boundary). Their size
//     depends on the auth flavor (AUTH_NONE has a 0-length body; AUTH_SYS carries
//     a machine name, uid, gid and group list; RPCSEC_GSS carries a token). So
//     neither the verifier's position nor the procedure arguments live at a fixed
//     bit offset.
//   * the procedure-specific parameters (e.g. a portmapper GETPORT's {prog, vers,
//     prot, port} mapping, or an NFS LOOKUP's file handle + name) follow verf.
// All of that falls through as node.payload, the raw XDR stream, rather than being
// transcribed against invented offsets. next => null for the same reason: the
// arguments are program/procedure-specific XDR, not another registered protocol.
//
// THE TCP RECORD MARK IS OUT OF SCOPE: over TCP (a byte stream) each RPC message
// is prefixed by a 4-byte "record marking" word (a last-fragment bit + 31-bit
// fragment length, RFC 5531 §11). That belongs to the TCP framing, not to this
// message header; a UDP-borne RPC message (the common portmapper case) has no
// such prefix and begins directly at xid. This spec models the message starting
// at xid, matching the UDP form and the post-record-mark TCP form.
import type { ProtocolSpec } from '../core/types';

// A few well-known RPC program numbers (IANA / the historic rpc(5) database).
// Surfaced to make the `prog` field readable; the full set is large.
const PROGRAMS: Record<number, string> = {
  100000: 'portmapper / rpcbind',
  100003: 'NFS',
  100005: 'mountd (mount protocol)',
  100021: 'NLM (network lock manager)',
  100024: 'status monitor (statd)',
  100227: 'NFS_ACL',
  100004: 'NIS (ypserv)',
  100007: 'ypbind',
};

export const sunrpc: ProtocolSpec = {
  id: 'sunrpc',
  name: 'Sun RPC',
  layer: 7,
  summary:
    'ONC/Sun RPC (RFC 5531): the call/reply framing under NFS, mountd, NLM and the portmapper (program 100000, port 111). A CALL message names the target by (program, version, procedure) and carries credentials and a verifier, then the procedure arguments. Apex models the fixed 24-byte CALL prefix; the auth fields and arguments follow as the XDR payload.',
  fields: [
    {
      name: 'xid',
      label: 'Transaction ID (XID)',
      bits: 32,
      type: 'hex',
      note: 'Client-chosen id echoed back in the matching REPLY so the caller can pair request and response.',
      desc: 'A 32-bit transaction identifier chosen by the client. The server copies it unchanged into its REPLY, letting the client match a reply to the call it answers — essential over UDP, where replies can arrive out of order or be duplicated.',
      detail: `TRANSACTION ID — XID (32 bits, RFC 5531 §8/§9):
"The xid of a REPLY always matches that of the initiating CALL."

PURPOSE: it is the request/response correlator. A client may have several RPCs outstanding; the XID is how it knows which reply belongs to which call.

DUPLICATE-REQUEST CACHE: because UDP can duplicate or retransmit a datagram, a server keeps a cache keyed by XID (plus the client address) so that re-executing a non-idempotent operation (e.g. an NFS file create) is avoided — it just resends the cached reply. This is the classic "duplicate request cache" / DRC.

NOT A SEQUENCE NUMBER: the XID need only be unique among a client's outstanding calls; it is typically random or a simple counter, not a wire-ordered sequence.

ENDIANNESS: 32-bit big-endian (XDR). Shown in hex because it is an opaque identifier, not a quantity.`,
    },
    {
      name: 'messageType',
      label: 'Message type',
      bits: 32,
      type: 'enum',
      enumMap: {
        0: 'CALL',
        1: 'REPLY',
      },
      note: 'CALL = 0 (a request, modeled here); REPLY = 1 (the server response, a different body layout).',
      desc: 'The discriminant of the RPC message union: 0 = CALL (a request to invoke a procedure), 1 = REPLY (the server\'s answer). This spec models the CALL body; a REPLY has a different layout (accept/reject status, reply data).',
      detail: `MESSAGE TYPE — mtype (32 bits, enum msg_type, RFC 5531 §9):
  CALL  = 0
  REPLY = 1

It selects which arm of the rpc_msg union follows:
  CALL  -> call_body  { rpcvers, prog, vers, proc, cred, verf, args }
  REPLY -> reply_body { reply_stat: MSG_ACCEPTED | MSG_DENIED, ... }

A REPLY is therefore NOT just a mirror of the call — it carries the verifier the server returns, an accept/reject status, and either the procedure results or a rejection reason (e.g. RPC_MISMATCH, AUTH_ERROR, PROG_UNAVAIL, PROC_UNAVAIL, GARBAGE_ARGS).

Apex models the CALL body (the six fixed 32-bit words below); for a REPLY the bytes after this field fall into the payload.

ENDIANNESS: 32-bit big-endian (XDR enums are encoded as signed 32-bit ints).`,
    },
    {
      name: 'rpcVersion',
      label: 'RPC version',
      bits: 32,
      decode: (v) => (v === 2 ? '2 (ONC RPC v2 — required)' : `${v} (invalid; v2 required)`),
      note: 'Always 2. A server that speaks another RPC version replies RPC_MISMATCH with the versions it supports.',
      desc: 'The version of the RPC protocol itself (the framing), distinct from the program version below. RFC 5531 mandates this be 2. If it differs, the server rejects the call with RPC_MISMATCH and reports the version range it supports.',
      detail: `RPC VERSION — rpcvers (32 bits, RFC 5531 §9):
"In version 2 of the RPC protocol specification, rpcvers MUST be equal to 2."

TWO DIFFERENT "VERSIONS": do not confuse this with the program version (vers) two fields down.
  - rpcvers = version of the RPC call/reply MACHINERY (the message format). Always 2.
  - vers    = version of the remote PROGRAM (e.g. NFSv3 = 3, NFSv4 = 4).

MISMATCH HANDLING: if a server does not implement the requested rpcvers, it sends a MSG_DENIED reply with reject_stat = RPC_MISMATCH carrying { low, high } — the lowest and highest RPC versions it supports.

ENDIANNESS: 32-bit big-endian (XDR).`,
    },
    {
      name: 'program',
      label: 'Program number',
      bits: 32,
      type: 'enum',
      enumMap: PROGRAMS,
      decode: (v) => (PROGRAMS[v] ? `${v} (${PROGRAMS[v]})` : `${v}`),
      note: 'Which RPC service is being called: 100000 = portmapper/rpcbind, 100003 = NFS, 100005 = mountd.',
      desc: 'The 32-bit program number naming the remote service. It is the global identifier of an RPC interface (100000 = portmapper, 100003 = NFS, 100005 = mountd). Program numbers are administered in blocks; 0x00000000-0x1FFFFFFF is defining-authority space (Sun/IANA).',
      detail: `PROGRAM NUMBER — prog (32 bits, RFC 5531 §9 / §11.1):
Identifies WHICH remote program (service) the client wants. A program is a versioned set of procedures.

WELL-KNOWN NUMBERS (historic rpc(5) database):
  100000 = portmapper / rpcbind   100003 = NFS
  100005 = mountd                 100021 = NLM (lock manager)
  100024 = statd                  100227 = NFS_ACL

NUMBER RANGES (RFC 5531 §11.1):
  0x00000000-0x1FFFFFFF  defined by the central authority (Sun/IANA)
  0x20000000-0x3FFFFFFF  defined by the user (site-local)
  0x40000000-0x5FFFFFFF  transient (dynamically assigned)
  0x60000000-0xFFFFFFFF  reserved

PORTMAPPER ROLE: because RPC services bind to dynamic ports, a client first asks the portmapper (itself at the fixed program 100000 / port 111) "what port is program P version V on?" via the GETPORT procedure, then connects there.

ENDIANNESS: 32-bit big-endian (XDR).`,
    },
    {
      name: 'programVersion',
      label: 'Program version',
      bits: 32,
      note: 'Which version of the program (e.g. NFS 3 vs 4). Mismatch -> PROG_MISMATCH with the supported range.',
      desc: 'The version of the target program being invoked (e.g. NFSv3 carries 3, portmapper v2 carries 2). A program can support several versions simultaneously; the call selects one. A wrong version yields PROG_MISMATCH listing the supported range.',
      detail: `PROGRAM VERSION — vers (32 bits, RFC 5531 §9):
The version of the PROGRAM (not of RPC itself — see rpcvers above). Each version may define a different set of procedures and argument formats.

EXAMPLES:
  portmapper:  version 2 (the classic PMAP_* procedures)
  rpcbind:     versions 3 and 4 (RPCB_* procedures, the IPv6-capable successor)
  NFS:         3 (RFC 1813), 4 (RFC 7530/8881)
  mountd:      1 and 3

MISMATCH HANDLING: if the program exists but not at the requested version, the server replies MSG_ACCEPTED with accept_stat = PROG_MISMATCH and a { low, high } version range, so the client can retry with a supported version.

ENDIANNESS: 32-bit big-endian (XDR).`,
    },
    {
      name: 'procedure',
      label: 'Procedure number',
      bits: 32,
      note: 'Which procedure within the program (e.g. portmapper procedure 3 = GETPORT, procedure 0 = NULL ping).',
      desc: 'The 32-bit procedure number selecting an individual operation within the chosen program/version. Procedure 0 is, by convention, always a no-argument "NULL" ping used to test reachability. For the portmapper, procedure 3 is GETPORT.',
      detail: `PROCEDURE NUMBER — proc (32 bits, RFC 5531 §9):
Selects the specific operation within (program, version). Its meaning is defined entirely by that program's interface definition.

PROCEDURE 0 = NULL: every RPC program MUST implement procedure 0 as a NULL procedure that takes and returns nothing — used to ping a service and to measure round-trip / authentication overhead.

PORTMAPPER (program 100000, version 2) PROCEDURES:
  0 = NULL   1 = SET    2 = UNSET
  3 = GETPORT  (the lookup: "what port is prog/vers on?")
  4 = DUMP   5 = CALLIT

The (program, version, procedure) triple plus the arguments that follow verf fully specify the remote call. The arguments are program-specific XDR and are not modeled here — they fall into the payload after the credentials and verifier.

ENDIANNESS: 32-bit big-endian (XDR).`,
    },
  ],
  // The fixed CALL prefix is exactly six 32-bit words = 24 bytes (xid, mtype,
  // rpcvers, prog, vers, proc). What follows — the credentials (cred) and
  // verifier (verf) opaque_auth structures, then the procedure arguments — is
  // variable-length XDR and falls through as node.payload. See the top-of-file
  // note. (For a REPLY message the body layout differs entirely after mtype.)
  headerBytes: () => 24,
  // The auth fields and procedure arguments are program/procedure-specific XDR,
  // not another registered protocol, so dissection stops here.
  next: () => null,
};
