// Reverse Address Resolution Protocol. RFC 903 (1984).
// RARP is the mirror image of ARP (RFC 826): instead of "I know this IP, what
// MAC owns it?", a diskless host asks "I know my MAC, what is MY IP?". It was
// used by bootstrapping workstations (and later supplanted by BOOTP/DHCP, which
// carry far more configuration than just an address).
//
// On the wire RARP shares ARP's exact 28-byte packet structure and is carried
// directly in an Ethernet frame, but with EtherType 0x8035 (IANA-assigned)
// instead of ARP's 0x0806. The ONLY field that differs from a regular ARP
// packet is the opcode (ar$op): RFC 903 defines 3 = RARP request, 4 = RARP
// reply (opcodes 1/2 retain their ARP meaning and may be handed to ARP code).
//
// This spec models the canonical IPv4-over-Ethernet case: HTYPE=1 (Ethernet),
// PTYPE=0x0800 (IPv4), HLEN=6, PLEN=4 -> a fixed 28-byte packet. RARP is a leaf
// protocol with no encapsulated payload, so `next` returns null.
import type { ProtocolSpec } from '../core/types';

const HTYPE: Record<number, string> = { 1: 'Ethernet' };
const PTYPE: Record<number, string> = { 0x0800: 'IPv4' };
// RFC 903 §packet format: 3 = request reverse, 4 = reply reverse.
const OPER: Record<number, string> = { 3: 'RARP request', 4: 'RARP reply' };

export const rarp: ProtocolSpec = {
  id: 'rarp',
  name: 'RARP',
  layer: 2,
  summary: 'Lets a diskless host discover its own IPv4 address from its MAC by broadcasting "what is MY IP?" — ARP run in reverse (RFC 903).',
  fields: [
    {
      name: 'htype',
      label: 'Hardware type',
      bits: 16,
      type: 'enum',
      enumMap: HTYPE,
      note: 'The link-layer technology. 1 = Ethernet.',
      desc: 'Identifies the kind of hardware (link-layer) address involved. 1 means Ethernet, which is essentially the only value RARP was ever used with.',
      detail: `HARDWARE TYPE (ar$hrd, 16 bits) — RARP reuses ARP's packet format unchanged, so this is the same field as in ARP.

COMMON VALUES (IANA "Hardware Types" registry, ARPHRD):
- 1  = Ethernet (the value used in practice)
- 6  = IEEE 802 networks
- 7  = ARCNET

WHY IT EXISTS: like ARP, RARP is media-independent; the packet self-describes the address family so the receiver knows how wide the hardware-address fields are.`,
    },
    {
      name: 'ptype',
      label: 'Protocol type',
      bits: 16,
      type: 'hex',
      enumMap: PTYPE,
      note: 'The protocol address being discovered. 0x0800 = IPv4 (the EtherType for IP).',
      desc: 'Identifies the protocol-layer address RARP is resolving toward. The value reuses the Ethernet EtherType numbering; 0x0800 means IPv4 — the address the host is trying to learn.',
      detail: `PROTOCOL TYPE (ar$pro, 16 bits) — which network-layer address space RARP is mapping into.

As in ARP (RFC 826), this uses Ethernet EtherType numbering:
- 0x0800 = IPv4 (the address a RARP client wants for itself)
- 0x86DD = IPv6 (but IPv6 never used RARP)

The pairing (HTYPE=1, PTYPE=0x0800) is the canonical "discover my IPv4 over Ethernet" RARP packet.`,
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

WHY A LENGTH FIELD: the four address fields are variable width, so HLEN and PLEN tell the parser where each ends. This spec models HLEN=6 (Ethernet).`,
    },
    {
      name: 'plen',
      label: 'Protocol addr length',
      bits: 8,
      decode: (v) => `${v} bytes per protocol address`,
      note: 'Length of each protocol address in bytes. 4 for IPv4.',
      desc: 'The byte length of each protocol (network-layer) address. For IPv4 this is 4, matching a 32-bit address.',
      detail: `PROTOCOL ADDRESS LENGTH (ar$pln, 8 bits) — bytes in each protocol-address field.

- IPv4: 4 bytes (32 bits)

Together HLEN=6 and PLEN=4 fix the IPv4-over-Ethernet RARP packet at 28 bytes: 2+2+1+1+2 (fixed header) + 6+4+6+4 (the four address fields).`,
    },
    {
      name: 'oper',
      label: 'Operation',
      bits: 16,
      type: 'enum',
      enumMap: OPER,
      note: '3 = RARP request ("what is my IP?"), 4 = RARP reply (a server supplying it).',
      desc: 'The only field that distinguishes RARP from ARP. 3 = RARP request (a host asks for its own IP), 4 = RARP reply (a RARP server answers). RFC 903 reserves these; opcodes 1/2 keep their ARP meaning.',
      detail: `OPERATION / OPCODE (ar$op, 16 bits) — RARP's distinguishing field.

RFC 903 opcodes:
- 3 = RARP Request — "This is my hardware address; what is my IPv4 address?" Broadcast to ff:ff:ff:ff:ff:ff.
- 4 = RARP Reply   — a RARP server answers with the client's IPv4 address.

RFC 903 note: "An opcode of 1 or 2 has the same meaning as in [RFC 826]; packets with such opcodes may be passed on to regular ARP code." So the opcode is what tells a combined ARP/RARP stack which logic to run, even though the EtherType (0x8035) already separates RARP frames from ARP (0x0806).

WHY RARP FADED: a RARP server only hands back an IP address — nothing else (netmask, gateway, boot file). BOOTP (RFC 951) and then DHCP (RFC 2131) replaced it because they deliver full configuration, and they ride on UDP/IP so they can be relayed across routers, whereas RARP is link-local Ethernet only.`,
    },
    {
      name: 'sha',
      label: 'Sender hardware addr',
      bits: 48,
      type: 'mac',
      note: "The sender's MAC. In a RARP request this is the very key the host is looking its own IP up by.",
      desc: "The hardware (MAC) address of the sender. In a RARP request it is the host's own MAC — the lookup key it presents so a server can return the matching IP.",
      detail: `SENDER HARDWARE ADDRESS (ar$sha, HLEN=6 bytes here).

In a RARP REQUEST this is the requesting host's own MAC. Because the host has no IP yet, its MAC is the only identity it can present, and a RARP server keeps a MAC -> IP table keyed on exactly this value.

In a RARP REPLY the server typically echoes the client's MAC here as the sender hardware address of the response.`,
    },
    {
      name: 'spa',
      label: 'Sender protocol addr',
      bits: 32,
      type: 'ipv4',
      note: 'The sender IPv4 address. Unknown (0.0.0.0) in a request — discovering it is the whole point.',
      desc: "The sender's IPv4 address. In a RARP request the host does not yet know its own address, so this is typically 0.0.0.0; in a reply the server fills in the client's assigned address.",
      detail: `SENDER PROTOCOL ADDRESS (ar$spa, PLEN=4 bytes here).

In a RARP REQUEST the host has no IP, so this field has no meaningful value and is conventionally all zeros (0.0.0.0).

In a RARP REPLY this and the target protocol address carry the answer — the IPv4 address the diskless client should adopt.`,
    },
    {
      name: 'tha',
      label: 'Target hardware addr',
      bits: 48,
      type: 'mac',
      note: 'The target MAC — in a basic RARP request a host asks about its own MAC, so this repeats the sender MAC.',
      desc: 'The hardware (MAC) address of the target. When a host asks for its own IP it puts its own MAC here, so the target and sender hardware addresses match.',
      detail: `TARGET HARDWARE ADDRESS (ar$tha, HLEN=6 bytes here).

RARP's question is "what IP belongs to THIS MAC?", so the MAC being looked up lives in the target hardware-address field. For a host resolving its own address this equals the sender hardware address.

(The Ethernet frame's destination is the broadcast ff:ff:ff:ff:ff:ff — a separate field outside the RARP packet.)`,
    },
    {
      name: 'tpa',
      label: 'Target protocol addr',
      bits: 32,
      type: 'ipv4',
      note: 'The IPv4 address being discovered — empty (0.0.0.0) in a request, filled by the server in a reply.',
      desc: 'The protocol (IPv4) address corresponding to the target hardware address. This is the unknown in a RARP request (0.0.0.0); the server writes the resolved IPv4 address here in the reply.',
      detail: `TARGET PROTOCOL ADDRESS (ar$tpa, PLEN=4 bytes here) — the IPv4 address RARP is trying to discover.

In a RARP REQUEST this is the unknown, set to 0.0.0.0. In a RARP REPLY the RARP server fills it with the IPv4 address that maps to the target hardware address — the address the client will configure on its interface.`,
    },
  ],
  // Fixed 28-byte packet for IPv4-over-Ethernet (HLEN=6, PLEN=4). RARP is a leaf:
  // it carries no encapsulated payload.
  headerBytes: () => 28,
  next: () => null,
};
