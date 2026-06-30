// Journey / encapsulation derivation. Everything here comes from engine data:
// the dissection tree's `child` chain (the nested layers) and the builder's
// segments (the flat byte layout). The router re-wrap is produced by rebuilding
// the frame through the SAME specs with a next-hop connection (TTL-1, new MACs)
// and diffing the two dissections — so no protocol offsets live in the view.
import { buildFrame, DEFAULT_CONNECTION } from '../core/builder';
import { dissect } from '../core/engine';
import type { Connection, DissectionNode, Registry } from '../core/types';

/** One layer in the encapsulation nest, outermost (depth 0) first. */
export interface JourneyLayer {
  depth: number;
  id: string;
  name: string;
  layer: number; // OSI-ish number
  headerBytes: number; // overhead this layer adds
  summary: string;
}

/** A segment of the flat on-the-wire byte layout. */
export interface JourneySegment {
  id: string;
  label: string;
  length: number;
}

/** A field whose value the router changed, before -> after (both really computed). */
export interface FieldChange {
  layer: string;
  field: string;
  before: string;
  after: string;
  beforeMeaning?: string;
  afterMeaning?: string;
}

export interface JourneyModel {
  layers: JourneyLayer[]; // ethernet, ipv4, tcp …
  payloadLength: number;
  payloadAscii: string;
  trailerLength: number; // FCS
  segments: JourneySegment[]; // for the proportional bar
  totalBytes: number;
  frameBytes: number[]; // for the on-the-wire signal
  routerChanges: FieldChange[]; // what a hop rewrites
  recovered: string; // payload recovered by the engine (proves round-trip)
}

// Example wire values for the next hop. Like DEFAULT_CONNECTION, these are just
// endpoint data used to BUILD a frame — not protocol logic.
const ROUTER_EGRESS_MAC = [0x00, 0x25, 0x96, 0xab, 0xcd, 0xef];
const NEXT_HOP_MAC = [0xfe, 0xed, 0xfa, 0xce, 0x00, 0x01];

const ascii = (bytes: number[]) =>
  bytes.map((b) => (b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : '·')).join('');

/** Collect the layer chain and the innermost (leaf) node carrying the payload. */
function chain(root: DissectionNode): { layers: JourneyLayer[]; leaf: DissectionNode } {
  const layers: JourneyLayer[] = [];
  let node: DissectionNode = root;
  let depth = 0;
  for (;;) {
    const s = node.header.spec;
    layers.push({ depth, id: s.id, name: s.name, layer: s.layer, headerBytes: node.header.byteLength, summary: s.summary });
    if (!node.child) return { layers, leaf: node };
    node = node.child;
    depth++;
  }
}

/** Walk two dissections in lockstep and report every field (and trailer) the router changed. */
function diffHops(a: DissectionNode, b: DissectionNode): FieldChange[] {
  const out: FieldChange[] = [];
  let na: DissectionNode | null = a;
  let nb: DissectionNode | null = b;
  while (na && nb) {
    const fa = na.header.fields;
    const fb = nb.header.fields;
    for (let i = 0; i < fa.length && i < fb.length; i++) {
      if (fa[i].display !== fb[i].display) {
        out.push({
          layer: na.header.spec.name,
          field: fa[i].field.label,
          before: fa[i].display,
          after: fb[i].display,
          beforeMeaning: fa[i].meaning,
          afterMeaning: fb[i].meaning,
        });
      }
    }
    if (na.trailer.length && na.trailer.join(',') !== nb.trailer.join(',')) {
      const hex = (bs: number[]) => bs.map((x) => x.toString(16).toUpperCase().padStart(2, '0')).join(' ');
      out.push({
        layer: 'Frame',
        field: 'FCS / trailer',
        before: hex(na.trailer),
        after: hex(nb.trailer),
        beforeMeaning: 'CRC-32 over the frame',
        afterMeaning: 'recomputed for the new frame',
      });
    }
    na = na.child;
    nb = nb.child;
  }
  return out;
}

/** Flat byte layout from any tree: each layer's header in order, then the leaf
 *  payload, then trailers (innermost-first, matching their physical position). */
function segmentsFromTree(tree: DissectionNode): { segments: JourneySegment[]; trailerLength: number } {
  const headers: JourneySegment[] = [];
  const trailers: { seg: JourneySegment; depth: number }[] = [];
  let leaf: DissectionNode = tree;
  let depth = 0;
  for (let n: DissectionNode | null = tree; n; n = n.child, depth++) {
    headers.push({ id: n.header.spec.id, label: `${n.header.spec.name} header`, length: n.header.byteLength });
    // The Ethernet FCS (and any 802.3 zero-padding for short frames) surfaces as
    // trailing bytes past the innermost length-bounded layer: 4 bytes = the FCS
    // alone; more than 4 = zero-padding + FCS.
    if (n.trailer.length) trailers.push({ seg: { id: 'fcs', label: n.trailer.length > 4 ? 'padding + FCS' : 'FCS', length: n.trailer.length }, depth });
    if (!n.child) leaf = n;
  }
  const segments = [...headers];
  if (leaf.payload.length) segments.push({ id: 'payload', label: 'Payload', length: leaf.payload.length });
  trailers.sort((a, b) => b.depth - a.depth).forEach((t) => segments.push(t.seg));
  const trailerLength = trailers.reduce((s, t) => s + t.seg.length, 0);
  return { segments, trailerLength };
}

/** Generic journey derived from ANY dissection tree (no router re-wrap). */
export function journeyFromTree(tree: DissectionNode): JourneyModel {
  const { layers, leaf } = chain(tree);
  const { segments, trailerLength } = segmentsFromTree(tree);
  return {
    layers,
    payloadLength: leaf.payload.length,
    payloadAscii: ascii(leaf.payload),
    trailerLength,
    segments,
    totalBytes: tree.raw.length,
    frameBytes: tree.raw,
    routerChanges: [],
    recovered: new TextDecoder().decode(Uint8Array.from(leaf.payload)),
  };
}

/** The built-from-text journey: a full Ethernet/IPv4/TCP frame, with the router re-wrap. */
export function buildJourney(payload: number[], registry: Registry, conn: Connection = DEFAULT_CONNECTION): JourneyModel {
  const safe = payload.length ? payload : [0];

  // Hop 1: as the sender puts it on the wire.
  const frame1 = buildFrame(safe, registry, conn);
  const tree1 = dissect(frame1.bytes, 'ethernet', registry);

  // Hop 2: a router forwards it — same payload, decremented TTL, rewritten link layer.
  const hop2: Connection = { ...conn, srcMac: ROUTER_EGRESS_MAC, dstMac: NEXT_HOP_MAC, ttl: conn.ttl - 1 };
  const tree2 = dissect(buildFrame(safe, registry, hop2).bytes, 'ethernet', registry);

  return { ...journeyFromTree(tree1), routerChanges: diffHops(tree1, tree2) };
}
