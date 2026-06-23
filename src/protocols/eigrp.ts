// EIGRP — Enhanced Interior Gateway Routing Protocol. RFC 7868 (May 2016),
// "Cisco's Enhanced Interior Gateway Routing Protocol (EIGRP)", §6.5
// "EIGRP Packet Header".
//
// EIGRP is an advanced distance-vector (some call it "hybrid") interior gateway
// protocol. Originally Cisco-proprietary, it was published as the Informational
// RFC 7868 in 2016. It uses DUAL (the Diffusing Update Algorithm) to compute
// loop-free routes and react quickly to topology changes, with feasible
// successors providing pre-computed backup paths.
//
// Like OSPF, EIGRP rides DIRECTLY inside IP — not over TCP/UDP — as IP protocol
// number 88, normally sent to the IPv4 multicast group 224.0.0.10 (and FF02::A
// for IPv6). Reliable delivery (for UPDATE/QUERY/REPLY) is provided by EIGRP's
// own RTP (Reliable Transport Protocol) using the Sequence/Acknowledgment
// numbers in this header, not by TCP.
//
// THE 20-BYTE FIXED HEADER (RFC 7868 §6.5) precedes a body of Type/Length/Value
// (TLV) triplets that varies by Opcode (e.g. a HELLO carries a Parameters TLV
// and a Software Version TLV; an UPDATE carries route TLVs). We model the fixed
// 20-byte header exactly; the TLV body is variable and falls through as
// node.payload — see the note on the Opcode field. The header layout:
//
//    0                   1                   2                   3
//    0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
//   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//   |Header Version | Opcode        |           Checksum            |
//   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//   |                             Flags                             |
//   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//   |                        Sequence Number                        |
//   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//   |                     Acknowledgment Number                     |
//   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//   | Virtual Router ID             |   Autonomous System Number    |
//   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
import type { ProtocolSpec } from '../core/types';

const OPCODE: Record<number, string> = {
  1: 'Update',
  2: 'Request',
  3: 'Query',
  4: 'Reply',
  5: 'Hello/Ack',
  6: 'Reserved (IPX-SAP)',
  7: 'Reserved (Probe)',
  8: 'Reserved (Ack)',
  10: 'SIA-Query',
  11: 'SIA-Reply',
};

// The Flags field is 32 bits. RFC 7868 §6.5 defines four flag bits in the LOW
// nibble: INIT 0x01, CR 0x02, RS 0x04, EOT 0x08. flagBits is MSB-first, so the
// four defined flags sit at positions 31, 30, 29, 28 (i.e. the last four). All
// other 28 bits are reserved/unused.
const EIGRP_FLAGS = (() => {
  const bits = new Array<string>(32).fill('');
  bits[28] = 'EOT'; // 0x08
  bits[29] = 'RS'; // 0x04
  bits[30] = 'CR'; // 0x02
  bits[31] = 'INIT'; // 0x01
  return bits;
})();

export const eigrp: ProtocolSpec = {
  id: 'eigrp',
  name: 'EIGRP',
  layer: 3,
  summary:
    "Cisco's advanced distance-vector interior routing protocol (RFC 7868). It rides directly inside IP as protocol 88 (not over TCP/UDP), runs the DUAL algorithm for loop-free routes with pre-computed backup paths, and uses its own reliable transport (the Sequence/Ack numbers below). Every EIGRP packet begins with this fixed 20-byte header, followed by a body of Type/Length/Value triplets that depends on the Opcode.",
  fields: [
    {
      name: 'version',
      label: 'Header Version',
      bits: 8,
      decode: (v) => (v === 2 ? '2 (current EIGRP packet header format)' : String(v)),
      note: 'The EIGRP packet header format version. Current value is 2. This is NOT the TLV Version field.',
      desc: 'The version of the EIGRP packet header format itself. RFC 7868 §6.5 fixes the current value at 2. It is distinct from the per-TLV Version field carried inside the body, which describes the encoding of an individual TLV.',
      detail: `HEADER VERSION (8 bits): "EIGRP Packet Header Format version. Current Version
is 2. This field is not the same as the TLV Version field." (RFC 7868 §6.5).

It is the very first byte of every EIGRP packet so a receiver can dispatch on
the header format before parsing anything else. Do not confuse it with:
- the TLV Version field inside Software-Version / Parameters TLVs in the body, or
- the EIGRP "named mode" vs "classic mode" configuration, which is a Cisco IOS
  concept, not a wire field.`,
    },
    {
      name: 'opcode',
      label: 'Opcode',
      bits: 8,
      type: 'enum',
      enumMap: OPCODE,
      note: 'The message type. 1 Update, 2 Request, 3 Query, 4 Reply, 5 Hello/Ack, 10 SIA-Query, 11 SIA-Reply. The TLV body that follows the header depends on this.',
      desc: 'Indicates the type of EIGRP message and therefore which TLVs make up the variable body after this header. Hello (5) maintains adjacencies; Update/Query/Reply (1/3/4) implement the DUAL route-computation exchange and are delivered reliably.',
      detail: `OPCODE (8 bits) — message types (RFC 7868 §6.5):
- 1 UPDATE: carries route information (route TLVs). Sent reliably; the initial
  UPDATE to a new neighbor sets the INIT flag and triggers a full table dump.
- 2 REQUEST: asks a neighbor for specific routes (rarely seen in practice).
- 3 QUERY: DUAL's diffusing computation — "I lost my route, do you have one?"
  Sent reliably and must be answered with a REPLY.
- 4 REPLY: the answer to a QUERY, carrying the responder's route (or that it has
  none). Sent reliably.
- 5 HELLO/ACK: periodic multicast HELLO (default every 5s on fast links, 60s on
  slow non-broadcast links) discovers and maintains neighbors. A HELLO with an
  EMPTY body and a NON-ZERO Acknowledgment Number is an ACK — the bare
  acknowledgment of a reliably sent packet (§6.5 says such a packet "should be
  decoded as an ACK packet rather than a HELLO packet").
- 10 SIA-QUERY / 11 SIA-REPLY: "Stuck-In-Active" handshake. If a QUERY goes
  unanswered too long, the querier probes with SIA-QUERY to learn whether the
  neighbor is still working on it before tearing down the adjacency (RFC 7868 §5).
- 6,7,8,9: reserved (historic IPX-SAP, Probe, Ack opcodes).

NOTE: Apex models only the fixed 20-byte header. The TLV body that follows is
opcode-specific and variable-length, so it is intentionally left in node.payload
rather than fabricated as fixed fields.`,
    },
    {
      name: 'checksum',
      label: 'Checksum',
      bits: 16,
      type: 'hex',
      note: "Standard ones'-complement Internet checksum over the ENTIRE EIGRP packet (header + TLV body), with this field zeroed during computation.",
      desc: "A 16-bit ones'-complement Internet checksum (RFC 1071 style) computed over the entire EIGRP packet — the 20-byte header plus the whole TLV body. Unlike TCP/UDP it uses NO IP pseudo-header. A packet that fails the checksum is discarded.",
      detail: `CHECKSUM (16 bits): "Each packet will include a checksum for the entire contents
of the packet. The checksum will be the standard ones' complement of the ones'
complement sum. For purposes of computing the checksum, the value of the
checksum field is zero. The packet is discarded if the packet checksum fails."
(RFC 7868 §6.5).

NO PSEUDO-HEADER: because EIGRP is its own IP payload (protocol 88), the checksum
covers only the EIGRP packet itself — the source/destination IPs are not folded
in, in contrast to the TCP and UDP checksums.

VERIFICATION: the checksum covers the TLV body, so it cannot be recomputed from
the 20-byte header alone — the full packet bytes are needed. As with any RFC 1071
checksum, summing every 16-bit word of an intact packet (including the checksum
field) yields 0xFFFF.`,
    },
    {
      name: 'flags',
      label: 'Flags',
      bits: 32,
      type: 'flags',
      flagBits: EIGRP_FLAGS,
      note: 'Special packet handling. INIT 0x01 (full-table request to a new neighbor), CR 0x02 (Conditional Receive), RS 0x04 (Restart), EOT 0x08 (End-of-Table).',
      desc: 'A 32-bit field defining special handling of the packet. RFC 7868 §6.5 defines four flag bits in the low nibble; the rest are reserved (zero). They coordinate neighbor startup, graceful restart, and the reliable multicast retransmission mechanism.',
      detail: `FLAGS (32 bits) — four defined bits (RFC 7868 §6.5), all in the LOW nibble:
- INIT-Flag (0x01): set in the initial UPDATE to a newly discovered neighbor. It
  instructs the neighbor to advertise its full set of routes (a full table dump).
- CR-Flag (0x02): Conditional Receive. The packet should only be accepted by
  receivers that are in "Conditionally Received" mode, which a router enters when
  it processes a HELLO carrying a SEQUENCE TLV. This underpins EIGRP's reliable
  MULTICAST: the sender first multicasts, then uses CR to retransmit only to the
  neighbors that have not yet acknowledged, without falling back to unicast.
- RS-Flag (0x04): Restart. Set in HELLO and UPDATE packets during the graceful
  (NSF) restart period so a neighbor can detect the restart, hold the adjacency,
  and resynchronize instead of tearing it down.
- EOT-Flag (0x08): End-of-Table. Marks the end of the startup table exchange —
  the neighbor has finished sending all its UPDATEs, so the router may now flush
  any stale routes that survived from before a restart.

BIT ORDER: this is a 32-bit big-endian word; the four flags occupy the four
least-significant bits, so on the wire a value of e.g. 0x00000001 is the INIT
flag. The remaining 28 bits are reserved and sent as zero.`,
    },
    {
      name: 'sequenceNumber',
      label: 'Sequence Number',
      bits: 32,
      note: 'The sender\'s 32-bit RTP sequence number for this packet. 0 means no acknowledgment is required (e.g. an ordinary multicast HELLO).',
      desc: "EIGRP's own Reliable Transport Protocol (RTP) sequence number, unique with respect to the sending router. Reliably delivered packets (UPDATE/QUERY/REPLY) carry a non-zero value the receiver must acknowledge; a value of 0 means no acknowledgment is required.",
      detail: `SEQUENCE NUMBER (32 bits): "Each packet that is transmitted will have a 32-bit
sequence number that is unique with respect to a sending router. A value of 0
means that an acknowledgment is not required." (RFC 7868 §6.5).

EIGRP does not use TCP; it provides reliability itself via RTP. Each neighbor
keeps a per-neighbor sequence space. Unreliable packets (a plain periodic HELLO,
or an ACK) carry Sequence Number 0. Reliable packets carry a monotonically
increasing sequence number and are retransmitted until acknowledged (default up
to 16 times over the Hold time) — if a neighbor never acks, the adjacency is
reset.`,
    },
    {
      name: 'acknowledgeNumber',
      label: 'Acknowledgment Number',
      bits: 32,
      note: 'The sequence number being acknowledged. 0 = no acknowledgment present. A HELLO with a non-zero Ack is really an ACK packet. Non-zero Acks only appear in unicast packets.',
      desc: 'The 32-bit sequence number of a previously received reliable packet that this packet acknowledges. 0 means no acknowledgment is present. Because a bare ACK reuses the HELLO opcode, a HELLO with a non-zero Acknowledgment Number must be decoded as an ACK, not a HELLO.',
      detail: `ACKNOWLEDGMENT NUMBER (32 bits): "The 32-bit sequence number that is being
acknowledged with respect to the receiver of the packet. If the value is 0,
there is no acknowledgment present. A non-zero value can only be present in
unicast-addressed packets. A HELLO packet with a non-zero ACK field should be
decoded as an ACK packet rather than a HELLO packet." (RFC 7868 §6.5).

This is how RTP closes the loop: when a router reliably sends an UPDATE (with
Sequence Number N), the neighbor replies with a packet whose Acknowledgment
Number = N. That acknowledgment is most often a HELLO/ACK (opcode 5) with an
empty body — which is exactly why a non-zero Ack reclassifies a HELLO as an ACK.
Acks are unicast back to the original sender, never multicast.`,
    },
    {
      name: 'virtualRouterId',
      label: 'Virtual Router ID',
      bits: 16,
      type: 'hex',
      decode: (v) => {
        if (v === 0x0000) return '0x0000 (Unicast Address Family)';
        if (v === 0x0001) return '0x0001 (Multicast Address Family)';
        if (v === 0x8000) return '0x8000 (Unicast Service Family)';
        return `0x${v.toString(16).padStart(4, '0').toUpperCase()} (Reserved)`;
      },
      note: 'VRID: which virtual router / address-or-service family this packet belongs to. 0x0000 unicast AF, 0x0001 multicast AF, 0x8000 unicast service family.',
      desc: 'A 16-bit identifier of the virtual router the packet is associated with, used to multiplex different address families and service families over one EIGRP process. Packets with an unknown or unsupported VRID are discarded.',
      detail: `VIRTUAL ROUTER IDENTIFIER (VRID, 16 bits, RFC 7868 §6.5): identifies the virtual
router this packet belongs to. Defined ranges:
- 0x0000          Unicast Address Family (the ordinary unicast routing tables)
- 0x0001          Multicast Address Family
- 0x0002-0x7FFF   Reserved
- 0x8000          Unicast Service Family (EIGRP "service" advertisement)
- 0x8001-0xFFFF   Reserved

It lets a single EIGRP implementation carry several independent topologies (for
example different address families) without separate packet streams; a receiver
discards packets whose VRID it does not support.`,
    },
    {
      name: 'autonomousSystemNumber',
      label: 'Autonomous System Number',
      bits: 16,
      note: 'The EIGRP AS (process) number, 1-65535. Acts as a weak authenticator: neighbors must share the same AS number or the packet is ignored.',
      desc: 'The 16-bit Autonomous System number of the sending EIGRP process (1-65535). It groups routers into one EIGRP domain and acts as an implicit authentication value: a receiver ignores any packet whose AS number differs from its own.',
      detail: `AUTONOMOUS SYSTEM NUMBER (16 bits): "16-bit unsigned number of the sending
system. This field is indirectly used as an authentication value. That is, a
router that receives and accepts a packet from a neighbor must have the same AS
number or the packet is ignored. The range of valid AS numbers is 1 through
65,535." (RFC 7868 §6.5).

This is the number configured with "router eigrp <AS>" on Cisco devices: two
routers only form an adjacency if their EIGRP AS numbers match. Note this is a
local EIGRP process identifier, distinct from a BGP autonomous-system number,
even though it occupies the same 16-bit value space.`,
    },
  ],
  // The EIGRP header is a fixed 20 bytes (RFC 7868 §6.5); the TLV body follows.
  headerBytes: () => 20,
  // The TLV body is opcode-specific and variable-length; there is no generic
  // child protocol to dissect, so dissection stops here and the body (the TLVs)
  // is exposed as node.payload.
  next: () => null,
};
