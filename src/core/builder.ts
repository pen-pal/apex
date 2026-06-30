import { crc32 } from './checksum';
import type { Connection, Registry } from './types';

/** Example endpoint values. The generator direction uses these to build a frame. */
export const DEFAULT_CONNECTION: Connection = {
  srcMac: [0xde, 0xad, 0xbe, 0xef, 0x00, 0x01],
  dstMac: [0x00, 0x1a, 0x2b, 0x3c, 0x4d, 0x5e],
  srcIp: [192, 168, 1, 42],
  dstIp: [142, 250, 72, 14],
  // 2001:db8::1 -> 2001:db8::2 (RFC 3849 documentation prefix)
  srcIp6: [0x20, 0x01, 0x0d, 0xb8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x01],
  dstIp6: [0x20, 0x01, 0x0d, 0xb8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x02],
  // 8080 is deliberately NOT a registered app port: the build-from-text demo shows
  // plain Ethernet/IPv4/TCP encapsulation, so arbitrary typed text stays the TCP
  // payload rather than being (mis)parsed as TLS/HTTP. Real app protocols are
  // dissected from real captures (see the Examples picker / protocol tests).
  srcPort: 49152, dstPort: 8080,
  seq: 0x1a2b3c4e, ack: 0x9f8e7d6c,
  flags: 0x18, window: 64240, ttl: 64,
};

export interface FrameSegment { id: string; label: string; bytes: number[]; }
export interface BuiltFrame { bytes: number[]; segments: FrameSegment[]; }

/**
 * Generic frame builder: wrap `payload` in each layer of `stack` (outermost
 * first) using the same `encode` the engine's specs declare, computing real
 * checksums. `leafId` is the protocol id of the payload, used to set the
 * innermost-encoded layer's demux field (EtherType / IP protocol). If the
 * stack starts at 'ethernet', a real CRC-32 FCS trailer is appended.
 *
 * e.g. buildStack(['ethernet','ipv4','udp'], dnsBytes, registry, conn, 'dns')
 *      -> a real Ethernet/IPv4/UDP frame carrying a DNS query.
 */
export function buildStack(
  stack: string[],
  payload: number[],
  registry: Registry,
  conn: Connection = DEFAULT_CONNECTION,
  leafId?: string,
): BuiltFrame {
  const headerSegs: FrameSegment[] = [];
  let inner = payload;
  for (let i = stack.length - 1; i >= 0; i--) {
    const spec = registry.get(stack[i]);
    if (!spec || !spec.encode) throw new Error(`No encoder for protocol "${stack[i]}"`);
    const childId = stack[i + 1] ?? leafId; // what's inside this layer
    const network = stack[i - 1]; // the layer that encloses this one (for pseudo-header choice)
    const hdr = spec.encode({ payload: inner, conn, childId, network });
    headerSegs.unshift({ id: stack[i], label: `${spec.name} header`, bytes: hdr });
    inner = hdr.concat(inner);
  }

  const segments: FrameSegment[] = [...headerSegs];
  if (payload.length) segments.push({ id: 'payload', label: 'Payload', bytes: payload });

  let bytes = inner;
  if (stack[0] === 'ethernet') {
    // IEEE 802.3 minimum frame is 64 bytes measured from the destination MAC
    // through the FCS, so the MAC header + L3 packet + any padding must reach
    // 60 bytes before the 4-byte FCS. A real NIC zero-pads short frames (small
    // IP packets) to this floor; we do the same so the bytes match the wire.
    // Padding is recovered as trailer on dissection — each layer bounds its own
    // PDU by its length field, so it never leaks into the payload.
    const MIN_BEFORE_FCS = 60;
    if (bytes.length < MIN_BEFORE_FCS) {
      const pad = new Array(MIN_BEFORE_FCS - bytes.length).fill(0);
      segments.push({ id: 'padding', label: 'Ethernet padding', bytes: pad });
      bytes = bytes.concat(pad);
    }
    const fcsVal = crc32(bytes);
    const fcs = [(fcsVal >>> 24) & 255, (fcsVal >>> 16) & 255, (fcsVal >>> 8) & 255, fcsVal & 255];
    bytes = bytes.concat(fcs);
    segments.push({ id: 'fcs', label: 'Ethernet FCS', bytes: fcs });
  }
  return { bytes, segments };
}

/** Compose payload -> TCP -> IPv4 -> Ethernet -> + FCS, using the same specs the engine reads. */
export function buildFrame(payload: number[], registry: Registry, conn: Connection = DEFAULT_CONNECTION): BuiltFrame {
  return buildStack(['ethernet', 'ipv4', 'tcp'], payload, registry, conn);
}
