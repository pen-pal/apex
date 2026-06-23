// LLMNR — Link-Local Multicast Name Resolution. RFC 4795.
// LLMNR lets hosts on the same link resolve each other's names with NO DNS
// server configured (e.g. Windows "WORKGROUP" name lookups, mDNS's competitor).
// It REUSES the DNS message format (RFC 1035 section 4.1) but redefines three of
// the flag bits and runs on UDP/TCP port 5355 — queries go to the link-local
// multicast group 224.0.0.252 (IPv6: FF02::1:3), and the owner answers unicast.
//
// HEADER LAYOUT (RFC 4795 section 2.1.1), a fixed 12 bytes, identical in shape to
// the DNS header but with LLMNR-specific flag semantics:
//
//                                     1  1  1  1  1  1
//       0  1  2  3  4  5  6  7  8  9  0  1  2  3  4  5
//     +--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
//     |                      ID                       |
//     +--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
//     |QR|   Opcode  | C|TC| T| Z| Z| Z| Z|   RCODE   |
//     +--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
//     |                    QDCOUNT                    |
//     +--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
//     |                    ANCOUNT                    |
//     +--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
//     |                    NSCOUNT                    |
//     +--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
//     |                    ARCOUNT                    |
//     +--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
//
// Like DNS, the question/answer/authority/additional sections that follow are
// variable length and use domain-name encoding (length-prefixed labels), so they
// cannot be transcribed as fixed Field entries; they fall through as payload and
// dissection stops at the 12-byte header (next => null).
import type { ProtocolSpec } from '../core/types';

const OPCODE: Record<number, string> = {
  0: 'QUERY',
};

const RCODE: Record<number, string> = {
  0: 'NoError',
  1: 'FormErr',
  2: 'ServFail',
  4: 'NotImp',
  5: 'Refused',
};

export const llmnr: ProtocolSpec = {
  id: 'llmnr',
  name: 'LLMNR',
  layer: 7,
  summary:
    'Link-Local Multicast Name Resolution (RFC 4795): a serverless, DNS-formatted name lookup for hosts on the same link. A querier multicasts a question to 224.0.0.252 / FF02::1:3 on UDP 5355 and the name\'s owner replies unicast. The 12-byte header mirrors DNS but redefines three flag bits — C (conflict), T (tentative), and the dropped AA/RD/RA — and the variable name records follow as payload.',
  fields: [
    {
      name: 'transactionId',
      label: 'ID',
      bits: 16,
      type: 'hex',
      note: 'Matches a response to its query.',
      desc: 'A 16-bit identifier the sender assigns to a query and the responder copies verbatim into its reply, so the sender can pair an arriving answer with the question it asked.',
      detail: `ID (16 bits, RFC 4795 section 2.1.1): "A 16-bit identifier assigned by the program that generates any kind of query. This identifier is copied from the query to the corresponding response and can be used by the sender to match responses to outstanding queries."

Because LLMNR is multicast and connectionless, several hosts may reply to one query; each response echoes the same ID, and the sender uses the ID together with the source address and the question to sort the replies out.

ENDIANNESS: 16-bit big-endian (network order), like every multi-byte field here.`,
    },
    {
      name: 'qr',
      label: 'QR',
      bits: 1,
      decode: (v) => (v === 0 ? 'query (0)' : 'response (1)'),
      note: '0 = query, 1 = response.',
      desc: 'A single bit distinguishing a query (0) from a response (1). It is the most-significant bit of the 16-bit flags word that follows the ID.',
      detail: `QR (1 bit) is the first bit of the second 16-bit word. A querier multicasts QR=0; the host that owns the queried name answers with QR=1, copying the ID and the question. In a typical LLMNR query the whole flags word is 0x0000 (every bit, including QR, is 0).`,
    },
    {
      name: 'opcode',
      label: 'Opcode',
      bits: 4,
      type: 'enum',
      enumMap: OPCODE,
      note: '0 = standard QUERY; other values are reserved in LLMNR.',
      desc: 'A 4-bit operation code copied from the query into the response. LLMNR only defines the standard QUERY (0); RFC 4795 requires a responder to silently discard a query with any other opcode.',
      detail: `OPCODE (4 bits, RFC 4795 section 2.1.1): "A 4-bit field that specifies the kind of query in this message. This value is set by the originator of a query and copied into the response. This specification defines the behavior of standard queries and responses (opcode value of zero). Future specifications may define the use of other opcodes with LLMNR."

A sender MUST set OPCODE=0, and per the spec a responder silently discards a query whose OPCODE is non-zero — unlike DNS, LLMNR does not reuse the legacy IQUERY/STATUS opcodes. This model labels 0 = QUERY; any other value displays as its number.`,
    },
    {
      name: 'c',
      label: 'C (conflict)',
      bits: 1,
      decode: (v) => (v === 1 ? 'conflict detected (1)' : 'no conflict (0)'),
      note: 'Set in a RESPONSE when the responder has detected a name conflict.',
      desc: 'The Conflict bit, unique to LLMNR (it replaces DNS\'s AA bit at this position). A responder sets C=1 to tell the querier that the queried name is in conflict — more than one host on the link claims it — so the querier should not treat the answer as unique.',
      detail: `C — CONFLICT (1 bit, RFC 4795 section 2.1.1): "When set within a request, the 'c' bit is ignored. Within a response, the 'c' bit indicates whether a sender has verified uniqueness for a name." Per section 4.2, a responder sets C=1 when it knows the queried name is NOT unique on the link.

WHY LLMNR NEEDS THIS: LLMNR has no central registry, so two machines can both believe they own the same name. Name-uniqueness verification (section 4) has a host probe for its own name before using it; if another host answers, the name is in conflict. The C bit propagates that knowledge into responses so a querier learns the name is ambiguous.

POSITION: this is bit 5 of the flags word — exactly where DNS puts its Authoritative Answer (AA) bit. LLMNR repurposes it, which is why an LLMNR header cannot be parsed with DNS flag semantics.`,
    },
    {
      name: 'tc',
      label: 'TC',
      bits: 1,
      note: 'TrunCation — message did not fit and the query should be retried over TCP.',
      desc: 'Truncation: set in a response that exceeded the transport size limit. A querier that receives TC=1 should resend the query over TCP on port 5355 to retrieve the full answer.',
      detail: `TC — TRUNCATION (1 bit, RFC 4795 section 2.1.1): "the 'tc' (truncation) bit specifies that this message was truncated due to length greater than that permitted on the transmission channel."

Like DNS, a UDP LLMNR message that does not fit is sent truncated with TC=1; the querier then retries over TCP (also port 5355). Section 2.7 details the LLMNR-over-TCP fallback. Position: bit 6 of the flags word, the same bit DNS uses for TC.`,
    },
    {
      name: 't',
      label: 'T (tentative)',
      bits: 1,
      decode: (v) => (v === 1 ? 'tentative — name not yet verified unique (1)' : 'not tentative (0)'),
      note: 'Set in a RESPONSE whose name has not yet completed uniqueness verification.',
      desc: 'The Tentative bit, unique to LLMNR (it sits where DNS puts Recursion Desired). A responder sets T=1 to say the name it is answering for is still tentative — it has not yet finished verifying the name is unique on the link.',
      detail: `T — TENTATIVE (1 bit, RFC 4795 section 2.1.1): "The 't' bit is set in a response if the responder is authoritative for the name, but has not verified the uniqueness of the name."

NAME LIFECYCLE (section 4): a host that wants to use a name first probes it (sends LLMNR queries for its own name). Until that verification completes the name is "tentative." If the host must answer a query during this window it sets T=1 so the querier knows the answer is provisional and the name may still turn out to conflict.

POSITION: bit 7 of the flags word — the bit DNS assigns to Recursion Desired (RD). LLMNR drops the recursion concept entirely (there are no recursive resolvers on a link) and reuses the bit for T.`,
    },
    {
      name: 'z',
      label: 'Z',
      bits: 4,
      note: 'Reserved; must be zero in queries and responses.',
      desc: 'Four reserved bits (RFC 4795 shows them as four separate Z bits). They must be zero in every query and response and be ignored on receipt, leaving room for future flags.',
      detail: `Z — RESERVED (4 bits, RFC 4795 section 2.1.1): "Reserved for future use. These bits MUST be zero (0) in all queries and responses. If non-zero LLMNR packets are received, they should be silently discarded."

In the RFC's header diagram these occupy four adjacent bit cells (each labelled "Z"), bits 9-12 of the flags word, sitting between the T bit and RCODE. Note this is where DNS placed Recursion Available (RA) plus its own reserved/AD/CD bits — LLMNR consolidates that whole region into a single reserved Z field.`,
    },
    {
      name: 'rcode',
      label: 'RCODE',
      bits: 4,
      type: 'enum',
      enumMap: RCODE,
      note: '0 = NoError. Responders to a multicast query SHOULD NOT send an error.',
      desc: 'Response code: the responder reports the outcome here, with the same values as DNS. 0 = NoError. It is 0 in a query.',
      detail: `RCODE — RESPONSE CODE (4 bits, RFC 4795 section 2.1.1): "set as part of LLMNR responses" using the DNS RCODE values (RFC 1035):
- 0 NoError  — success
- 1 FormErr  — the responder could not interpret the query
- 2 ServFail — internal failure
- 4 NotImp   — the responder does not support the requested operation
- 5 Refused  — refused for policy reasons

MULTICAST QUIET RULE (section 2.1.1): "In LLMNR, this value is set as part of LLMNR responses. ... a responder MUST NOT respond [with an error] to a multicast query." A host that would only return an error to a multicast query stays silent instead, so the link is not flooded with NXDOMAIN-style replies — only the owner of a name answers.`,
    },
    {
      name: 'qdcount',
      label: 'QDCOUNT',
      bits: 16,
      note: 'Number of entries in the question section.',
      desc: 'The number of entries in the question section that follows the header. An LLMNR query carries exactly one question (a single name/type/class).',
      detail: `QDCOUNT (16 bits, RFC 4795 section 2.1.1): "an unsigned 16-bit integer specifying the number of entries in the question section. A sender MUST place only one question into the question section of a query; LLMNR responders MUST silently discard a query with QDCOUNT greater than one."

So unlike DNS — which merely conventionally uses one question — LLMNR makes a single question mandatory, and a multi-question packet is dropped.`,
    },
    {
      name: 'ancount',
      label: 'ANCOUNT',
      bits: 16,
      note: 'Resource records in the answer section.',
      desc: 'The number of resource records in the answer section. It is 0 in a query; a response carries one record per answer (e.g. each A/AAAA address for the queried name).',
      detail: `ANCOUNT (16 bits, RFC 4795 section 2.1.1): "an unsigned 16-bit integer specifying the number of resource records in the answer section."

A query sets ANCOUNT=0. In a response the owning host returns the addresses bound to its name — each A or AAAA record counts as one RR — so a dual-stack host answering a query for its name may return several records. The receiver reads exactly ANCOUNT records from the answer section after consuming the single question.`,
    },
    {
      name: 'nscount',
      label: 'NSCOUNT',
      bits: 16,
      note: 'Resource records in the authority section.',
      desc: 'The number of resource records in the authority section. LLMNR has no zone hierarchy, so this is normally 0 — the field exists only because LLMNR inherits the DNS header shape.',
      detail: `NSCOUNT (16 bits, RFC 4795 section 2.1.1): "an unsigned 16-bit integer specifying the number of name server resource records in the authority records section."

In DNS this section names the authoritative servers for a zone or carries the SOA on negative answers. LLMNR is link-local and serverless — there are no NS servers and no zones — so a conformant LLMNR query and the normal response leave NSCOUNT=0. It is carried purely because LLMNR reuses the 12-byte DNS header verbatim.`,
    },
    {
      name: 'arcount',
      label: 'ARCOUNT',
      bits: 16,
      note: 'Resource records in the additional section.',
      desc: 'The number of resource records in the additional section. LLMNR queries and typical responses set this to 0; the field is inherited from the DNS header.',
      detail: `ARCOUNT (16 bits, RFC 4795 section 2.1.1): "an unsigned 16-bit integer specifying the number of resource records in the additional records section."

In DNS this section carries glue records and the EDNS0 OPT pseudo-record. LLMNR does not define additional-section usage for the base protocol, so a standard query and response set ARCOUNT=0. As with NSCOUNT, the field is present only because LLMNR adopts the DNS header format wholesale.`,
    },
  ],
  // Fixed 12-byte header (RFC 4795 section 2.1.1), identical in size to DNS.
  // Everything after — the question/answer/authority/additional records — is
  // variable length and uses DNS-style length-prefixed name labels, so it is
  // left as payload rather than modeled as fixed fields.
  headerBytes: () => 12,
  // The record sections are not modeled as a child protocol (they use DNS name
  // encoding, not a fixed grid), so dissection stops here and the rest is payload.
  next: () => null,
};
