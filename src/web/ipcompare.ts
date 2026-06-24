// IPv4 vs IPv6 header comparison — what IPv6 changed and why. IPv4's header is
// variable (20+ bytes) with a per-hop checksum and in-header fragmentation fields;
// IPv6 fixed it at 40 bytes, dropped the checksum (upper layers cover it), moved
// fragmentation out of routers, and turned options into chained extension headers —
// so a router can forward on a fixed, predictable layout. Pure data, tested against
// the real layouts (IPv4 RFC 791, IPv6 RFC 8200).

export type Change = 'kept' | 'renamed' | 'removed' | 'added';

export interface Field { name: string; bits: number; change: Change; maps?: string; note: string }

export const IPV4_FIELDS: Field[] = [
  { name: 'Version', bits: 4, change: 'kept', maps: 'Version', note: 'The IP version number — 4 here. The one field that stayed identical (and in the same place).' },
  { name: 'IHL', bits: 4, change: 'removed', note: 'Internet Header Length — needed because IPv4 options make the header variable. IPv6’s header is a fixed 40 bytes, so this field is gone.' },
  { name: 'DSCP + ECN', bits: 8, change: 'renamed', maps: 'Traffic Class', note: 'QoS marking and congestion notification. Same idea, renamed to “Traffic Class” in IPv6.' },
  { name: 'Total Length', bits: 16, change: 'renamed', maps: 'Payload Length', note: 'IPv4 counts header+payload; IPv6’s “Payload Length” counts only what follows the fixed header — simpler for a router.' },
  { name: 'Identification', bits: 16, change: 'removed', note: 'Part of IPv4 fragmentation. IPv6 routers never fragment, so this moved into an optional Fragment extension header (rarely used).' },
  { name: 'Flags', bits: 3, change: 'removed', note: 'DF/MF fragmentation flags — gone from the base header (fragmentation is end-host-only in IPv6).' },
  { name: 'Fragment Offset', bits: 13, change: 'removed', note: 'Where this fragment sits in the original datagram — moved to the Fragment extension header.' },
  { name: 'TTL', bits: 8, change: 'renamed', maps: 'Hop Limit', note: 'Decremented at each hop to kill loops. Renamed “Hop Limit” to match what it actually does (it was never really seconds).' },
  { name: 'Protocol', bits: 8, change: 'renamed', maps: 'Next Header', note: 'Which protocol is inside (TCP=6, UDP=17…). In IPv6 it’s “Next Header”, which also chains extension headers.' },
  { name: 'Header Checksum', bits: 16, change: 'removed', note: 'The big win: every IPv4 router must recompute this after decrementing TTL. IPv6 drops it entirely — L2 (CRC) and L4 (TCP/UDP checksum) already protect the data.' },
  { name: 'Source Address', bits: 32, change: 'renamed', maps: 'Source (128-bit)', note: 'Widened from 32 to 128 bits — the whole point of IPv6: 2^128 addresses instead of 2^32.' },
  { name: 'Destination Address', bits: 32, change: 'renamed', maps: 'Destination (128-bit)', note: 'Also widened to 128 bits.' },
  { name: 'Options', bits: 0, change: 'removed', note: 'Variable in-header options bloated and slowed parsing. IPv6 replaces them with optional, chained extension headers between the header and payload.' },
];

export const IPV6_FIELDS: Field[] = [
  { name: 'Version', bits: 4, change: 'kept', note: 'Version 6.' },
  { name: 'Traffic Class', bits: 8, change: 'renamed', maps: 'DSCP + ECN', note: 'QoS + congestion (the old DSCP/ECN).' },
  { name: 'Flow Label', bits: 20, change: 'added', note: 'New in IPv6: tags packets of one flow so routers can keep them on the same path / give them consistent treatment without inspecting ports.' },
  { name: 'Payload Length', bits: 16, change: 'renamed', maps: 'Total Length', note: 'Length of everything after the fixed 40-byte header.' },
  { name: 'Next Header', bits: 8, change: 'renamed', maps: 'Protocol', note: 'The next protocol OR the first extension header.' },
  { name: 'Hop Limit', bits: 8, change: 'renamed', maps: 'TTL', note: 'The loop-killer (old TTL).' },
  { name: 'Source Address', bits: 128, change: 'renamed', maps: 'Source (32-bit)', note: '128-bit source address.' },
  { name: 'Destination Address', bits: 128, change: 'renamed', maps: 'Destination (32-bit)', note: '128-bit destination address.' },
];

export const headerBytes = (fields: Field[]): number => fields.reduce((s, f) => s + f.bits, 0) / 8;

export const byChange = (fields: Field[], change: Change): string[] =>
  fields.filter((f) => f.change === change).map((f) => f.name);
