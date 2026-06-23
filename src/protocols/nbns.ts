// NetBIOS Name Service (NBNS / NBT-NS) packet header. RFC 1002, section 4.2.1.1
// ("Protocol Standard for a NetBIOS Service on a TCP/UDP Transport: Detailed
//  Specifications"), with NBT framing context from RFC 1001. Runs over UDP 137.
//
// NBNS borrows the DNS message shape (RFC 1035): a fixed 12-byte header carrying
// a transaction ID, a packed flags word, and four 16-bit section counts, followed
// by question/resource records. The records use NetBIOS-encoded names (RFC 1001
// §4.1, "second-level encoding"): a 16-byte NetBIOS name is split into nibbles and
// each nibble mapped to a letter A-P, giving a 32-byte label. We model only the
// fixed 12-byte header here; the encoded names fall to node.payload.
import type { ProtocolSpec } from '../core/types';

// OPCODE values (RFC 1002 §4.2.1.1). The 4-bit OPCODE sits just below the R bit.
const OPCODE: Record<number, string> = {
  0: 'query',
  5: 'registration',
  6: 'release',
  7: 'WACK (wait for acknowledgement)',
  8: 'refresh',
};

// RCODE values (RFC 1002 §4.2.1.1) — result codes carried in responses.
const RCODE: Record<number, string> = {
  0x0: 'no error',
  0x1: 'FMT_ERR (format error)',
  0x2: 'SRV_ERR (server failure)',
  0x4: 'IMP_ERR (unsupported request)',
  0x5: 'RFS_ERR (refused)',
  0x6: 'ACT_ERR (name active error)',
  0x7: 'CFT_ERR (name in conflict)',
};

export const nbns: ProtocolSpec = {
  id: 'nbns',
  name: 'NetBIOS-NS',
  layer: 7,
  summary: 'NetBIOS Name Service: the DNS-shaped lookup that maps a 16-byte NetBIOS name to an IP on a LAN (the old Windows "browse list" / WINS protocol).',
  fields: [
    {
      name: 'transactionId',
      label: 'Transaction ID',
      bits: 16,
      type: 'hex',
      note: 'Matches a response back to its request.',
      desc: 'A 16-bit identifier (NAME_TRN_ID) chosen by the requester and echoed in the reply, so a client can pair each response with the request it sent.',
      detail: `NAME_TRN_ID (16 bits, RFC 1002 §4.2.1.1): "Transaction ID for Name Service Transaction. Requestor places a unique value for each active transaction. Responder puts NAME_TRN_ID value from request packet in response packet."

Exactly like the DNS message ID it is borrowed from (RFC 1035): the client picks a value, the server copies it verbatim, and the client uses it to demultiplex concurrent outstanding queries on the single well-known UDP socket (137).

SECURITY: a predictable transaction ID makes NBNS spoofing easy on a LAN — an attacker who can guess the ID and race the legitimate responder can poison the name->IP mapping. This is the basis of LLMNR/NBT-NS spoofing tools (e.g. Responder).`,
    },
    {
      name: 'response',
      label: 'Response (R)',
      bits: 1,
      decode: (v) => (v ? 'response' : 'request'),
      note: 'High bit of the flags word: 0 = request, 1 = response.',
      desc: 'The R bit. 0 marks this packet as a request (a client asking); 1 marks it as a response (the name server or name owner answering).',
      detail: `R — RESPONSE flag (RFC 1002 §4.2.1.1, bit 0 of the OPCODE byte):
- 0 = request packet
- 1 = response packet

It is the most-significant bit of the second 16-bit word, immediately above the 4-bit OPCODE. Together R and OPCODE occupy the top 5 bits of that word:

  0   1   2   3   4
+---+---+---+---+---+
| R |    OPCODE     |
+---+---+---+---+---+`,
    },
    {
      name: 'opcode',
      label: 'Opcode',
      bits: 4,
      type: 'enum',
      enumMap: OPCODE,
      note: '0 = name query; 5/6/8 = register/release/refresh.',
      desc: 'A 4-bit operation specifier: what kind of name-service transaction this is. 0 = query (resolve a name), 5 = registration, 6 = release, 7 = WACK, 8 = refresh.',
      detail: `OPCODE (4 bits, RFC 1002 §4.2.1.1, bits 1-4 of the OPCODE byte):
- 0 = query        — resolve a NetBIOS name to an IP (or check it exists)
- 5 = registration — claim a name (announce "I own this name")
- 6 = release      — give up a previously registered name
- 7 = WACK         — Wait for ACKnowledgement (a server tells a client to wait)
- 8 = refresh      — renew a registration before it times out

In NBT (NetBIOS over TCP/IP) these are the WINS / b-node operations: a host registers each of its names at startup, defends them, and releases them at shutdown. Name query (0) is the lookup direction this dissector's sample exercises.`,
    },
    {
      name: 'nmFlags',
      label: 'NM_FLAGS',
      bits: 7,
      type: 'flags',
      // RFC 1002 box, MSB-first within the 7-bit field:
      //   bit0 AA | bit1 TC | bit2 RD | bit3 RA | bit4 (0) | bit5 (0) | bit6 B
      flagBits: ['AA', 'TC', 'RD', 'RA', '0', '0', 'B'],
      note: 'AA=authoritative, TC=truncated, RD=recursion desired, RA=recursion available, B=broadcast.',
      desc: 'Seven control bits (NM_FLAGS) modelled on the DNS flags: AA (authoritative answer), TC (truncated), RD (recursion desired), RA (recursion available), two reserved zeros, and B (broadcast).',
      detail: `NM_FLAGS (7 bits, RFC 1002 §4.2.1.1). The RFC's MSB-first box:

  0   1   2   3   4   5   6
+---+---+---+---+---+---+---+
|AA |TC |RD |RA | 0 | 0 | B |
+---+---+---+---+---+---+---+

- AA (bit 0): Authoritative Answer. Must be 0 in a request (R=0).
- TC (bit 1): Truncation. Set if the message was truncated because the datagram would exceed 576 bytes.
- RD (bit 2): Recursion Desired. May only be set on a request to a NetBIOS Name Server (WINS) asking it to resolve on the client's behalf.
- RA (bit 3): Recursion Available. Only valid in responses from a NBNS; says the server will recurse.
- bits 4-5: reserved, must be 0.
- B  (bit 6): Broadcast. 1 = the packet was broadcast or multicast; 0 = unicast.

A classic LAN name query is broadcast with RD set (flags word 0x0110: RD=1, B=1) — "anyone who owns this name, please answer."`,
    },
    {
      name: 'rcode',
      label: 'RCODE',
      bits: 4,
      type: 'enum',
      enumMap: RCODE,
      note: 'Result code; only meaningful in responses. 0 = success.',
      desc: 'A 4-bit result code, the low nibble of the flags word. 0 in requests and successful responses; non-zero values report errors such as format error, server failure, refused, or name conflict.',
      detail: `RCODE (4 bits, RFC 1002 §4.2.1.1) — "Result codes of request." Only meaningful when R=1.
- 0x0 = no error
- 0x1 = FMT_ERR  Format Error.   Request was invalidly formatted.
- 0x2 = SRV_ERR  Server failure.  Problem with NBNS, cannot process name.
- 0x4 = IMP_ERR  Unsupported request error. Allowable only for challenging NBNS.
- 0x5 = RFS_ERR  Refused error.   For policy reasons the server will not handle it.
- 0x6 = ACT_ERR  Active error.    Name is owned by another node.
- 0x7 = CFT_ERR  Name in conflict error.

ACT_ERR (0x6) is the one that bites a registering host: "the name you're trying to claim is already in use" — the negative name-registration response.`,
    },
    {
      name: 'qdcount',
      label: 'QDCOUNT',
      bits: 16,
      note: 'Number of question (entry) records that follow.',
      desc: 'The number of entries in the question section that follow the header. A name query carries exactly 1 question; counts of 0 are typical for some responses.',
      detail: `QDCOUNT (16 bits, RFC 1002 §4.2.1.1) — "an unsigned 16 bit integer specifying the number of entries in the question section of a Name Service packet."

This is the DNS-derived "number of questions" count. A NBNS name query sets QDCOUNT=1 and carries a single Question Entry: an encoded NetBIOS name (32 bytes), a 16-bit QUESTION_TYPE (0x0020 NB / 0x0021 NBSTAT), and a 16-bit QUESTION_CLASS (0x0001 IN). Those encoded-name records live in this dissection's payload, beyond the fixed 12-byte header.`,
    },
    {
      name: 'ancount',
      label: 'ANCOUNT',
      bits: 16,
      note: 'Number of answer resource records.',
      desc: 'The number of resource records in the answer section. 0 in a request; a positive value in a response that carries the resolved address record(s).',
      detail: `ANCOUNT (16 bits, RFC 1002 §4.2.1.1) — "number of resource records in the answer section of a Name Service packet."

In a positive name-query response this is the count of ADDR_ENTRY records (each a 2-byte NB_FLAGS group/unique + ownership bits, plus a 4-byte IPv4 address) returned for the queried name. A name can resolve to several addresses (a multihomed host or a group name).`,
    },
    {
      name: 'nscount',
      label: 'NSCOUNT',
      bits: 16,
      note: 'Number of authority resource records.',
      desc: 'The number of resource records in the authority section. Almost always 0 in NBNS; present only because the header mirrors the DNS layout.',
      detail: `NSCOUNT (16 bits, RFC 1002 §4.2.1.1) — "number of resource records in the authority section of a Name Service packet."

Inherited verbatim from the DNS header (RFC 1035). NetBIOS name service rarely populates an authority section, so this field is typically 0; it exists to keep the four-count header structurally identical to DNS.`,
    },
    {
      name: 'arcount',
      label: 'ARCOUNT',
      bits: 16,
      note: 'Number of additional resource records.',
      desc: 'The number of resource records in the additional-records section. Often 0; used by some registration/redirect exchanges.',
      detail: `ARCOUNT (16 bits, RFC 1002 §4.2.1.1) — "number of resource records in the additional records section of a Name Service packet."

Like NSCOUNT, this is the DNS "additional records" count carried over unchanged. NBNS uses it in a few cases — for example a redirect name query response places the redirecting NBNS's address record in the additional section — but it is 0 in an ordinary broadcast name query.`,
    },
  ],
  // Fixed 12-byte header. The encoded NetBIOS-name question/resource records that
  // follow are variable-length and fall to node.payload (we do not model them).
  headerBytes: () => 12,
  // Stop here: what follows are NetBIOS second-level-encoded names (RFC 1001 §4.1),
  // not a registered child protocol.
  next: () => null,
};
