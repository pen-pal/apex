// DHCPv6 — Dynamic Host Configuration Protocol for IPv6.
// RFC 8415 (consolidates and obsoletes RFC 3315 + others). DHCPv6 runs over UDP:
// clients listen on port 546, servers and relay agents on port 547. Clients send
// to the well-known multicast address ff02::1:2 (All_DHCP_Relay_Agents_and_Servers).
//
// TWO MESSAGE LAYOUTS (RFC 8415 §8):
//
// 1) CLIENT/SERVER messages (msg-type 1-11) — modeled here:
//      0                   1                   2                   3
//      0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
//     +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//     |    msg-type   |               transaction-id                  |
//     +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//     |                            options ...                        |
//   A FIXED 4-byte header: msg-type (1 octet) + transaction-id (3 octets), then
//   a variable list of options.
//
// 2) RELAY-FORW / RELAY-REPL messages (msg-type 12 / 13) — NOT this layout:
//   They replace the 3-octet transaction-id with hop-count (1 octet),
//   link-address (16 octets) and peer-address (16 octets) — a 34-byte fixed
//   header — followed by options (which must include a Relay Message option
//   carrying the encapsulated client/server message). This spec models the
//   client/server header only; a relayed message would need its own layout, so
//   we note it on the msg-type field rather than mis-parsing it.
//
// OPTIONS ARE TLV (RFC 8415 §21):
//   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//   |          option-code          |           option-len          |
//   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//   |                          option-data                          |
//   option-code (2 octets) + option-len (2 octets, length of option-data only)
//   + option-data (option-len octets). Common codes: 1 = OPTION_CLIENTID (a DUID),
//   2 = OPTION_SERVERID, 3 = OPTION_IA_NA (Identity Association for Non-temporary
//   Addresses), 6 = OPTION_ORO (Option Request), 8 = OPTION_ELAPSED_TIME,
//   25 = OPTION_IA_PD (Prefix Delegation). Options are byte-aligned but not
//   self-describing as a fixed grid, so they fall through as node.payload; the
//   byte view then shows the real option-code/option-len bytes.
import type { ProtocolSpec } from '../core/types';

// RFC 8415 §7.3 — DHCPv6 message types.
const MSG_TYPE: Record<number, string> = {
  1: 'SOLICIT',
  2: 'ADVERTISE',
  3: 'REQUEST',
  4: 'CONFIRM',
  5: 'RENEW',
  6: 'REBIND',
  7: 'REPLY',
  8: 'RELEASE',
  9: 'DECLINE',
  10: 'RECONFIGURE',
  11: 'INFORMATION-REQUEST',
  12: 'RELAY-FORW',
  13: 'RELAY-REPL',
};

export const dhcpv6: ProtocolSpec = {
  id: 'dhcpv6',
  name: 'DHCPv6',
  layer: 7,
  summary:
    'IPv6 address/prefix and configuration assignment over UDP (client port 546, server port 547). A client/server message is a tiny 4-byte header — a message type plus a 24-bit transaction id to match replies to requests — followed by a variable list of TLV options (Client/Server DUIDs, IA_NA addresses, IA_PD prefixes, the Option Request list). Apex models the fixed 4-byte header; the options follow as the TLV payload. Relay messages (types 12/13) use a different, larger header (note on msg-type).',
  fields: [
    {
      name: 'msgType',
      label: 'Message type',
      bits: 8,
      type: 'enum',
      enumMap: MSG_TYPE,
      note: 'The DHCPv6 message type. 1 = SOLICIT (client searching for servers). Types 12/13 are RELAY messages with a different header.',
      desc: 'The first octet identifies the DHCPv6 message. For client/server exchanges it is 1-11 (e.g. 1 SOLICIT, 2 ADVERTISE, 3 REQUEST, 7 REPLY). Values 12 (RELAY-FORW) and 13 (RELAY-REPL) are relay-agent messages and use a completely different header layout — this spec models only the client/server header.',
      detail: `MESSAGE TYPE (8 bits, RFC 8415 §7.3):

CLIENT/SERVER MESSAGES (this 4-byte header):
   1 SOLICIT              client multicasts to locate available servers
   2 ADVERTISE            a server offers itself in response to a Solicit
   3 REQUEST              client requests config/addresses from one chosen server
   4 CONFIRM              client checks its addresses are still valid on this link
   5 RENEW                client extends its leases with the original server (T1)
   6 REBIND               client extends leases with ANY server (T2, original silent)
   7 REPLY                server's authoritative answer (leases, status, config)
   8 RELEASE              client returns addresses it no longer needs
   9 DECLINE              client reports an address as already in use (DAD failed)
  10 RECONFIGURE          server tells a client to re-run Renew/Information-Request
  11 INFORMATION-REQUEST  stateless: ask for config (DNS, NTP) but NOT addresses

RELAY MESSAGES (DIFFERENT, LARGER HEADER — not this layout):
  12 RELAY-FORW           relay agent -> server; encapsulates the client message
  13 RELAY-REPL           server -> relay agent; encapsulates the reply

The four-message "stateful" flow mirrors DHCPv4's DORA but with IPv6 names:
SOLICIT -> ADVERTISE -> REQUEST -> REPLY. A client that has already chosen a
server via the Rapid Commit option can shortcut to SOLICIT -> REPLY.

RELAY LAYOUT (RFC 8415 §9): msg-type(1) + hop-count(1) + link-address(16) +
peer-address(16) + options. There is no transaction-id; the relayed client/server
message rides inside an OPTION_RELAY_MSG (code 9). Because the field after
msg-type is hop-count, not transaction-id, a relay message MUST NOT be parsed
with the client/server transaction-id field below.`,
    },
    {
      name: 'transactionId',
      label: 'Transaction ID',
      bits: 24,
      type: 'hex',
      note: '24-bit value chosen by the client; the server copies it into the reply so the client can match response to request.',
      desc: 'A 24-bit (3-octet) opaque value the client picks for a message exchange. The server echoes it unchanged in its reply, letting the client pair each response with the request it sent — DHCPv6 runs over connectionless UDP, so this id is how the two sides correlate messages.',
      detail: `TRANSACTION-ID (24 bits, RFC 8415 §16.1):

"The transaction-id MUST be unique for each transaction" — the client generates a
fresh, ideally random value for each new exchange (Solicit, Request, Renew, …).
The server (or relay-reply) copies it verbatim so the client can discard stray or
stale replies that do not match an outstanding request.

WHY 24 BITS, AND WHY RANDOM: DHCPv6 has no transport-level connection; UDP
datagrams to the multicast/relay address can arrive duplicated or out of order.
A random 24-bit id (0 - 16,777,215) both matches replies and makes it harder for
an off-path attacker to forge a response, since they must guess the id.

ENDIANNESS: the 3 octets are in network (big-endian) order, e.g. bytes
6f f5 33 = 0x6ff533.

CONTRAST WITH RELAY MESSAGES: in a Relay-forward/Relay-reply (types 12/13) these
same 3 octet positions are NOT a transaction-id — they are the first 3 bytes of
hop-count(1)+link-address(16). The relayed inner message keeps its own id.`,
    },
  ],
  // Fixed 4-byte client/server header: msg-type (1) + transaction-id (3).
  // The options are a variable TLV list and fall through as node.payload.
  headerBytes: () => 4,
  // Options (OPTION_CLIENTID, OPTION_IA_NA, OPTION_ORO, …) are a recursive TLV
  // stream, not a fixed grid, so we stop here and let them be the payload.
  next: () => null,
};
