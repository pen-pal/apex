// IPv4 fragmentation & MTU (RFC 791) — what happens when a datagram is bigger than
// a link will carry. The MTU caps the whole IP packet (header + payload); the
// router splits the payload into fragments that each fit, copying the header onto
// each. Every fragment but the last has its payload size as a multiple of 8 bytes,
// carries a Fragment Offset measured in 8-byte units, and sets the More-Fragments
// (MF) flag; the last fragment clears MF. Reassembly stitches them back by offset.
// If the Don't-Fragment (DF) flag is set, a too-big packet is dropped and the router
// returns ICMP "fragmentation needed" with the next-hop MTU — that's Path-MTU
// Discovery, which shrinks the sender instead of fragmenting. Pure, tested.

export const IP_HEADER = 20; // bytes (no options)

export interface Fragment {
  index: number;
  offsetUnits: number; // Fragment Offset field value (in 8-byte units)
  byteStart: number; // first payload byte this fragment carries
  size: number; // payload bytes in this fragment
  mf: boolean; // More-Fragments flag
}

export interface FragResult {
  fragments: Fragment[];
  mtu: number;
  maxPayloadPerFrag: number; // largest payload that fits, rounded down to 8
}

/** Fragment a payload of `payloadSize` bytes to fit a link `mtu` (incl. 20-byte header). */
export function fragment(payloadSize: number, mtu: number): FragResult {
  // payload room per fragment = MTU − header, rounded DOWN to a multiple of 8 (offsets are 8-byte units)
  const room = Math.max(8, Math.floor((mtu - IP_HEADER) / 8) * 8);
  const fragments: Fragment[] = [];
  let start = 0;
  let index = 0;
  if (payloadSize <= mtu - IP_HEADER) {
    // fits whole — a single, unfragmented packet (MF=0, offset 0). An unfragmented
    // packet may use the full payload room; only fragments need 8-byte alignment.
    return { fragments: [{ index: 0, offsetUnits: 0, byteStart: 0, size: payloadSize, mf: false }], mtu, maxPayloadPerFrag: room };
  }
  while (start < payloadSize) {
    const size = Math.min(room, payloadSize - start);
    const isLast = start + size >= payloadSize;
    fragments.push({ index, offsetUnits: start / 8, byteStart: start, size, mf: !isLast });
    start += size;
    index += 1;
  }
  return { fragments, mtu, maxPayloadPerFrag: room };
}

/** Reassemble fragments (any order) back into the original payload length. */
export function reassemble(fragments: Fragment[]): { ok: boolean; totalBytes: number; complete: boolean } {
  const sorted = [...fragments].sort((a, b) => a.offsetUnits - b.offsetUnits);
  let expected = 0;
  for (const f of sorted) {
    if (f.offsetUnits * 8 !== expected) return { ok: false, totalBytes: expected, complete: false };
    expected += f.size;
  }
  const last = sorted[sorted.length - 1];
  const complete = !!last && !last.mf; // the final piece must have MF=0
  return { ok: true, totalBytes: expected, complete };
}

export interface PmtudResult {
  delivered: boolean;
  icmp: { type: string; nextHopMtu: number } | null; // ICMP "fragmentation needed"
  newPacketSize: number; // what the sender should retry with
}

/**
 * Path-MTU Discovery: a DF-set packet of `packetSize` (header+payload) meets a link
 * with `linkMtu`. If it doesn't fit, the router drops it and signals the smaller MTU.
 */
export function pmtud(packetSize: number, linkMtu: number): PmtudResult {
  if (packetSize <= linkMtu) return { delivered: true, icmp: null, newPacketSize: packetSize };
  return {
    delivered: false,
    icmp: { type: 'Destination Unreachable — Fragmentation Needed (Type 3, Code 4)', nextHopMtu: linkMtu },
    newPacketSize: linkMtu, // the sender retries at the next-hop MTU
  };
}
