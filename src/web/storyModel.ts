// The Packet Story: a packet's whole life as one ordered, synchronized sequence.
// Each step spotlights a byte range, names the active layer, and explains WHY —
// derived entirely from the dissection tree + byte model + journey. One SimClock
// drives the byte strip, the layer stack, and the narration together. This is the
// thing only Apex does: the synchronization you otherwise do in your head.
import type { DissectionNode } from '../core/types';
import type { ByteModel } from './byteModel';
import type { JourneyModel } from './journeyModel';

export interface StoryStep {
  id: string;
  title: string;
  narration: string;
  highlight: number[]; // byte indices to spotlight
  layerId: string | null; // the layer this step is about
  phase: 'down' | 'wire' | 'router' | 'up'; // for the stage indicator
}

/** Byte indices owned by a given layer-depth + region, from the byte model. */
function indicesFor(model: ByteModel, pred: (depth: number, region: string) => boolean): number[] {
  return model.cells.filter((c) => pred(c.depth, c.region)).map((c) => c.index);
}

const fieldVal = (node: DissectionNode, name: string): string => {
  const f = node.header.fields.find((p) => p.field.name === name);
  return f ? f.display : '';
};

export function deriveStory(tree: DissectionNode, model: ByteModel, journey: JourneyModel, built = true): StoryStep[] {
  // Collect the layer nodes innermost-last (ethernet, ipv4, tcp).
  const nodes: DissectionNode[] = [];
  for (let n: DissectionNode | null = tree; n; n = n.child) nodes.push(n);
  const maxDepth = nodes.length - 1; // depth of the innermost header
  const leaf = nodes[nodes.length - 1];

  const steps: StoryStep[] = [];
  const payloadIdx = indicesFor(model, (_, region) => region === 'payload');

  // 1) The innermost data.
  const leafName = leaf.header.spec.name;
  steps.push({
    id: 'message',
    title: built ? 'Your message' : `The ${leafName} data`,
    narration: built
      ? (payloadIdx.length
          ? `It starts as plain bytes: “${journey.payloadAscii}” — ${journey.payloadLength} byte${journey.payloadLength === 1 ? '' : 's'} of application data, nothing wrapped around it yet.`
          : 'The application has bytes to send.')
      : `At the core sits ${leafName} — ${leaf.header.spec.summary}`,
    highlight: payloadIdx.length ? payloadIdx : indicesFor(model, (d) => d === maxDepth),
    layerId: leaf.header.spec.id,
    phase: 'down',
  });

  // 2) Wrap it, innermost header first (TCP), out to Ethernet.
  for (let depth = maxDepth; depth >= 0; depth--) {
    const node = nodes[depth];
    const spec = node.header.spec;
    steps.push({
      id: `wrap-${spec.id}`,
      title: `Wrap in ${spec.name}`,
      narration: `${spec.summary} ${layerWhy(spec.id, node)}`.trim(),
      highlight: indicesFor(model, (d, region) => d === depth && region === 'header'),
      layerId: spec.id,
      phase: 'down',
    });
  }

  // 3) On the wire.
  const headerTotal = journey.layers.reduce((s, l) => s + l.headerBytes, 0) + journey.trailerLength;
  steps.push({
    id: 'wire',
    title: 'On the wire',
    narration: `The finished frame — ${journey.totalBytes} bytes — goes out as a voltage/optical signal. Your ${journey.payloadLength}-byte message now rides inside ${headerTotal} bytes of headers and the CRC-32 trailer.`,
    highlight: model.cells.map((c) => c.index),
    layerId: null,
    phase: 'wire',
  });

  // 4) Through a router (if this is a routed Ethernet/IPv4 frame).
  if (journey.routerChanges.length) {
    const changed = journey.routerChanges.map((c) => `${c.field} ${c.before}→${c.after}`).join(', ');
    steps.push({
      id: 'router',
      title: 'Through a router',
      narration: `A router forwards it to the next hop: it rewrites the link layer and decrements the TTL, then recomputes everything that depends on those bytes — ${changed}. End-to-end fields (IPs, ports, seq) are untouched.`,
      highlight: indicesFor(model, (d, region) => (d <= 1 && region === 'header') || region === 'trailer'),
      layerId: 'ipv4',
      phase: 'router',
    });
  }

  // 5) Unwrap at the receiver, outermost header first, down to the message.
  for (let depth = 0; depth <= maxDepth; depth++) {
    const spec = nodes[depth].header.spec;
    steps.push({
      id: `peel-${spec.id}`,
      title: `Peel off ${spec.name}`,
      narration: `The receiver checks and strips the ${spec.name} header, handing the bytes inside up to the next layer.`,
      highlight: indicesFor(model, (d, region) => d === depth && region === 'header'),
      layerId: spec.id,
      phase: 'up',
    });
  }

  // 6) Delivered.
  steps.push({
    id: 'deliver',
    title: 'Delivered',
    narration: built
      ? `The application gets back exactly what was sent: “${journey.recovered}”. Every wrapper is removed; nothing was faked along the way.`
      : `Every header is stripped and the ${leafName} payload is handed up to the application.`,
    highlight: payloadIdx.length ? payloadIdx : indicesFor(model, (d) => d === maxDepth),
    layerId: leaf.header.spec.id,
    phase: 'up',
  });

  return steps;
}

/** A short, RFC-grounded "why" per known layer, using real field values. */
function layerWhy(id: string, node: DissectionNode): string {
  switch (id) {
    case 'tcp':
      return `Ports ${fieldVal(node, 'srcPort')}→${fieldVal(node, 'dstPort')} name the apps; the sequence number lets the far end reassemble the byte stream in order.`;
    case 'udp':
      return `Ports ${fieldVal(node, 'srcPort')}→${fieldVal(node, 'dstPort')} name the apps — but there's no handshake or ordering, just a length and a checksum.`;
    case 'ipv4':
      return `Source ${fieldVal(node, 'srcIp')} and destination ${fieldVal(node, 'dstIp')} let routers carry it across networks; TTL ${fieldVal(node, 'ttl')} stops it looping forever.`;
    case 'ipv6':
      return `128-bit source and destination addresses carry it across networks, with a hop limit instead of TTL.`;
    case 'ethernet':
      return `MAC addresses move it across this one physical link; a CRC-32 trailer lets the next device detect corruption.`;
    default:
      return '';
  }
}
