// A learning Ethernet switch — how a switch forwards frames without any config.
// It keeps a CAM (content-addressable memory) table of MAC → port. For each frame
// it does two things (IEEE 802.1D §7.8):
//   1. LEARN: record that the SOURCE MAC lives on the ingress port (refreshing age).
//   2. FORWARD: if the DESTINATION MAC is a known unicast on a *different* port,
//      send only out that port; if it's the same port, drop it (already delivered);
//      if it's unknown or broadcast, FLOOD out every port except the ingress.
// This is why the first packet to a new host floods, and later ones don't. Tested.

export const BROADCAST = 'ff:ff:ff:ff:ff:ff';

export interface CamEntry { mac: string; port: number; age: number }
export type Action = 'flood-unknown' | 'flood-broadcast' | 'forward' | 'filter';

export interface SwitchResult {
  learned: boolean; // did this frame add/move a CAM entry?
  action: Action;
  egress: number[]; // ports the frame is sent out of
  reason: string;
}

export class Switch {
  readonly ports: number;
  private cam: Map<string, CamEntry> = new Map();
  private clock = 0;

  constructor(ports: number) { this.ports = ports; }

  get table(): CamEntry[] {
    return [...this.cam.values()].sort((a, b) => a.port - b.port);
  }

  lookup(mac: string): number | null {
    return this.cam.get(mac)?.port ?? null;
  }

  /** Process a frame {src,dst,inPort}: learn the source, then decide forwarding. */
  frame(src: string, dst: string, inPort: number): SwitchResult {
    this.clock++;
    // 1. LEARN the source MAC on the ingress port (new entry, or moved/refreshed)
    const prev = this.cam.get(src);
    const learned = !prev || prev.port !== inPort;
    this.cam.set(src, { mac: src, port: inPort, age: this.clock });

    // 2. FORWARD based on the destination
    const others = this.allPortsExcept(inPort);
    if (dst === BROADCAST) {
      return { learned, action: 'flood-broadcast', egress: others, reason: 'Broadcast destination → flood out every other port.' };
    }
    const dstPort = this.cam.get(dst)?.port ?? null;
    if (dstPort === null) {
      return { learned, action: 'flood-unknown', egress: others, reason: `${dst} is not in the CAM table yet → flood (unknown-unicast) and learn from the reply.` };
    }
    if (dstPort === inPort) {
      return { learned, action: 'filter', egress: [], reason: `${dst} is on the SAME port the frame arrived on → drop it (already delivered on that segment).` };
    }
    return { learned, action: 'forward', egress: [dstPort], reason: `${dst} is known on port ${dstPort} → forward only there (no flooding).` };
  }

  /** Remove CAM entries older than `maxAge` ticks (aging). */
  age(maxAge: number): void {
    for (const [mac, e] of this.cam) if (this.clock - e.age >= maxAge) this.cam.delete(mac);
  }

  private allPortsExcept(p: number): number[] {
    const out: number[] = [];
    for (let i = 1; i <= this.ports; i++) if (i !== p) out.push(i);
    return out;
  }
}
