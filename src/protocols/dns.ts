// DNS message header. RFC 1035 (section 4.1.1), with the AD/CD bits from
// RFC 4035/RFC 2535 noted under the Z field and the extended RCODE space from
// RFC 6895. DNS rides on UDP port 53 (and TCP 53 for large responses/zone
// transfers). This spec models ONLY the fixed 12-byte header. The question,
// answer, authority, and additional sections that follow are variable length
// and use domain-name compression pointers (RFC 1035 section 4.1.4), so they
// cannot be expressed as fixed Field entries; they fall through as payload.
import type { ProtocolSpec } from '../core/types';

const OPCODE: Record<number, string> = {
  0: 'QUERY',
  1: 'IQUERY',
  2: 'STATUS',
};

const RCODE: Record<number, string> = {
  0: 'NoError',
  1: 'FormErr',
  2: 'ServFail',
  3: 'NXDOMAIN',
  4: 'NotImp',
  5: 'Refused',
};

export const dns: ProtocolSpec = {
  id: 'dns',
  name: 'DNS',
  layer: 7,
  summary: 'The application-layer name protocol: a 12-byte header of an ID, a 16-bit flags word, and four section counts, followed by the question/answer records.',
  fields: [
    {
      name: 'transactionId',
      label: 'Transaction ID',
      bits: 16,
      type: 'hex',
      note: 'Matches a response to its query.',
      desc: 'A 16-bit identifier chosen by the client and copied verbatim into the response. The resolver uses it (with the source port and question) to pair an arriving answer with the outstanding query.',
      detail: `PURPOSE: DNS over UDP is connectionless, so there is no socket-level association between a query and its reply. The client picks a random 16-bit ID, and the server echoes it unchanged. The resolver only accepts a response whose ID, source address/port, and question match what it sent.

SECURITY — CACHE POISONING: with only 65,536 possible IDs, an off-path attacker who can guess (or brute-force) the ID and race the real server can inject a forged answer. Dan Kaminsky's 2008 attack showed this was practical, which is why modern resolvers ALSO randomize the UDP source port (RFC 5452) — combining ~16 bits of ID entropy with ~16 bits of port entropy makes blind spoofing far harder. DNS cookies (RFC 7873) and DNSSEC (RFC 4035) provide stronger defenses.

ENDIANNESS: 16-bit big-endian, like every multi-byte field in the header.`,
    },
    {
      name: 'qr',
      label: 'QR',
      bits: 1,
      decode: (v) => (v === 0 ? 'query (0)' : 'response (1)'),
      note: '0 = query, 1 = response.',
      desc: 'A single bit distinguishing a query (0) from a response (1). It is the most-significant bit of the 16-bit flags word that follows the ID.',
      detail: `QR is the first bit of the second 16-bit word of the header. A query and the response to it share the same Transaction ID and (normally) the same question, so QR is what tells them apart on the wire.

In the flags byte 0x01 0x00 of a typical recursive query, QR=0. A response to it would have QR=1, e.g. flags 0x81 0x80 (QR=1, RD=1, RA=1).`,
    },
    {
      name: 'opcode',
      label: 'Opcode',
      bits: 4,
      type: 'enum',
      enumMap: OPCODE,
      note: '0 = standard QUERY (almost always).',
      desc: 'A 4-bit field set by the originator and copied into the response, naming the kind of query. 0 = standard QUERY; the inverse-query and status opcodes are essentially unused today.',
      detail: `VALUES (RFC 1035, extended by later RFCs):
- 0 QUERY  — a standard query (the overwhelming majority of traffic)
- 1 IQUERY — inverse query; obsoleted by RFC 3425, effectively never seen
- 2 STATUS — server status request; not used in practice
- 4 NOTIFY (RFC 1996) — a primary tells a secondary the zone changed
- 5 UPDATE (RFC 2136) — dynamic DNS updates (used by DHCP servers, AD)

The Opcode occupies the 4 bits immediately after the QR bit (most-significant first). This model labels 0/1/2 from RFC 1035; higher opcodes display as their number.`,
    },
    {
      name: 'aa',
      label: 'AA',
      bits: 1,
      note: 'Authoritative Answer (responses).',
      desc: 'Authoritative Answer: in a response, 1 means the responding server is authoritative for the queried name (it owns the zone), rather than answering from cache. Meaningless in a query.',
      detail: `AA distinguishes an answer that comes from the zone's own authoritative data from one served out of a recursive resolver's cache. A response from 8.8.8.8 for example.com will typically have AA=0 (cached/recursive), while the actual authoritative name server for the zone sets AA=1.

CAVEAT (RFC 1035): AA applies to the name in the question section. With CNAME chains the bit corresponds to the name that matched the query, not necessarily every name in the answer.`,
    },
    {
      name: 'tc',
      label: 'TC',
      bits: 1,
      note: 'TrunCation — answer did not fit.',
      desc: 'Truncation: 1 means the message was truncated because it exceeded the transport size limit. Over UDP this tells the client to retry the query over TCP.',
      detail: `Historically a UDP DNS message was limited to 512 bytes (RFC 1035). If the answer did not fit, the server set TC=1 and returned what it could; the client then re-sent the query over TCP (port 53), which has no such size cap.

EDNS0 (RFC 6891) lets a client advertise a larger UDP buffer (e.g. 1232 or 4096 bytes) via an OPT pseudo-record in the additional section, reducing how often TCP fallback is needed. TC=1 can still occur, and TC is also relevant to amplification-attack mitigation (small truncated answers force the more expensive TCP path on spoofed sources).`,
    },
    {
      name: 'rd',
      label: 'RD',
      bits: 1,
      note: 'Recursion Desired — set by the client.',
      desc: 'Recursion Desired: set by the client to ask the server to resolve the name fully on its behalf (following referrals) rather than just returning a referral. Copied into the response.',
      detail: `RD=1 is what a stub resolver (your OS) sends to a recursive resolver: "please do all the work and give me the final answer." RD=0 is an iterative query, used between resolvers and authoritative servers — an authoritative server with RD=0 returns its best referral (NS records for a closer zone) instead of chasing the answer.

In the canonical recursive query the flags word is 0x0100, whose only set bit is RD. Authoritative-only servers may ignore RD entirely.`,
    },
    {
      name: 'ra',
      label: 'RA',
      bits: 1,
      note: 'Recursion Available (responses).',
      desc: 'Recursion Available: set by the server in a response to indicate whether it supports recursive queries. A query carries RA=0.',
      detail: `RA is the server's advertisement of capability. A recursive resolver sets RA=1 in its responses; an authoritative-only server sets RA=0 even if the client asked for recursion (RD=1), and answers iteratively.

If a client sends RD=1 but gets back RA=0, recursion was not performed — the client must iterate itself or use a different resolver. An open resolver that sets RA=1 for the whole internet is a common DDoS-amplification risk.`,
    },
    {
      name: 'z',
      label: 'Z',
      bits: 3,
      note: 'Reserved; later split into Z, AD, CD bits.',
      desc: 'Three bits that RFC 1035 reserved and required to be zero. Later DNSSEC work subdivided this region: the middle bit became AD (Authentic Data) and the low bit became CD (Checking Disabled).',
      detail: `RFC 1035 defined all three bits as Z, "reserved for future use; must be zero in all queries and responses."

DNSSEC (RFC 4035, originally RFC 2535) then reassigned two of them within the flags word:
- The high bit of this trio remains Z (must be 0).
- The middle bit is AD (Authentic Data): a security-aware resolver sets it when the data was DNSSEC-validated.
- The low bit is CD (Checking Disabled): a client sets it to ask the resolver NOT to perform DNSSEC validation, so the client can validate itself.

This model groups the trio as a single 3-bit Z field per RFC 1035; in a plain (non-DNSSEC) query all three bits are 0, so the distinction does not change the parsed value here.`,
    },
    {
      name: 'rcode',
      label: 'RCODE',
      bits: 4,
      type: 'enum',
      enumMap: RCODE,
      note: '0 = NoError, 3 = NXDOMAIN.',
      desc: 'Response code: the server reports the outcome here. 0 = NoError; 3 = NXDOMAIN (the name does not exist). It is 0 in a query.',
      detail: `VALUES (RFC 1035, names per the IANA DNS RCODEs registry):
- 0 NoError  — successful
- 1 FormErr  — the server could not interpret the query
- 2 ServFail — internal failure (often a DNSSEC validation failure or upstream timeout)
- 3 NXDOMAIN — the queried name definitively does not exist
- 4 NotImp   — the server does not support this opcode/query
- 5 Refused  — refused for policy reasons (e.g. recursion or zone transfer not allowed)

EXTENDED RCODE: this header field is only 4 bits (0-15). EDNS0 (RFC 6891) adds 8 more high-order bits in the OPT record, and TSIG/TKEY add more, extending the space to 16 bits — that is how codes like 16 BADVERS and 23 BADCOOKIE are expressed even though they do not fit here.`,
    },
    {
      name: 'qdcount',
      label: 'QDCOUNT',
      bits: 16,
      note: 'Number of entries in the question section.',
      desc: 'The number of entries in the question section that follows the header. For a normal lookup this is exactly 1.',
      detail: `Almost every real query has QDCOUNT=1 — a single (name, type, class) question such as "www.example.com, A, IN." The protocol allows more, but resolvers in practice handle only one question per message, and there is no defined way to carry per-question response codes for multiple questions.

QDCOUNT=0 appears in some special messages (e.g. certain EDNS0 keepalive or DNS Cookie probes). The four count fields (QD/AN/NS/AR) together tell a parser exactly how many records to read out of the variable sections after this header.`,
    },
    {
      name: 'ancount',
      label: 'ANCOUNT',
      bits: 16,
      note: 'Number of resource records in the answer section.',
      desc: 'The number of resource records in the answer section. It is 0 in a query; a response carries one record per answer (e.g. each A record for a name).',
      detail: `In a response, ANCOUNT counts the resource records that directly answer the question — for an A-record lookup, each IPv4 address is one RR, so a name with three addresses yields ANCOUNT=3. A CNAME answer adds the CNAME RR plus the records for its target, so ANCOUNT can exceed the number of addresses.

A query sets ANCOUNT=0. The receiver reads exactly ANCOUNT records from the answer section after consuming the QDCOUNT questions.`,
    },
    {
      name: 'nscount',
      label: 'NSCOUNT',
      bits: 16,
      note: 'Resource records in the authority section.',
      desc: 'The number of resource records in the authority section, which names the authoritative servers (NS records) for the zone or, in referrals, the next zone to query.',
      detail: `The authority section carries NS records pointing at the name servers responsible for the zone. In an iterative referral (RD=0), an authoritative server that does not have the answer returns the NS records of a closer zone here, and the matching A/AAAA "glue" records in the additional section.

NSCOUNT also carries the SOA record in negative responses: an NXDOMAIN or empty-NoError answer includes the zone's SOA in the authority section so the resolver knows how long it may cache the negative result (RFC 2308).`,
    },
    {
      name: 'arcount',
      label: 'ARCOUNT',
      bits: 16,
      note: 'Resource records in the additional section.',
      desc: 'The number of resource records in the additional section, which holds extra helpful records — glue addresses for referrals, and the EDNS0 OPT pseudo-record.',
      detail: `The additional section carries records that are not direct answers but help the client: "glue" A/AAAA records giving the addresses of the NS servers named in the authority section (so the client need not look them up separately), and SIG/extra records.

EDNS0 (RFC 6891): the OPT pseudo-record lives here. It is not real DNS data — it repurposes a resource-record shape to advertise the sender's UDP payload size, the extended RCODE bits, the DNSSEC-OK (DO) flag, and options like client subnet and cookies. So even a "query" often has ARCOUNT=1 carrying a single OPT record.`,
    },
  ],
  // The header is a fixed 12 bytes (RFC 1035 section 4.1.1). Everything after it
  // — the question/answer/authority/additional records — is variable length and
  // uses name-compression pointers, so it is left as payload rather than modeled
  // as fixed fields.
  headerBytes: () => 12,
  // DNS is the top of this stack here: the record sections are not modeled as a
  // child protocol, so dissection stops at the header and the rest is payload.
  next: () => null,
};
