// DHCP (Dynamic Host Configuration Protocol) message.
// RFC 2131 (DHCP message format, section 2) and RFC 951 (the BOOTP frame it
// extends). The hardware-type codes are from RFC 1700 / the IANA "ARP Hardware
// Types" registry. The 0x63825363 magic cookie is from RFC 1497 / RFC 2132.
//
// DHCP rides over UDP: client -> server on port 67, server -> client on port 68.
//
// Everything from `op` through `file` is the fixed 236-byte BOOTP frame; the
// 4-byte magic cookie that opens DHCP's options area makes 240 fixed bytes.
// The actual DHCP options are a variable-length TLV (tag/length/value) list and
// are NOT modelled as fields here — they fall through as this layer's payload.
// (See the `next`/header note below.)
import type { ProtocolSpec } from '../core/types';

const OP: Record<number, string> = { 1: 'BOOTREQUEST', 2: 'BOOTREPLY' };

// IANA ARP hardware type codes (a small selection); 1 = Ethernet is by far the
// most common on DHCP networks.
const HTYPE: Record<number, string> = {
  1: 'Ethernet (10Mb)',
  6: 'IEEE 802 Networks',
  7: 'ARCNET',
  11: 'LocalTalk',
  16: 'ATM',
  20: 'Serial Line',
};

export const dhcp: ProtocolSpec = {
  id: 'dhcp',
  name: 'DHCP',
  layer: 7,
  summary:
    'How a host gets an IP lease (and gateway, DNS, etc.) with no prior configuration: a fixed BOOTP frame, a magic cookie, then a TLV list of options.',
  fields: [
    {
      name: 'op',
      label: 'Op code',
      bits: 8,
      type: 'enum',
      enumMap: OP,
      note: '1 = request (client -> server), 2 = reply (server -> client).',
      desc: 'The BOOTP message direction: 1 (BOOTREQUEST) is sent by a client, 2 (BOOTREPLY) is sent by a server. It does NOT name the DHCP message type (DISCOVER/OFFER/REQUEST/ACK) — that lives in option 53.',
      detail: `OP (1 octet, RFC 951 / RFC 2131):
- 1 = BOOTREQUEST — every client-originated message (DISCOVER, REQUEST, DECLINE, RELEASE, INFORM) carries op=1.
- 2 = BOOTREPLY — every server-originated message (OFFER, ACK, NAK) carries op=2.

WHY IT IS NOT THE DHCP MESSAGE TYPE: DHCP is layered on top of BOOTP, so op only conveys the coarse request/reply direction it inherited from BOOTP. The specific DHCP message type (1=DISCOVER, 2=OFFER, 3=REQUEST, 4=DECLINE, 5=ACK, 6=NAK, 7=RELEASE, 8=INFORM) is carried in DHCP option 53, which lives in the variable options area after the magic cookie. A DHCP DISCOVER therefore has op=1 here and option 53 = 1 later.`,
    },
    {
      name: 'htype',
      label: 'Hardware type',
      bits: 8,
      type: 'enum',
      enumMap: HTYPE,
      note: 'ARP hardware type; 1 = Ethernet.',
      desc: 'The type of hardware address in the chaddr field, using the IANA ARP hardware-type codes. 1 means Ethernet, which is almost always the value seen.',
      detail: `HTYPE (1 octet): shares the IANA "ARP Hardware Types" registry with ARP's hardware-type field (originally RFC 1700).
- 1 = Ethernet (10Mb) — the overwhelmingly common value
- 6 = IEEE 802 Networks | 7 = ARCNET | 11 = LocalTalk
- 16 = ATM | 20 = Serial Line

It tells the receiver how to interpret chaddr (and, with hlen, how many of chaddr's 16 bytes are significant). For Ethernet, htype=1 and hlen=6.`,
    },
    {
      name: 'hlen',
      label: 'Hardware address length',
      bits: 8,
      decode: (v) => `${v} bytes of chaddr are significant`,
      note: 'Length in bytes of the client hardware address; 6 for Ethernet/MAC.',
      desc: 'How many bytes of the 16-byte chaddr field actually hold the hardware address. For an Ethernet MAC this is 6; the remaining 10 bytes of chaddr are zero padding.',
      detail: `HLEN (1 octet): the number of significant bytes in chaddr.
- 6 for Ethernet/IEEE-802 (a 48-bit MAC)
- 0 is used by some relay/identifier-only messages

chaddr is a fixed 16-byte field, so hlen tells the receiver where the address ends and zero padding begins. Reading more than hlen bytes of chaddr would pull in padding, not address.`,
    },
    {
      name: 'hops',
      label: 'Hops',
      bits: 8,
      note: 'Relay-agent hop count; clients set it to 0.',
      desc: 'Used by relay agents (DHCP helpers). The client always sets it to 0; each relay that forwards the message increments it, bounding how far a request can be relayed.',
      detail: `HOPS (1 octet): set to 0 by the client. A BOOTP/DHCP relay agent (an "ip helper-address" on a router) increments hops by 1 each time it forwards the message toward a server that lives on a different subnet.

WHY RELAYS EXIST: DHCP DISCOVER is broadcast, and routers do not forward broadcasts. The relay agent receives the broadcast, fills in giaddr, increments hops, and unicasts it to the configured server, then relays the reply back. Servers commonly ignore messages whose hop count exceeds a limit (often 16) to prevent loops.`,
    },
    {
      name: 'xid',
      label: 'Transaction ID',
      bits: 32,
      type: 'hex',
      note: 'Random ID chosen by the client; ties a reply to its request.',
      desc: 'A random 32-bit number the client picks for a configuration exchange. The server echoes it in its replies so the client can match an OFFER/ACK to the DISCOVER/REQUEST it sent.',
      detail: `XID (4 octets): chosen randomly by the client and reused across all the messages of one exchange (DISCOVER, the matching OFFER, REQUEST, and ACK all share the same xid).

WHY IT MATTERS: a client may have several configuration attempts in flight, and many servers may answer one broadcast DISCOVER. The xid lets the client correlate which reply belongs to which request, and lets it discard answers meant for some other host's exchange. It should be random so that off-link parties cannot trivially guess it and spoof a reply.`,
    },
    {
      name: 'secs',
      label: 'Seconds elapsed',
      bits: 16,
      decode: (v) => `${v} s since the client began acquiring/renewing`,
      note: 'Seconds since the client started trying to get/renew an address.',
      desc: 'Seconds elapsed since the client started the acquisition or renewal process. Relay agents and backup servers can watch this to decide when to step in for a struggling client.',
      detail: `SECS (2 octets): filled in by the client; counts seconds since it began trying to acquire or renew a lease.

USE: in environments with a primary and a secondary DHCP server, the secondary may be configured to stay silent until secs crosses a threshold, giving the primary first chance to answer. A rising secs value across retransmissions also signals that the client is not getting a usable reply.`,
    },
    {
      name: 'flags',
      label: 'Flags',
      bits: 16,
      type: 'flags',
      // RFC 2131: the leftmost (most-significant) bit is BROADCAST; the other 15
      // are reserved and MUST be zero. flagBits[0] is the MSB.
      flagBits: [
        'Broadcast',
        'MBZ', 'MBZ', 'MBZ', 'MBZ', 'MBZ', 'MBZ', 'MBZ',
        'MBZ', 'MBZ', 'MBZ', 'MBZ', 'MBZ', 'MBZ', 'MBZ', 'MBZ',
      ],
      note: 'Top bit = Broadcast; the other 15 bits must be zero.',
      desc: 'A 16-bit flags field whose only defined bit is the leftmost Broadcast (B) flag. When set, the client is asking the server to broadcast its reply instead of unicasting it; the other 15 bits must be zero.',
      detail: `FLAGS (2 octets, RFC 2131):
- The most-significant bit (value 0x8000; RFC 2131 Figure 2 numbers it "bit 0" under its MSB-first convention): BROADCAST (B). The remaining 15 bits are reserved and MUST be 0 (shown here as MBZ = "must be zero").
- 0x8000 means Broadcast set; 0x0000 means unicast preferred.

WHY THE BROADCAST FLAG: before a client has an IP, some IP stacks (and some relays) cannot receive a unicast reply addressed to an IP they do not yet own, because hardware/ARP filtering may drop it. Setting B asks the server to send its OFFER/ACK to the IP limited broadcast 255.255.255.255 (carried in a link-layer broadcast ff:ff:ff:ff:ff:ff) so the unconfigured client is guaranteed to hear it. Many modern clients can receive the unicast reply and leave B clear (0x0000).`,
    },
    {
      name: 'ciaddr',
      label: 'Client IP address',
      bits: 32,
      type: 'ipv4',
      note: 'Client IP — only filled when the client already owns one.',
      desc: "The client's own IP address, but only when it is already configured (states BOUND, RENEW, or REBINDING) and can reply to ARP for it. It is 0.0.0.0 in DISCOVER and in the initial REQUEST.",
      detail: `CIADDR (4 octets): the client fills this in ONLY when it already has a usable address and is verifying or renewing it — i.e. the BOUND, RENEWING, or REBINDING states.

- DISCOVER: 0.0.0.0 (the client has no address yet)
- REQUEST (selecting, after an OFFER): 0.0.0.0 (the requested address goes in option 50, not here)
- REQUEST (renewing a lease): the client's current address
- RELEASE / INFORM: the client's current address

So a value of 0.0.0.0 here is the normal sign of a host that is bootstrapping from scratch.`,
    },
    {
      name: 'yiaddr',
      label: 'Your (client) IP address',
      bits: 32,
      type: 'ipv4',
      note: "The address the server is giving the client; 0.0.0.0 in client messages.",
      desc: '"Your IP address" — the address the SERVER is assigning to the client, set in OFFER and ACK. In any client-sent message (DISCOVER/REQUEST) it is 0.0.0.0.',
      detail: `YIADDR (4 octets): set by the server, not the client. It is the actual address being offered or confirmed.

- DISCOVER / REQUEST (from the client): 0.0.0.0
- OFFER (from the server): the candidate address being offered
- ACK (from the server): the address the lease is granted on

This is the field a client reads to learn which address it just got — distinct from option 50 ("Requested IP Address"), which is how the client ASKS for a specific address.`,
    },
    {
      name: 'siaddr',
      label: 'Next-server IP address',
      bits: 32,
      type: 'ipv4',
      note: 'IP of the next server in bootstrap (e.g. TFTP), not the DHCP server.',
      desc: 'The address of the next server a client should contact in a multi-step bootstrap — typically a TFTP/PXE server for network booting — supplied by the server in OFFER/ACK. It is not the DHCP server itself.',
      detail: `SIADDR (4 octets): "server IP address; returned in DHCPOFFER, DHCPACK by server." Despite the name it is NOT the DHCP server's own address (that is conveyed in option 54). It points to the next server used in the boot sequence.

PXE / NETWORK BOOT: in a diskless or PXE boot, siaddr (together with the "file" field below) tells the client where to download the boot image — historically a TFTP server. For an ordinary host just getting an IP lease, siaddr is 0.0.0.0.`,
    },
    {
      name: 'giaddr',
      label: 'Relay agent (gateway) IP address',
      bits: 32,
      type: 'ipv4',
      note: 'Filled by a relay agent so the server knows which subnet to serve.',
      desc: "Set by the first DHCP relay agent that forwards the message, NOT by the client. The server uses it to pick the right address pool/subnet and to know where to send the reply. It is 0.0.0.0 when there is no relay.",
      detail: `GIADDR (4 octets): the relay agent (gateway) IP. The client always sends 0.0.0.0; the first relay agent that handles a broadcast DISCOVER writes its own interface address here.

TWO JOBS IT DOES FOR THE SERVER:
1. Subnet selection — giaddr tells the server which subnet the client is on (the client itself has no address yet), so the server picks the correct pool.
2. Return path — the server unicasts its reply back to giaddr, and the relay then delivers it onto the client's link.

If giaddr is 0.0.0.0 the server treats the client as being on the same link (no relay involved).`,
    },
    {
      name: 'chaddr',
      label: 'Client hardware address',
      bits: 128, // 16 octets; wide field -> read as bytes
      type: 'bytes',
      note: 'Client MAC, padded to 16 bytes (only hlen bytes are significant).',
      desc: "The client's hardware address (its MAC), held in a fixed 16-byte field. Only the first hlen bytes are meaningful (6 for Ethernet); the rest are zero padding. The server keys leases off this.",
      detail: `CHADDR (16 octets): a fixed-width field that holds a variable-length hardware address. Only the leading hlen bytes are the address (an Ethernet MAC uses 6, e.g. 00:0b:82:01:fc:42), and the remaining bytes are zero.

WHY IT MATTERS: chaddr is the primary identity a DHCP server uses to recognize a returning client and offer it the same lease, to enforce per-MAC reservations, and to track which host holds which address. Note that a client may instead supply DHCP option 61 ("Client Identifier"); when present, that option — not chaddr — is the canonical key, but chaddr is still required so relays and ARP can reach the client.

Modeled here as a 16-byte blob ('bytes'); the first 6 bytes are the MAC.`,
    },
    {
      name: 'sname',
      label: 'Server host name',
      bits: 512, // 64 octets
      type: 'bytes',
      note: 'Optional null-terminated server name (64 bytes); usually all zero.',
      desc: 'An optional 64-byte, null-terminated server host name string. Usually empty (all zeros). RFC 2132 "option overload" can repurpose this space to carry extra DHCP options when the options area runs short.',
      detail: `SNAME (64 octets): an optional null-terminated ASCII server host name, typically supplied only in BOOTP-style boot scenarios and left all-zero otherwise.

OPTION OVERLOAD (RFC 2132 option 52): when a server needs more option space than the options area provides, it can set option 52 to signal that this sname field (and/or the file field) is being reused to carry additional DHCP options instead of a name. Absent that, sname is just a name string or zeros.

Modeled here as a 64-byte blob ('bytes').`,
    },
    {
      name: 'file',
      label: 'Boot file name',
      bits: 1024, // 128 octets
      type: 'bytes',
      note: 'Optional null-terminated boot-file path (128 bytes); usually all zero.',
      desc: 'An optional 128-byte, null-terminated boot file name (a path), used with siaddr for network/PXE booting. Empty for an ordinary lease. Like sname it can be repurposed via option overload.',
      detail: `FILE (128 octets): an optional null-terminated boot file name. In a DISCOVER the client may leave it empty or put a generic name; the server returns the fully qualified path in its reply.

NETWORK BOOT: paired with siaddr (the next-server address), file names the image a diskless/PXE client downloads (historically via TFTP). For a plain address lease it is all zeros.

OPTION OVERLOAD: as with sname, RFC 2132 option 52 can declare this field reused to carry DHCP options instead of a file name.

Modeled here as a 128-byte blob ('bytes').`,
    },
    {
      name: 'magicCookie',
      label: 'Magic cookie',
      bits: 32,
      type: 'hex',
      decode: (v) =>
        v === 0x63825363 ? '0x63825363 — valid DHCP options follow' : `0x${v.toString(16)} (not the DHCP cookie)`,
      note: 'Fixed 0x63825363 (99.130.83.99) — marks the start of the options area.',
      desc: 'A fixed four-byte sentinel, decimal 99.130.83.99 = 0x63825363, that begins the options field. It distinguishes a DHCP/RFC 1497-vendor message from a plain BOOTP message and tells the parser that TLV options follow.',
      detail: `MAGIC COOKIE (4 octets) = 99, 130, 83, 99 = 0x63825363 (RFC 1497, carried into RFC 2131/2132).

It is literally the first four octets of the BOOTP "vendor extensions" / DHCP "options" field. Its presence is what lets a receiver know the bytes that follow are RFC 1497-style tagged options (and, for DHCP, that option 53 will identify the message type) rather than opaque vendor data.

WHAT COMES AFTER (not modeled as fields here): a variable-length list of TLV options — each is [tag (1 byte)][length (1 byte)][value (length bytes)] — terminated by the End option, tag 255 (0xFF). Tag 0 is a Pad. Because option ordering and lengths are arbitrary at runtime, the engine treats everything after this cookie as this layer's payload rather than fixed fields.`,
    },
  ],
  // op..file is 236 bytes of fixed BOOTP frame; +4 magic cookie = 240 bytes.
  // The variable TLV options after the cookie are this layer's payload.
  headerBytes: () => 240,
  // The options are application-defined TLVs, not another framed protocol, so
  // there is no child layer to dissect — stop here and let them fall through as
  // payload.
  next: () => null,
};
