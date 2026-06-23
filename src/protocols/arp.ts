// Address Resolution Protocol. RFC 826 (1982).
// ARP maps a protocol address (here an IPv4 address) to a hardware address
// (here a 48-bit Ethernet MAC) on a single link. This spec models the canonical
// 28-byte IPv4-over-Ethernet ARP packet: HTYPE=1, PTYPE=0x0800, HLEN=6, PLEN=4.
//
// The packet is technically variable-length — the four address fields are
// HLEN/PLEN bytes wide (RFC 826 ar$sha/ar$spa/ar$tha/ar$tpa). We model the
// universally deployed IPv4-over-Ethernet case with fixed 48-bit MAC and 32-bit
// IPv4 address fields; other media/protocol combinations are out of scope here.
// ARP is a leaf protocol carried directly in an Ethernet frame (EtherType
// 0x0806); it has no payload of its own, so there is no `next`.
import type { ProtocolSpec } from '../core/types';

const HTYPE: Record<number, string> = { 1: 'Ethernet' };
const PTYPE: Record<number, string> = { 0x0800: 'IPv4' };
const OPER: Record<number, string> = { 1: 'request', 2: 'reply' };

export const arp: ProtocolSpec = {
  id: 'arp',
  name: 'ARP',
  layer: 2,
  summary: 'Resolves an IPv4 address to a MAC address on the local link by broadcasting "who has this IP?" and getting a unicast reply.',
  fields: [
    {
      name: 'htype',
      label: 'Hardware type',
      bits: 16,
      type: 'enum',
      enumMap: HTYPE,
      note: 'The link-layer technology. 1 = Ethernet.',
      desc: 'Identifies the kind of hardware (link-layer) address being resolved to. 1 means Ethernet, which is almost the only value you ever see in practice.',
      detail: `HARDWARE TYPE (ar$hrd, 16 bits) — the medium whose addresses ARP is resolving.

COMMON VALUES (IANA "Hardware Types" registry, ARPHRD):
- 1  = Ethernet (10/100/1000/...; by far the most common)
- 6  = IEEE 802 networks
- 7  = ARCNET
- 15 = Frame Relay
- 16 = ATM
- 17 = HDLC
- 18 = Fibre Channel
- 20 = Serial Line

WHY IT EXISTS: ARP was designed to be media-independent, so the packet self-describes the address family it is mapping. The hardware type tells the receiver how wide the hardware-address fields (ar$sha / ar$tha) are and how to interpret them.`,
    },
    {
      name: 'ptype',
      label: 'Protocol type',
      bits: 16,
      type: 'hex',
      enumMap: PTYPE,
      note: 'The protocol address being resolved. 0x0800 = IPv4 (the EtherType for IP).',
      desc: 'Identifies the protocol-layer address that ARP is resolving. The value reuses the Ethernet EtherType numbering; 0x0800 means IPv4.',
      detail: `PROTOCOL TYPE (ar$pro, 16 bits) — which network-layer address ARP is mapping to a hardware address.

RFC 826 specifies that this field uses the same numbering as the Ethernet type field, so the values are EtherTypes:
- 0x0800 = IPv4 (the only value in everyday ARP)
- 0x0806 = ARP itself
- 0x8035 = RARP
- 0x86DD = IPv6 (but IPv6 does NOT use ARP — it uses Neighbor Discovery over ICMPv6)

WHY REUSE ETHERTYPES: it let ARP slot directly into the existing Ethernet address space without inventing a parallel registry. The pairing (HTYPE=1, PTYPE=0x0800) is the canonical "IPv4 over Ethernet" ARP.`,
    },
    {
      name: 'hlen',
      label: 'Hardware addr length',
      bits: 8,
      decode: (v) => `${v} bytes per hardware address`,
      note: 'Length of each hardware address in bytes. 6 for Ethernet MACs.',
      desc: 'The byte length of each hardware (MAC) address in this packet. For Ethernet this is 6, matching a 48-bit MAC.',
      detail: `HARDWARE ADDRESS LENGTH (ar$hln, 8 bits) — bytes in each of the two hardware-address fields.

- Ethernet / 802 MAC: 6 bytes (48 bits)

WHY A LENGTH FIELD: because the four address fields are variable width, the parser needs HLEN and PLEN to know where each one ends. The sender and target hardware addresses are each exactly HLEN bytes; the sender and target protocol addresses are each exactly PLEN bytes. This spec models the HLEN=6 case (Ethernet); a different value would change every subsequent field offset.`,
    },
    {
      name: 'plen',
      label: 'Protocol addr length',
      bits: 8,
      decode: (v) => `${v} bytes per protocol address`,
      note: 'Length of each protocol address in bytes. 4 for IPv4.',
      desc: 'The byte length of each protocol (network-layer) address. For IPv4 this is 4, matching a 32-bit address.',
      detail: `PROTOCOL ADDRESS LENGTH (ar$pln, 8 bits) — bytes in each of the two protocol-address fields.

- IPv4: 4 bytes (32 bits)
- IPv6: would be 16 bytes — but IPv6 uses Neighbor Discovery (RFC 4861), not ARP

Together HLEN=6 and PLEN=4 fix the total IPv4-over-Ethernet ARP packet at 28 bytes: 2+2+1+1+2 (fixed header) + 6+4+6+4 (the four address fields).`,
    },
    {
      name: 'oper',
      label: 'Operation',
      bits: 16,
      type: 'enum',
      enumMap: OPER,
      note: '1 = request ("who has this IP?"), 2 = reply ("I have it, here is my MAC").',
      desc: 'Whether this is an ARP request (1) asking for the MAC behind a target IP, or a reply (2) supplying it. The request is broadcast; the reply is unicast.',
      detail: `OPERATION / OPCODE (ar$op, 16 bits):
- 1 = Request  — "Who has Target IP? Tell Sender IP." Broadcast to ff:ff:ff:ff:ff:ff.
- 2 = Reply    — "Target IP is at this MAC." Sent unicast back to the requester.

RELATED OPCODES (RARP/InARP extensions, IANA registry):
- 3 = RARP Request, 4 = RARP Reply (RFC 903)
- 8 = InARP Request, 9 = InARP Reply (RFC 2390)

REQUEST vs REPLY ON THE WIRE: in a request the Target Hardware Address (ar$tha) is unknown and conventionally set to all zeros; the requester fills in everything else. The replier swaps sender/target, writes its own MAC into the sender hardware field, and sets oper=2.

GRATUITOUS ARP: a host announces itself by sending a request (or reply) for its OWN IP — Sender IP == Target IP. It pre-populates neighbors' caches and detects duplicate-address conflicts. ARP has no authentication, so a forged reply enables ARP-spoofing / man-in-the-middle attacks; switches mitigate with Dynamic ARP Inspection.`,
    },
    {
      name: 'sha',
      label: 'Sender hardware addr',
      bits: 48,
      type: 'mac',
      note: "The sender's MAC address — the answer in a reply.",
      desc: "The hardware (MAC) address of the sender. In a request this advertises the asker's MAC; in a reply it is the resolved answer the requester was looking for.",
      detail: `SENDER HARDWARE ADDRESS (ar$sha, HLEN=6 bytes here).

It is always filled in, in both requests and replies, with the MAC of the host originating this packet.

KEY INSIGHT: even a request teaches the network something. When host A broadcasts "who has 10.0.0.5?", every host on the link sees A's IP -> A's MAC binding (Sender Protocol Address + Sender Hardware Address) and may cache it. That is why a request is broadcast but a reply can be unicast — the target already learned the requester's MAC from the request.

In a REPLY, this field is the whole point: it carries the MAC that answers the original "who has?" question.`,
    },
    {
      name: 'spa',
      label: 'Sender protocol addr',
      bits: 32,
      type: 'ipv4',
      note: "The sender's IPv4 address.",
      desc: "The protocol (IPv4) address of the sender. Receivers cache the (Sender IP -> Sender MAC) binding from this and the sender-hardware field.",
      detail: `SENDER PROTOCOL ADDRESS (ar$spa, PLEN=4 bytes here) — the sender's IPv4 address.

CACHE POPULATION: the pair (Sender Protocol Address, Sender Hardware Address) is exactly the IP->MAC mapping that every receiver may install in its ARP cache. RFC 826's processing rule: a host updates its cache for the sender if it already had an entry, and additionally creates one if it is the target of the packet.

GRATUITOUS ARP: setting Sender Protocol Address == Target Protocol Address announces or defends ownership of an address (failover, duplicate-address detection).

ARP PROBE (RFC 5227, address-conflict detection): a host about to claim an address sends a request with Sender Protocol Address = 0.0.0.0 so it does not pollute caches before the address is confirmed free.`,
    },
    {
      name: 'tha',
      label: 'Target hardware addr',
      bits: 48,
      type: 'mac',
      note: 'The target MAC. All-zeros in a request (it is what we are asking for).',
      desc: 'The hardware (MAC) address of the intended target. In a request it is unknown and conventionally all zeros; in a reply it is the original requester’s MAC.',
      detail: `TARGET HARDWARE ADDRESS (ar$tha, HLEN=6 bytes here).

IN A REQUEST: this is the unknown being resolved, so it is ignored on receipt and conventionally set to 00:00:00:00:00:00. (Note: the Ethernet frame's destination is the broadcast ff:ff:ff:ff:ff:ff — a separate field outside the ARP packet — not this one.)

IN A REPLY: it holds the MAC of the host that asked, so the reply can be delivered as a unicast.

This field is one reason ARP is media-independent: its width is dictated by HLEN, not hardcoded.`,
    },
    {
      name: 'tpa',
      label: 'Target protocol addr',
      bits: 32,
      type: 'ipv4',
      note: 'The IPv4 address being resolved ("who has this IP?").',
      desc: 'The protocol (IPv4) address being resolved. In a request this is the IP whose MAC we want; the host that owns it answers, every other host stays silent.',
      detail: `TARGET PROTOCOL ADDRESS (ar$tpa, PLEN=4 bytes here) — the IPv4 address ARP is trying to resolve.

REQUEST SEMANTICS: only the host configured with this exact IP responds; all others ignore the request. This is why ARP works only within a single broadcast domain / subnet — a request for an off-link address is never sent (the host ARPs for its default gateway's IP instead and routes through it).

GRATUITOUS ARP / PROBE: Target Protocol Address = the address being announced or tested, while Target Hardware Address is zero (we do not yet know, or do not care, who currently holds it).`,
    },
  ],
  // Fixed 28-byte packet for IPv4-over-Ethernet (HLEN=6, PLEN=4). ARP is a leaf:
  // it carries no encapsulated payload, so `next` is intentionally absent.
};
