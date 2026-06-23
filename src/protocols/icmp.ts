// ICMP — Internet Control Message Protocol. RFC 792 (with type/code
// assignments extended by RFC 1122, RFC 1812 and the IANA ICMP registry).
// IPv4 carries ICMP in protocol number 1 (ipv4.ts dispatches 1 -> 'icmp').
//
// This spec models the common 4-byte ICMP header that EVERY ICMP message
// shares (Type, Code, Checksum) plus the 32-bit "Rest of Header" word. The
// meaning of that word is type-dependent: for Echo / Echo Reply it is an
// Identifier (16) + Sequence Number (16); for Destination Unreachable and
// Time Exceeded it is unused/reserved (and may carry the next-hop MTU for
// code 4, per RFC 1191). We expose it as a single 32-bit hex field and
// explain the per-type interpretation in the field's teaching text, rather
// than inventing fields that only apply to some message types.
//
// What follows the header (the ICMP payload) is also type-dependent: error
// messages (types 3, 4, 5, 11, 12) carry the IP header + first 8 bytes of the
// datagram that triggered them; Echo/Echo Reply carry arbitrary data the
// sender chose. We do not dissect that payload here — it falls through as
// node.payload.
import type { ProtocolSpec, BuildCtx } from '../core/types';
import { inetChecksum } from '../core/checksum';

// IANA ICMP Type registry (the originals are defined in RFC 792).
const ICMP_TYPE: Record<number, string> = {
  0: 'Echo Reply',
  3: 'Destination Unreachable',
  4: 'Source Quench (deprecated)',
  5: 'Redirect',
  8: 'Echo Request',
  9: 'Router Advertisement',
  10: 'Router Solicitation',
  11: 'Time Exceeded',
  12: 'Parameter Problem',
  13: 'Timestamp',
  14: 'Timestamp Reply',
};

export const icmp: ProtocolSpec = {
  id: 'icmp',
  name: 'ICMP',
  layer: 3,
  summary:
    'The control/diagnostics protocol of IPv4: ping (Echo/Echo Reply) plus error reports like Destination Unreachable and Time Exceeded.',
  fields: [
    {
      name: 'type',
      label: 'Type',
      bits: 8,
      type: 'enum',
      enumMap: ICMP_TYPE,
      note: '8 = Echo Request, 0 = Echo Reply, 3 = Unreachable, 11 = Time Exceeded.',
      desc: 'The kind of ICMP message. It is the first byte and selects everything else — query vs. error, and how to read the Code and the 32-bit Rest-of-Header word.',
      detail: `TYPE (8 bits, RFC 792 + IANA ICMP registry). ICMP messages split into two families:

QUERY / INFORMATIONAL (request + reply pairs):
- 8  = Echo Request   /  0 = Echo Reply        (ping)
- 13 = Timestamp      / 14 = Timestamp Reply
- 10 = Router Solicitation / 9 = Router Advertisement (RFC 1256)

ERROR REPORTS (generated when a datagram cannot be delivered):
- 3  = Destination Unreachable
- 4  = Source Quench    (deprecated by RFC 6633 — never generate it)
- 5  = Redirect         (tells a host a better first-hop router)
- 11 = Time Exceeded    (TTL hit 0, or fragment-reassembly timed out)
- 12 = Parameter Problem (a malformed IP header field)

WHY ECHO USES TWO TYPES: request and reply are different type numbers (8 and 0) rather than one type with a code, so a host can tell at a glance whether it must answer or merely match a reply it is waiting for.

ERROR-SUPPRESSION RULES (RFC 1812): to avoid storms, a host must NOT send an ICMP error about an ICMP error message, about a broadcast/multicast datagram, or about a non-initial fragment.`,
    },
    {
      name: 'code',
      label: 'Code',
      bits: 8,
      note: 'Sub-type that refines Type. For Echo/Echo Reply it is always 0.',
      desc: 'A sub-code that refines the Type. For Echo and Echo Reply it is always 0; for error types it pinpoints the reason (e.g. Type 3 Code 4 = "Fragmentation Needed and DF Set").',
      detail: `CODE (8 bits): meaning depends entirely on Type.

ECHO / ECHO REPLY (types 8 / 0): Code is always 0.

DESTINATION UNREACHABLE (type 3) codes (RFC 792 + 1122):
- 0 = Net Unreachable          - 1 = Host Unreachable
- 2 = Protocol Unreachable     - 3 = Port Unreachable
- 4 = Fragmentation Needed and DF Set  (drives Path MTU Discovery, RFC 1191)
- 5 = Source Route Failed      - 13 = Communication Administratively Prohibited (a firewall)

TIME EXCEEDED (type 11) codes:
- 0 = TTL exceeded in transit  (this is what traceroute reads at each hop)
- 1 = Fragment reassembly time exceeded

REDIRECT (type 5) codes: 0 = redirect for network, 1 = for host, 2/3 = for TOS+network/host.

PARAMETER PROBLEM (type 12): code 0 = pointer (the Rest-of-Header byte 0) indicates the bad octet.`,
    },
    {
      name: 'checksum',
      label: 'Checksum',
      bits: 16,
      type: 'hex',
      note: "One's-complement checksum over the entire ICMP message.",
      desc: 'The Internet checksum (RFC 1071) computed over the WHOLE ICMP message — header and payload — starting at the Type byte, with this field temporarily zero. Unlike the IPv4 checksum, ICMP covers its own payload.',
      detail: `ALGORITHM (RFC 792, using the RFC 1071 Internet checksum):
1. Set the Checksum field to 0x0000.
2. Sum every 16-bit big-endian word of the entire ICMP message (Type/Code through the last payload byte) into a 32-bit accumulator. If the message has an odd length, pad with one zero byte for the sum only.
3. Fold carries: while (sum >> 16) sum = (sum & 0xFFFF) + (sum >> 16).
4. Take the one's complement: ~sum & 0xFFFF.

SCOPE DIFFERS FROM IPv4: the IPv4 header checksum covers only the IP header. ICMP's checksum covers the ICMP header AND its payload — so for an error message it also protects the embedded copy of the offending IP header.

NO PSEUDO-HEADER: unlike TCP/UDP over IPv4, ICMP's checksum does NOT include a pseudo-header of the IP addresses (ICMPv6 does add one, which is one reason ICMPv4 and ICMPv6 checksums are not interchangeable).

VERIFICATION: summing all 16-bit words of an intact message, including the stored checksum, yields 0xFFFF.`,
    },
    {
      name: 'restOfHeader',
      label: 'Rest of Header',
      bits: 32,
      type: 'hex',
      note: 'Type-dependent. Echo/Echo Reply: Identifier (16) + Sequence (16). Errors: unused/MTU.',
      desc: 'A 32-bit word whose meaning depends on the Type. For Echo and Echo Reply it is an Identifier (high 16 bits) plus a Sequence Number (low 16 bits) used to match requests to replies; for most error messages it is unused (must be zero).',
      detail: `The four bytes after the checksum are defined per message type (RFC 792):

ECHO / ECHO REPLY (types 8 / 0):
- Identifier (16 bits): set by the sender so it can match replies to requests. The classic Unix ping puts its process ID here so concurrent pings don't collide.
- Sequence Number (16 bits): increments by 1 per request, so ping can report which probe each reply answers and compute per-probe RTT and loss.
(This spec keeps these as one 32-bit hex word; in a real Echo the high half is the Identifier and the low half is the Sequence Number.)

DESTINATION UNREACHABLE / SOURCE QUENCH / TIME EXCEEDED (types 3, 4, 11):
- The whole word is "unused" and must be zero when sent — EXCEPT type 3 code 4 (Fragmentation Needed), where RFC 1191 repurposes the low 16 bits to carry the Next-Hop MTU for Path MTU Discovery.

REDIRECT (type 5): the word holds the Gateway Internet Address — the better first-hop router the host should use.

PARAMETER PROBLEM (type 12): the high byte is a Pointer to the offending octet in the original IP header; the rest is unused.`,
    },
  ],
  // ICMP itself has no field that names a child protocol. Error messages embed
  // an IP header in their payload and queries carry opaque data, so we stop
  // dissecting here and let the bytes fall through as node.payload.
  next: () => null,
  encode: ({ payload }: BuildCtx) => {
    // Build an Echo Request (type 8, code 0) wrapping the payload, with a real
    // checksum over header + payload. Identifier 0x0001, Sequence 0x0001.
    const hdr = [0x08, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01];
    const ck = inetChecksum([...hdr, ...payload]);
    hdr[2] = (ck >> 8) & 255;
    hdr[3] = ck & 255;
    return hdr;
  },
};
