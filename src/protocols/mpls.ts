// MPLS label stack entry. RFC 3032 (MPLS Label Stack Encoding, January 2001),
// §2.1 "Encoding the Label Stack". The 3-bit field RFC 3032 called "Exp"
// (Experimental Use) was formally renamed the Traffic Class (TC) field by
// RFC 5462 (February 2009); both names refer to the same three bits.
//
// MPLS (Multiprotocol Label Switching) sits between the link layer and the
// network layer — it is often called "layer 2.5". A Label Switching Router (LSR)
// forwards a packet purely on its 20-bit label via a label lookup, swapping the
// label and decrementing the TTL at each hop, without ever inspecting the inner
// IP header. Labels are pushed/swapped/popped to steer packets along a
// pre-established Label Switched Path (LSP).
//
// THE LABEL STACK: more than one 4-byte entry may be stacked (e.g. an outer
// transport label plus an inner VPN/service label). Entries appear top-of-stack
// first. The Bottom-of-Stack (S) bit marks the last entry: S=0 means another
// MPLS label entry follows; S=1 means the entry that follows is the encapsulated
// packet (typically IPv4 or IPv6).
//
// WHY THE INNER PROTOCOL IS NOT IN THE HEADER: RFC 3032 deliberately gives the
// label stack entry NO "next protocol" / EtherType-style field. An LSR forwards
// on the label alone and never needs to know what is inside, so nothing in the
// 4-byte entry identifies the encapsulated payload. A dissector must guess
// (commonly by peeking at the first nibble: 0x4 = IPv4, 0x6 = IPv6) — we do NOT
// fabricate that here. When S=1 we stop and leave the inner packet in
// node.payload (see the note on the next() function).
import type { ProtocolSpec, ParsedHeader } from '../core/types';

export const mpls: ProtocolSpec = {
  id: 'mpls',
  name: 'MPLS',
  layer: 2, // "layer 2.5": a shim between Ethernet (2) and IP (3); grouped with the link layer.
  summary:
    'A 4-byte "label stack entry" shim between the link and network layers. Routers forward on the 20-bit label alone — a fast exact-match lookup — without reading the inner IP header. The Bottom-of-Stack (S) bit says whether another label follows or the inner packet begins. After Ethernet EtherType 0x8847 (MPLS unicast).',
  fields: [
    {
      name: 'label',
      label: 'Label',
      bits: 20,
      decode: (v) => {
        const reserved: Record<number, string> = {
          0: '0 (IPv4 Explicit NULL)',
          1: '1 (Router Alert)',
          2: '2 (IPv6 Explicit NULL)',
          3: '3 (Implicit NULL)',
        };
        return reserved[v] ?? String(v);
      },
      note: 'The 20-bit forwarding label. An LSR looks this up to decide the next hop and the label operation (swap/pop). Values 0-15 are reserved.',
      desc: 'The 20-bit label value that an MPLS router (LSR) uses as the key for its forwarding decision. It has only local significance on a link: the upstream and downstream routers agree on what a given label means, and each hop typically swaps it for a new one. Values 0 through 15 are reserved for special meanings.',
      detail: `LABEL (20 bits, RFC 3032 §2.1): "Label Value. This 20-bit field carries the
actual value of the Label." The label space is 2^20 = 1,048,576 values.

LOCAL SIGNIFICANCE: a label is meaningful only on a single link between two
adjacent LSRs. The downstream router advertises (via LDP, RSVP-TE, or BGP) the
label it wants incoming packets to carry; the upstream router pushes that value.
At each hop the LSR does a LABEL SWAP — look up the incoming label, replace it
with the outgoing label the next hop expects, and forward.

RESERVED LABELS 0-15 (RFC 3032 §2.1, updated by RFC 4182 / RFC 3032):
- 0  IPv4 Explicit NULL: must be at bottom of stack; tells the egress to pop and
     forward as IPv4 (used so QoS/Exp bits survive to the last hop).
- 1  Router Alert: like the IP Router Alert option; the packet is sent to the
     control plane. May appear anywhere except bottom of stack.
- 2  IPv6 Explicit NULL: the IPv6 equivalent of label 0.
- 3  Implicit NULL: signalled by an egress to request PENULTIMATE HOP POPPING
     (PHP) — the second-to-last router pops the MPLS header so the egress
     receives a plain IP packet and avoids a double lookup. Label 3 never
     actually appears on the wire; it is a signalling-only value.

WHY MPLS IS FAST: forwarding is an EXACT-MATCH lookup on a small fixed-width
integer, versus IP's longest-prefix-match over a large variable-length address.
That made MPLS attractive on 1990s hardware and it still underpins traffic
engineering (RSVP-TE) and L2/L3 VPNs today.`,
    },
    {
      name: 'trafficClass',
      label: 'Traffic Class (TC/Exp)',
      bits: 3,
      note: 'QoS / class-of-service bits. RFC 3032 called these "Exp" (Experimental); RFC 5462 renamed them Traffic Class. 8 possible classes.',
      desc: 'Three bits carrying the class of service for QoS, analogous to the DSCP bits in IP. RFC 3032 originally named this field "Exp" (Experimental Use); RFC 5462 formally renamed it the Traffic Class (TC) field because in practice it was always used for differentiated forwarding, never experiments.',
      detail: `TRAFFIC CLASS (3 bits, RFC 5462; "Exp" in RFC 3032 §2.1):
"This three-bit field is reserved for experimental use." (RFC 3032) — but it was
universally used to carry the queuing/drop priority (QoS class), so RFC 5462
renamed it to TRAFFIC CLASS to match reality.

EIGHT CLASSES: 3 bits = 8 traffic classes, mirroring the way IP Precedence /
DSCP class selectors map to forwarding behaviour. An ingress LSR typically copies
or maps the inner packet's DSCP into these bits so the core can apply
per-hop-behaviour (PHB) queuing without parsing the inner IP header.

E-LSP vs L-LSP: in the "EXP-Inferred-PSC LSP" (E-LSP) model these bits select
both the scheduling class and the drop precedence directly. In the
"Label-Only-Inferred-PSC LSP" (L-LSP) model the label itself implies the
scheduling class and the TC bits carry only the drop precedence (RFC 3270).

These three bits sit immediately below the 20-bit label, occupying bits 3-1 of
the third byte of the entry.`,
    },
    {
      name: 'bottomOfStack',
      label: 'Bottom of Stack (S)',
      bits: 1,
      type: 'flags',
      flagBits: ['S'],
      decode: (v) =>
        v === 1
          ? '1 — last label; the inner packet (e.g. IPv4/IPv6) follows'
          : '0 — another MPLS label stack entry follows',
      note: 'The S bit. 1 = this is the bottom (last) label and the encapsulated packet follows; 0 = another 4-byte MPLS label entry follows.',
      desc: 'A single bit marking the bottom of the label stack. RFC 3032: it "is set to one for the last entry in the label stack (i.e., for the bottom of the stack), and zero for all other label stack entries." When S=0 another 4-byte MPLS entry follows this one; when S=1 the next bytes are the encapsulated network-layer packet.',
      detail: `BOTTOM OF STACK / S BIT (1 bit, RFC 3032 §2.1): "Bottom of Stack. This bit is
set to one for the last entry in the label stack (i.e., for the bottom of the
stack), and zero for all other label stack entries."

THE STACK: MPLS allows labels to be STACKED — multiple 4-byte entries, top of
stack first. A common case is two labels:
- OUTER (transport) label: steers the packet across the provider core (S=0).
- INNER (service/VPN) label: identifies the customer VPN or pseudowire at the
  egress (S=1, the bottom).
The S bit is the ONLY thing that tells a parser where the label stack ends, since
the entries are otherwise indistinguishable fixed 4-byte words.

DISPATCH (see next()): S=0 -> parse another 'mpls' entry. S=1 -> stop: the inner
packet begins, but the label stack carries NO field naming it. The conventional
heuristic is to peek at the first nibble of the payload (0x4 = IPv4, 0x6 = IPv6),
or to rely on control-plane state (the label's signalled FEC). Apex does not
guess: it returns null and the inner packet is left in node.payload.`,
    },
    {
      name: 'timeToLive',
      label: 'TTL',
      bits: 8,
      decode: (v) => `${v} hops left before the labeled packet is dropped`,
      note: 'An MPLS-layer hop counter, decremented by each LSR exactly like the IP TTL, to stop loops within the LSP.',
      desc: "Time To Live for the MPLS layer: an 8-bit hop counter decremented by 1 at each label-switching router, mirroring the IPv4 TTL. It exists so that forwarding loops in the label-switched path are eventually broken even though LSRs never look at the inner IP TTL.",
      detail: `TTL (8 bits, RFC 3032 §2.1 and RFC 3443): "Time to Live. This eight-bit field
is used to encode a time-to-live value."

WHY A SEPARATE TTL: an LSR forwards on the label and does not touch the inner IP
header, so it cannot decrement the IP TTL. MPLS therefore carries its own TTL
and decrements it per hop; a packet whose MPLS TTL hits 0 is dropped, breaking
loops inside the LSP.

INGRESS / EGRESS BEHAVIOUR (RFC 3443, two modes):
- UNIFORM mode: at push, the inner IP TTL is copied into the MPLS TTL; at pop,
  the (decremented) MPLS TTL is copied back into the IP TTL. The LSP's hops are
  thus VISIBLE to traceroute.
- PIPE mode: the MPLS TTL is set independently (often 255) at push and the inner
  IP TTL is left unchanged across the LSP, so the entire LSP looks like a single
  hop and the provider's internal topology is HIDDEN from the customer.

It is the last byte of the 4-byte label stack entry.`,
    },
  ],
  // A label stack entry is a fixed 4 octets (RFC 3032 §2.1).
  headerBytes: () => 4,
  // No length field bounds the PDU; the inner packet runs to the end of the
  // enclosing IP/Ethernet payload, so pduBytes is intentionally omitted.
  //
  // DISPATCH ON THE S BIT:
  //   S=0 -> another 4-byte MPLS label stack entry follows -> recurse into 'mpls'.
  //   S=1 -> this is the bottom label; the encapsulated network-layer packet
  //          (typically IPv4 or IPv6) follows. The label stack entry contains NO
  //          field that names the inner protocol (RFC 3032 gives it none), so it
  //          cannot be identified from the header alone. We return null and leave
  //          the inner packet in node.payload rather than guessing.
  next: (h: ParsedHeader) => (h.get('bottomOfStack') === 0 ? 'mpls' : null),
};
