// Diameter Base Protocol. RFC 6733 (October 2012), "Diameter Base Protocol",
// section 3 "Diameter Header" and section 3.1 "Command Codes". Diameter is the
// IETF AAA (Authentication, Authorization, and Accounting) protocol — the
// successor to RADIUS (RFC 2865). It runs over a reliable transport, TCP or
// SCTP, on the IANA-assigned port 3868 (TLS/DTLS for secure transport). This
// spec models the fixed 20-byte Diameter message header.
//
// THE 20-BYTE HEADER (RFC 6733 §3)
// --------------------------------
//   0                   1                   2                   3
//   0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
//  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//  |    Version    |                 Message Length                |
//  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//  | command flags |                  Command Code                 |
//  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//  |                         Application-ID                        |
//  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//  |                      Hop-by-Hop Identifier                    |
//  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//  |                      End-to-End Identifier                    |
//  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
// All multi-byte integers are big-endian (network order). The Message Length is
// a 24-bit field giving the WHOLE message length in bytes (header + AVPs), so we
// set pduBytes from it.
//
// WHAT FOLLOWS THE HEADER — ATTRIBUTE-VALUE PAIRS (RFC 6733 §4)
// ------------------------------------------------------------
// After the 20-byte header come zero or more AVPs, each a TLV with its own
// 8- or 12-byte sub-header (AVP Code, AVP Flags V/M/P, AVP Length, optional
// Vendor-ID) followed by data, padded to a 4-byte boundary. A CER, for example,
// carries Origin-Host (264), Origin-Realm (296), Host-IP-Address (257),
// Vendor-Id (266), Product-Name (269), and Auth-Application-Id (258) AVPs. The
// AVP list is variable and not a fixed bit grid, so it cannot be transcribed
// honestly as Field entries — it falls through as node.payload (next() returns
// null). The byte view still shows the real AVP bytes.
import type { ProtocolSpec } from '../core/types';

// RFC 6733 §3.1 (and the base-protocol commands it defines). Each Command Code
// names a request/answer pair distinguished by the R (Request) flag: e.g. code
// 257 is the Capabilities-Exchange-Request (CER) when R=1 and the
// Capabilities-Exchange-Answer (CEA) when R=0.
const COMMAND: Record<number, string> = {
  257: 'Capabilities-Exchange (CER/CEA)',
  258: 'Re-Auth (RAR/RAA)',
  271: 'Accounting (ACR/ACA)',
  274: 'Abort-Session (ASR/ASA)',
  275: 'Session-Termination (STR/STA)',
  280: 'Device-Watchdog (DWR/DWA)',
  282: 'Disconnect-Peer (DPR/DPA)',
};

export const diameter: ProtocolSpec = {
  id: 'diameter',
  name: 'Diameter',
  layer: 7,
  summary:
    'The IETF AAA protocol over TCP/SCTP port 3868 — the successor to RADIUS. A fixed 20-byte header (version, 24-bit message length, command flags R/P/E/T, command code, and three identifiers) fronts a list of Attribute-Value Pairs (AVPs). The Hop-by-Hop ID matches a request to its answer on a link; the End-to-End ID detects duplicates across the whole path.',
  fields: [
    {
      name: 'version',
      label: 'Version',
      bits: 8,
      decode: (v) => (v === 1 ? '1 (RFC 6733)' : `${v} (unknown)`),
      note: 'Always 1 for RFC 6733 Diameter.',
      desc: 'One octet giving the Diameter version. RFC 6733 fixes this at 1; a receiver that sees any other value treats the message as malformed.',
      detail: `VERSION (8 bits, RFC 6733 §3): "This Version field MUST be set to 1 to indicate Diameter Version 1."

There is only one deployed Diameter version. The field exists so the wire format can evolve, but in practice every Diameter message on the network carries Version = 1. This is the very first byte of the message, so a parser checks it before reading the 24-bit length that follows.`,
    },
    {
      name: 'messageLength',
      label: 'Message Length',
      bits: 24,
      decode: (v) => `${v} bytes (20-byte header + ${v - 20} bytes of AVPs)`,
      note: '24-bit total message length in bytes, including the header. Bounds the whole PDU.',
      desc: 'A 24-bit field giving the length, in bytes, of the entire Diameter message — the 20-byte header plus all AVPs that follow. Because Diameter rides on a byte-stream transport (TCP/SCTP), this length is how a receiver frames one message out of the stream.',
      detail: `MESSAGE LENGTH (24 bits, RFC 6733 §3): "The Message Length field is three octets and indicates the length of the Diameter message including the header fields and the padded AVPs."

BOUNDS THE PDU: the minimum is 20 (header only, no AVPs). Subtract 20 to get the total bytes of AVPs. The dissector uses this to stop the AVP payload exactly at Message Length, so trailing bytes from the TCP stream or Ethernet padding cannot leak in.

WHY 24 BITS, NOT 16: unlike RADIUS's 16-bit Length (max 4096), Diameter's 24-bit length allows messages up to 16,777,215 bytes, accommodating large AVP payloads. The message is also always a multiple of 4 bytes because every AVP is padded to a 4-byte boundary.

FRAMING ON A STREAM: Diameter runs over TCP or SCTP, not UDP, so messages are not self-delimited by datagram boundaries. The receiver reads the 4-byte version+length word first, then reads exactly Message Length bytes to recover one complete message.`,
    },
    {
      name: 'commandFlags',
      label: 'Command Flags',
      bits: 8,
      type: 'flags',
      // RFC 6733 §3: command flags byte is "R P E T r r r r", MSB first.
      // flagBits[0] = MSB = bit 7 = R. The low 4 bits are reserved (must be 0).
      flagBits: ['R', 'P', 'E', 'T', 'r', 'r', 'r', 'r'],
      decode: (v) => {
        const set: string[] = [];
        if (v & 0x80) set.push('R (Request)');
        if (v & 0x40) set.push('P (Proxiable)');
        if (v & 0x20) set.push('E (Error)');
        if (v & 0x10) set.push('T (reTransmit)');
        return (set.length ? set.join(', ') : 'none') + ` (0x${v.toString(16).toUpperCase().padStart(2, '0')})`;
      },
      note: 'R=Request (0x80), P=Proxiable (0x40), E=Error (0x20), T=potentially re-Transmitted (0x10); low 4 bits reserved.',
      desc: 'An 8-bit flags field. The R (Request) bit is the most important: set means this is a request (e.g. CER), clear means an answer (e.g. CEA). P marks the message as proxiable, E marks an answer carrying a protocol error, and T marks a message that may be a retransmission. The low 4 bits are reserved and sent as 0.',
      detail: `COMMAND FLAGS (8 bits, RFC 6733 §3) — bit layout "R P E T r r r r", most-significant bit first:
- 0x80 R(equest): if set, the message is a Request; if cleared, it is an Answer. The R bit, together with the Command Code, names the message: code 257 + R=1 is a CER, code 257 + R=0 is a CEA.
- 0x40 P(roxiable): if set, the message MAY be proxied, relayed, or redirected; if cleared, it MUST be locally processed.
- 0x20 E(rror): if set, the message contains a protocol error and the message will not conform to the command's normal ABNF. The E bit MUST NOT be set in request messages.
- 0x10 T(potentially re-transmitted): set on a message that may have been retransmitted after a link failover, so the receiving peer can detect a possible duplicate. It MUST be cleared on the first transmission of a request and MUST NOT be set in answers.
- 0x08, 0x04, 0x02, 0x01 (r): reserved bits, "set to 0, and ignored by the receiver."

vs RADIUS: RADIUS used a separate Code value for request vs response (Access-Request=1, Access-Accept=2). Diameter instead pairs ONE Command Code with the R flag, so a request and its answer share the same code.`,
    },
    {
      name: 'commandCode',
      label: 'Command Code',
      bits: 24,
      type: 'enum',
      enumMap: COMMAND,
      note: 'Identifies the command (paired with the R flag): 257 CER/CEA, 280 DWR/DWA, 282 DPR/DPA, …',
      desc: 'A 24-bit code identifying which Diameter command this message is. Combined with the R flag it names the message: code 257 is Capabilities-Exchange (CER request / CEA answer), 280 is Device-Watchdog (DWR/DWA keepalive), 282 is Disconnect-Peer (DPR/DPA).',
      detail: `COMMAND CODE (24 bits, RFC 6733 §3 / §3.1): "The Command Code field is three octets and is used in order to communicate the command associated with the message."

BASE-PROTOCOL COMMANDS (request/answer pairs, distinguished by the R flag):
  257  Capabilities-Exchange   CER / CEA — first message after a connection opens; peers advertise identity, supported applications, and capabilities.
  258  Re-Auth                 RAR / RAA — server asks a client to re-authenticate/re-authorize a session.
  271  Accounting              ACR / ACA — carries accounting records (the base accounting application).
  274  Abort-Session           ASR / ASA — server tells a client to stop a session.
  275  Session-Termination     STR / STA — client tells the server a session has ended.
  280  Device-Watchdog         DWR / DWA — application-layer keepalive; detects a peer that has gone silent.
  282  Disconnect-Peer         DPR / DPA — graceful notice that a peer is about to close the transport connection.

The Command-Code space 0–255 is reserved for RADIUS backward compatibility; 16,777,214 and 16,777,215 (0xFFFFFE/FF) are reserved for experimental use. Application-specific commands (e.g. 3GPP, Diameter Credit-Control RFC 4006) define their own codes above the base set.`,
    },
    {
      name: 'applicationId',
      label: 'Application-ID',
      bits: 32,
      type: 'hex',
      decode: (v) =>
        v === 0
          ? '0 (Diameter common message / base)'
          : v === 3
            ? '3 (Diameter base accounting)'
            : v === 0xffffffff
              ? '0xFFFFFFFF (Relay)'
              : `0x${(v >>> 0).toString(16).toUpperCase().padStart(8, '0')}`,
      note: 'Which Diameter application this message belongs to; 0 = base/common, 3 = base accounting, 0xFFFFFFFF = Relay.',
      desc: 'A 32-bit identifier for the Diameter application the message belongs to, used in routing the message to the right application. The base protocol and capabilities exchange use 0; the base accounting application uses 3; the Relay application is 0xFFFFFFFF.',
      detail: `APPLICATION-ID (32 bits, RFC 6733 §3): "The Application-ID is four octets and is used to identify for which application the message is applicable. The application can be an authentication application, an accounting application, or a vendor-specific application."

WELL-KNOWN VALUES:
  0x00000000  Diameter common message (the base protocol itself — CER, DWR, DPR, etc.).
  0x00000001  NASREQ (Diameter Network Access Server application, RFC 7155).
  0x00000003  Diameter base accounting.
  0xFFFFFFFF  Relay (a Diameter relay agent that forwards any application).

Application-IDs in the range 0x00000000–0x00FFFFFF are allocated by IANA for standard and vendor-specific applications; 0x01000000–0xFFFFFFFE are for vendor-specific use. For a CER the header Application-ID MUST be 0 (the base protocol); the applications a peer actually supports are advertised inside the CER as Auth-Application-Id / Acct-Application-Id AVPs.`,
    },
    {
      name: 'hopByHopId',
      label: 'Hop-by-Hop Identifier',
      bits: 32,
      type: 'hex',
      note: 'Matches an answer to its request on a single link; rewritten by each agent and restored on the answer.',
      desc: 'A 32-bit value that pairs a request with its answer across a single Diameter connection (one hop). The sender picks it; the answer echoes it unchanged. A relay/proxy agent rewrites it to a locally unique value when forwarding, then restores the original when the answer comes back.',
      detail: `HOP-BY-HOP IDENTIFIER (32 bits, RFC 6733 §3): "an unsigned 32-bit integer field aids in matching requests and answers. The sender MUST ensure that the Hop-by-Hop Identifier in a request is unique on a given connection at any given time ... The sender of an answer message MUST ensure that the Hop-by-Hop Identifier field contains the same value that was found in the corresponding request."

HOP-BY-HOP, not end-to-end: this identifier has meaning only on ONE transport connection between two adjacent peers. When a Diameter agent (relay, proxy, redirect) forwards a request, it saves the original Hop-by-Hop ID, substitutes its own locally unique value on the outbound link, and restores the saved value when matching the returning answer. Implementations typically initialize it to a random value at startup and increment per request.`,
    },
    {
      name: 'endToEndId',
      label: 'End-to-End Identifier',
      bits: 32,
      type: 'hex',
      note: 'Stays constant across all hops; used by the originator to detect duplicate messages.',
      desc: 'A 32-bit value that stays unchanged from the originating client all the way to the final server and back, across any number of intermediate agents. It lets the originator correlate an answer with its request and detect duplicates (e.g. after a retransmission with the T flag).',
      detail: `END-TO-END IDENTIFIER (32 bits, RFC 6733 §3): "an unsigned 32-bit integer field is used to detect duplicate messages. Upon reception of a resent message with the T flag set, ... the End-to-End Identifier MUST be unique for at least 4 minutes ... This identifier MUST remain locally unique for a period of at least 4 minutes, even across reboots ... The originator ... MUST insert this field; the answering ... MUST ensure that the End-to-End Identifier field contains the same value that was found in the corresponding request."

CONTRAST WITH HOP-BY-HOP: the End-to-End ID is set ONCE by the original sender and travels unchanged through every relay/proxy, so it survives the whole path; the Hop-by-Hop ID is rewritten on each link. To avoid collisions the high 12 bits are recommended to be the low 12 bits of current time and the low 20 bits a random value (RFC 6733 §3). Duplicate detection: a server that sees the same (Origin-Host, End-to-End Identifier) pair within the dedup window treats the later one as a retransmission.`,
    },
  ],
  // Fixed 20-byte header. The 24-bit Message Length bounds the whole PDU
  // (header + padded AVPs), so trailing TCP/Ethernet bytes do not leak in.
  headerBytes: () => 20,
  pduBytes: (h) => h.get('messageLength'),
  // The Attribute-Value Pairs that follow are a variable TLV list with their own
  // sub-headers (AVP Code/Flags/Length [+Vendor-Id] + padded data), not a fixed
  // bit grid and not a separable child protocol — they fall through as payload.
  next: () => null,
};
