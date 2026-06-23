// NAT / PAT (port address translation) — how a whole home or office shares ONE
// public IP. The NAT box keeps a translation table: each outbound flow gets a
// unique public source port, so a reply addressed to (publicIP:port) can be demuxed
// back to the exact internal host:port that started it. Unsolicited inbound packets
// have no table entry, so they're dropped — that's the "firewall for free" effect.
// Pure, deterministic model (RFC 3022 / RFC 2663). Tested.

export interface Endpoint { ip: string; port: number }
export interface Mapping {
  innerIp: string;
  innerPort: number;
  publicPort: number; // the port NAT assigned on its single public IP
  dstIp: string;
  dstPort: number;
}

export interface OutboundResult {
  rewritten: Endpoint; // the new source the packet carries on the public side
  mapping: Mapping;
  created: boolean; // true if a new table entry was added (vs reused)
}

export interface InboundResult {
  delivered: boolean;
  to?: Endpoint; // the internal host:port it was demuxed to
  reason: string;
}

export class Nat {
  readonly publicIp: string;
  private table: Mapping[] = [];
  private nextPort: number;

  constructor(publicIp: string, firstPort = 50000) {
    this.publicIp = publicIp;
    this.nextPort = firstPort;
  }

  get mappings(): Mapping[] {
    return this.table.slice();
  }

  /** Translate an outbound packet, creating or reusing a mapping (PAT overload). */
  outbound(src: Endpoint, dst: Endpoint): OutboundResult {
    // reuse the existing mapping for this exact flow (same inner + same destination)
    const existing = this.table.find(
      (m) => m.innerIp === src.ip && m.innerPort === src.port && m.dstIp === dst.ip && m.dstPort === dst.port,
    );
    if (existing) {
      return { rewritten: { ip: this.publicIp, port: existing.publicPort }, mapping: existing, created: false };
    }
    const publicPort = this.allocatePort();
    const mapping: Mapping = { innerIp: src.ip, innerPort: src.port, publicPort, dstIp: dst.ip, dstPort: dst.port };
    this.table.push(mapping);
    return { rewritten: { ip: this.publicIp, port: publicPort }, mapping, created: true };
  }

  /** Demux a return packet (to publicIP:publicPort, from the original destination). */
  inbound(toPublicPort: number, from: Endpoint): InboundResult {
    const m = this.table.find((x) => x.publicPort === toPublicPort && x.dstIp === from.ip && x.dstPort === from.port);
    if (!m) {
      return { delivered: false, reason: `No table entry for ${this.publicIp}:${toPublicPort} from ${from.ip}:${from.port} — unsolicited, so it is dropped.` };
    }
    return { delivered: true, to: { ip: m.innerIp, port: m.innerPort }, reason: `Matched the table: delivered to ${m.innerIp}:${m.innerPort}.` };
  }

  private allocatePort(): number {
    // keep allocating fresh ports; never collide with a live mapping
    while (this.table.some((m) => m.publicPort === this.nextPort)) this.nextPort++;
    return this.nextPort++;
  }
}
