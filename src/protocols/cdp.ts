// CDP — Cisco Discovery Protocol. Cisco proprietary; there is no IETF RFC.
// The authoritative reference is Cisco's "Cisco Discovery Protocol Configuration
// Guide" and US Patent 5,742,604; the on-the-wire format is documented by the
// Wireshark dissector (epan/dissectors/packet-cdp.c) and matches every public
// capture. CDP is a Layer-2 neighbor-discovery protocol: each device periodically
// multicasts (to 01:00:0C:CC:CC:CC) a description of itself — its name, the port
// it sent from, its capabilities, software version and platform — so directly
// connected Cisco devices learn about each other without any Layer-3 config.
//
// ENCAPSULATION (out of scope for this spec, modelled by Ethernet/802.3 + SNAP):
// CDP rides in an IEEE 802.3 frame with an 802.2 LLC + SNAP header:
//   AA AA 03  00 00 0C  20 00
//   |  |  |   \______/  \___/
//   |  |  |   OUI=Cisco  PID=0x2000 (CDP)
//   DSAP SSAP Control (SNAP: DSAP=SSAP=0xAA, Control=0x03)
// So the SNAP OUI 0x00-00-0C with protocol id 0x2000 selects CDP. This spec
// begins at the CDP payload itself (the 4-byte fixed header below).
//
// CDP HEADER (fixed 4 bytes), then a sequence of TLVs:
//   +-------+-------+---------------+
//   |Version|  TTL  |   Checksum    |   <- this 4-byte header
//   +-------+-------+---------------+
//   |  Type (16)    |  Length (16)  |   <- first TLV...
//   +---------------+---------------+
//   |            Value ...          |
//   +-------------------------------+
// Each TLV is Type(2) + Length(2, counting the whole TLV incl. these 4 bytes) +
// Value(Length-4). We model the fixed 4-byte header exactly; the TLV stream is
// variable and self-describing, so it falls through as node.payload. See the
// note on the Checksum field — it is the standard Internet checksum over the
// ENTIRE CDP packet (header + all TLVs), so it can't be verified from the header
// alone.
import type { ProtocolSpec } from '../core/types';

const VERSION: Record<number, string> = {
  1: '1 (original)',
  2: '2 (adds VTP domain, native VLAN, duplex and other TLVs)',
};

export const cdp: ProtocolSpec = {
  id: 'cdp',
  name: 'CDP',
  layer: 2,
  summary:
    'Cisco Discovery Protocol: a Layer-2 neighbor-discovery protocol that periodically multicasts a device\'s identity (name, port, capabilities, software, platform) so directly connected Cisco devices learn about each other with no IP configuration. After this 4-byte header (version, hold-time, checksum) comes a stream of Type-Length-Value records.',
  fields: [
    {
      name: 'version',
      label: 'Version',
      bits: 8,
      type: 'enum',
      enumMap: VERSION,
      decode: (v) => VERSION[v] ?? String(v),
      note: '1 or 2. Version 2 (the modern default) adds extra TLVs.',
      desc: 'The CDP protocol version, 1 or 2. Version 2 is the modern default and extends version 1 with additional TLVs (VTP management domain, native VLAN, full/half duplex) and adds error reporting for mismatched native VLAN or duplex between neighbors.',
      detail: `VERSION (8 bits): the first byte of the CDP packet, so a receiver knows which TLV set to expect.
- 1 = CDPv1 (original): carries the core TLVs — Device ID, Addresses, Port ID, Capabilities, Software Version, Platform.
- 2 = CDPv2 (default on modern IOS): everything in v1 plus VTP Management Domain, Native VLAN, Duplex, and others. CDPv2 also lets neighbors detect and log mismatches (e.g. a native-VLAN or duplex mismatch across a link).

A CDPv2-capable device still understands CDPv1 packets, so the two interoperate; the version byte just tells the receiver how rich the advertisement is.`,
    },
    {
      name: 'ttl',
      label: 'TTL (hold time)',
      bits: 8,
      decode: (v) => `${v} seconds to keep this neighbor entry`,
      note: 'Hold time in SECONDS (not a hop count). Default 180.',
      desc: 'The hold time in seconds: how long a receiver should keep this neighbor in its CDP table before discarding it if no further advertisement arrives. The Cisco default is 180 seconds, with advertisements sent every 60 seconds. Despite the name "TTL" this is a hold timer, not an IP-style per-hop counter.',
      detail: `TTL / HOLD TIME (8 bits, in SECONDS, default 180): unlike the IPv4 TTL — which is a hop count decremented by routers — this is a freshness timer. A receiver stores the neighbor's information and starts a countdown; if a new CDP packet from that neighbor is not seen before the hold time expires, the entry is purged from the CDP neighbor table.

TIMER RELATIONSHIP: Cisco devices send CDP advertisements every 60 seconds (the "CDP timer") and advertise a 180-second hold time, so a neighbor can miss two consecutive advertisements and still be retained. A device that is going away can send a final packet with TTL/hold-time 0 to tell neighbors to flush it immediately.

CDP is NOT forwarded: it is link-local. Frames are sent to the multicast MAC 01:00:0C:CC:CC:CC and are not relayed by switches/routers, so a "TTL" hop count would be meaningless — every advertisement travels exactly one hop.

The 8-bit width caps the hold time at 255 seconds; 180 fits comfortably.`,
    },
    {
      name: 'checksum',
      label: 'Checksum',
      bits: 16,
      type: 'hex',
      note: 'Standard Internet checksum over the ENTIRE CDP packet (header + all TLVs).',
      desc: 'A 16-bit ones-complement Internet checksum (the same RFC 1071 algorithm as IP/TCP/UDP) computed over the entire CDP packet — this 4-byte header plus every TLV that follows. There is no IP pseudo-header: CDP is a self-contained Layer-2 payload, so the checksum covers only the CDP bytes.',
      detail: `CHECKSUM (16 bits): the standard Internet checksum (RFC 1071 — the 16-bit one's complement of the one's complement sum of all 16-bit words) over the WHOLE CDP packet, starting at the Version byte and running through the last TLV. The field is zeroed while computing, then filled in.

NO PSEUDO-HEADER: unlike TCP/UDP, no source/destination address is folded in — CDP is not carried over IP, it sits directly in an 802.3/SNAP frame, so the checksum protects only the CDP message itself.

VERIFICATION: because the checksum spans every TLV, it cannot be recomputed from this 4-byte header alone — you need all the packet bytes. Summing every 16-bit word of an intact packet (including the checksum) yields 0xFFFF, the usual one's-complement self-check.

ODD-LENGTH QUIRK: Cisco's implementation has historically handled an odd-length packet's final byte in a non-standard way (it sign-extends the trailing byte rather than padding with a zero), which some dissectors special-case. Even-length packets follow the textbook RFC 1071 algorithm exactly.`,
    },
  ],
  // The fixed CDP header is 4 bytes (version + TTL + checksum). The TLV stream
  // that follows is variable-length and self-describing.
  headerBytes: () => 4,
  // There is no encapsulated child protocol: what follows is a sequence of CDP
  // TLVs (Device ID, Addresses, Port ID, Capabilities, Software Version,
  // Platform, ...), each Type(2) + Length(2) + Value. The list ends at an
  // End-of-Packet sentinel. These are CDP's own data, not a nested protocol, so
  // dissection stops here and the TLVs are exposed as node.payload.
  //
  // TLV TYPES (the common ones):
  //   0x0001 Device ID         0x0002 Addresses        0x0003 Port ID
  //   0x0004 Capabilities      0x0005 Software Version 0x0006 Platform
  //   0x0009 VTP Mgmt Domain    0x000A Native VLAN       0x000B Duplex
  next: () => null,
};
