// SOCKS Protocol Version 5 — client request. RFC 1928 (1996).
// SOCKS5 is a generic, application-agnostic proxying protocol that runs over
// TCP, conventionally on port 1080. A client opens a TCP connection to the
// proxy and the exchange proceeds in three phases:
//
//   1. METHOD NEGOTIATION (RFC 1928 §3): client sends VER + NMETHODS + a list
//      of authentication methods; server replies with the one METHOD it chose
//      (e.g. X'00' no-auth, X'02' username/password per RFC 1929).
//   2. (optional) METHOD-SPECIFIC SUB-NEGOTIATION, e.g. username/password auth.
//   3. THE REQUEST (RFC 1928 §4) — modelled here — telling the proxy what to do.
//
// This spec models the PHASE-3 CLIENT REQUEST, the packet that says "connect me
// to this destination". Its fixed 4-byte prefix is (RFC 1928 §4):
//
//   +----+-----+-------+------+----------+----------+
//   |VER | CMD |  RSV  | ATYP | DST.ADDR | DST.PORT |
//   +----+-----+-------+------+----------+----------+
//   | 1  |  1  | X'00' |  1   | Variable |    2     |
//   +----+-----+-------+------+----------+----------+
//
// VER  = X'05' (SOCKS version 5)
// CMD  = X'01' CONNECT | X'02' BIND | X'03' UDP ASSOCIATE
// RSV  = X'00' reserved
// ATYP = X'01' IPv4 (4 octets) | X'03' domain name (1 length octet + that many
//        octets, no NUL terminator) | X'04' IPv6 (16 octets)
//
// WHY ONLY THE 4-BYTE PREFIX IS MODELLED AS FIELDS
// ------------------------------------------------
// After ATYP come DST.ADDR and DST.PORT, but DST.ADDR's WIDTH is not fixed: it
// depends on the ATYP value (4, 1+N, or 16 bytes), and for a domain name even
// its length lives in the first address octet. There is no field "at bit offset
// 32 for K bits" that is true for every request, so transcribing DST.ADDR /
// DST.PORT as fixed-width `Field`s would be a lie about the wire for the domain
// and IPv6 cases. We therefore model the honest fixed prefix (VER/CMD/RSV/ATYP),
// set headerBytes() => 4, and let DST.ADDR + DST.PORT fall through as the
// node.payload — the byte view shows their real bytes. For the common IPv4
// CONNECT (ATYP=1) the payload is exactly 6 bytes: 4 address + 2 port (network
// order). The proxy's reply (RFC 1928 §6: VER REP RSV ATYP BND.ADDR BND.PORT)
// shares this layout but is a separate message and is not modelled here.
//
// There is no further protocol to dissect generically (the address+port are raw
// values, not an encapsulated PDU), so `next` returns null.
import type { ProtocolSpec } from '../core/types';

const CMD: Record<number, string> = {
  1: 'CONNECT',
  2: 'BIND',
  3: 'UDP ASSOCIATE',
};

const ATYP: Record<number, string> = {
  1: 'IPv4 address',
  3: 'Domain name',
  4: 'IPv6 address',
};

export const socks: ProtocolSpec = {
  id: 'socks',
  name: 'SOCKS5',
  layer: 7,
  summary:
    'A generic proxying protocol over TCP/1080. After method negotiation the client sends a request — VER(5), CMD (CONNECT/BIND/UDP), RSV, ATYP — followed by the destination address (width set by ATYP) and a 2-byte port. Apex models the fixed 4-byte prefix; the address+port follow as payload.',
  fields: [
    {
      name: 'ver',
      label: 'Version',
      bits: 8,
      type: 'uint',
      note: 'SOCKS protocol version. Always 5 (0x05) for SOCKS5.',
      desc: 'The SOCKS protocol version. For a SOCKS5 request this is always 5 (0x05); it is the first byte of every SOCKS message so the proxy can pick the right parser.',
      detail: `VERSION (VER, 1 byte) = X'05' for SOCKS5 (RFC 1928).

SOCKS5 superseded SOCKS4 (a de-facto protocol, never an RFC), adding:
- IPv6 and domain-name destinations (the ATYP field),
- UDP relaying (the UDP ASSOCIATE command),
- a real authentication-method negotiation (username/password per RFC 1929, GSS-API per RFC 1961).

Every message in the exchange — the method-negotiation greeting, this request, and the server reply — begins with this version byte, so a value other than 0x05 means the peer is not speaking SOCKS5 and the connection is aborted.`,
    },
    {
      name: 'cmd',
      label: 'Command',
      bits: 8,
      type: 'enum',
      enumMap: CMD,
      note: '1 = CONNECT (open a TCP connection to the destination), 2 = BIND, 3 = UDP ASSOCIATE.',
      desc: 'What the client wants the proxy to do. CONNECT (1) is by far the most common: "open a TCP connection to DST.ADDR:DST.PORT and relay bytes for me".',
      detail: `COMMAND (CMD, 1 byte) — the action requested of the proxy (RFC 1928 §4):

- X'01' CONNECT — establish an outbound TCP connection to DST.ADDR:DST.PORT and proxy the byte stream. This is what a browser or curl uses to tunnel HTTPS through a SOCKS proxy.
- X'02' BIND — ask the proxy to LISTEN on a port and accept ONE inbound connection, then relay it. Used by protocols that need the peer to connect back, classically active-mode FTP's data channel. The proxy sends two replies: first the bound address it is listening on, then a second reply when the peer connects.
- X'03' UDP ASSOCIATE — set up a UDP relay. The TCP connection that carried this request stays open to keep the association alive; datagrams are then sent to the proxy's relay port wrapped in a small UDP request header (RFC 1928 §7).

The server answers with a reply whose REP field is 0 (succeeded) or a numbered error (e.g. 2 = connection not allowed by ruleset, 5 = connection refused, 4 = host unreachable).`,
    },
    {
      name: 'rsv',
      label: 'Reserved',
      bits: 8,
      type: 'uint',
      note: "Reserved, must be 0x00. Senders set it to zero; receivers ignore it.",
      desc: 'A reserved byte that must be set to 0x00. It carries no information in SOCKS5 and exists only to keep the fixed prefix byte-aligned and leave room for future use.',
      detail: `RESERVED (RSV, 1 byte) = X'00' (RFC 1928 §4).

It must be sent as zero. The same reserved byte appears in the server reply (§6) and in the UDP request header (§7). A strict proxy may reject a request whose RSV is non-zero, though many implementations simply ignore the value on receipt.`,
    },
    {
      name: 'atyp',
      label: 'Address type',
      bits: 8,
      type: 'enum',
      enumMap: ATYP,
      note: '1 = IPv4 (4 bytes follow), 3 = domain name (1 length byte + name), 4 = IPv6 (16 bytes follow).',
      desc: 'How to interpret the DST.ADDR bytes that follow this prefix, AND how many of them there are: 1 = a 4-byte IPv4 address, 3 = a length-prefixed domain name, 4 = a 16-byte IPv6 address.',
      detail: `ADDRESS TYPE (ATYP, 1 byte) — determines the FORMAT and WIDTH of DST.ADDR (RFC 1928 §4/§5):

- X'01' IPv4   — DST.ADDR is exactly 4 octets (a 32-bit address in network order).
- X'03' DOMAIN — DST.ADDR's FIRST octet is a length N, followed by N octets of the host name. There is NO trailing NUL. Letting the proxy resolve the name (remote DNS) is a privacy win — the client's resolver never sees the hostname, and it works even when the client cannot resolve it locally.
- X'04' IPv6   — DST.ADDR is exactly 16 octets (a 128-bit address in network order).

This is why this spec stops its fixed fields after ATYP: the very next field's width is not knowable until ATYP is read. The 2-byte DST.PORT always follows DST.ADDR, big-endian. For the IPv4 CONNECT case the trailing payload is therefore 6 bytes (4 + 2).`,
    },
  ],
  // The fixed prefix is VER+CMD+RSV+ATYP = 4 bytes. DST.ADDR (width set by ATYP)
  // and the 2-byte DST.PORT follow as node.payload; for ATYP=1 (IPv4) that is
  // exactly 4 + 2 = 6 bytes.
  headerBytes: () => 4,
  // The destination address and port are raw values, not an encapsulated child
  // PDU, so dissection stops here.
  next: () => null,
};
