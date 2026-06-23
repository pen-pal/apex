// Load balancing — how a front door spreads requests across backend servers. Four
// classic strategies, each with different behaviour under uneven load:
//   round-robin       — cycle through backends in order; even when requests differ
//   weighted RR       — bigger servers get proportionally more requests
//   least-connections — send to whoever has the fewest active requests (adapts)
//   ip-hash           — hash the client id → always the same backend (sticky sessions)
// A request occupies a backend for a duration; least-conn reacts to that, RR doesn't.
// Pure, deterministic model. Tested.

export type Algo = 'round-robin' | 'weighted' | 'least-conn' | 'ip-hash';

export interface Backend {
  id: string;
  weight: number; // for weighted RR (and a tie-break hint)
  active: number; // current in-flight requests
  handled: number; // total requests dispatched here
}

export interface Req { client: string; duration: number }

export interface Assignment { req: Req; backend: string; at: number }

function fnv(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}

export class Balancer {
  readonly algo: Algo;
  readonly backends: Backend[];
  private rr = 0; // round-robin cursor
  private wrr = 0; // weighted expanded cursor
  private weightedSeq: number[]; // expanded index list for weighted RR
  private clock = 0;

  constructor(algo: Algo, backends: { id: string; weight?: number }[]) {
    this.algo = algo;
    this.backends = backends.map((b) => ({ id: b.id, weight: b.weight ?? 1, active: 0, handled: 0 }));
    this.weightedSeq = [];
    this.backends.forEach((b, i) => { for (let w = 0; w < b.weight; w++) this.weightedSeq.push(i); });
  }

  /** Free a backend slot when a request finishes (active--). */
  release(backendId: string): void {
    const b = this.backends.find((x) => x.id === backendId);
    if (b && b.active > 0) b.active--;
  }

  /** Dispatch one request, returning which backend it landed on. */
  dispatch(req: Req): Assignment {
    this.clock++;
    const idx = this.pick(req);
    const b = this.backends[idx];
    b.active++; b.handled++;
    return { req, backend: b.id, at: this.clock };
  }

  private pick(req: Req): number {
    switch (this.algo) {
      case 'round-robin': {
        const i = this.rr % this.backends.length; this.rr++; return i;
      }
      case 'weighted': {
        const i = this.weightedSeq[this.wrr % this.weightedSeq.length]; this.wrr++; return i;
      }
      case 'least-conn': {
        // fewest active; tie-break by higher weight, then by index for determinism
        let best = 0;
        for (let i = 1; i < this.backends.length; i++) {
          const a = this.backends[i], b = this.backends[best];
          if (a.active < b.active || (a.active === b.active && a.weight > b.weight)) best = i;
        }
        return best;
      }
      case 'ip-hash':
        return fnv(req.client) % this.backends.length;
    }
  }

  /** A snapshot of handled counts keyed by backend id. */
  get handledMap(): Record<string, number> {
    return Object.fromEntries(this.backends.map((b) => [b.id, b.handled]));
  }
}

/** Skew = max−min handled count (0 = perfectly even). */
export function skew(handled: Record<string, number>): number {
  const v = Object.values(handled);
  return v.length ? Math.max(...v) - Math.min(...v) : 0;
}
