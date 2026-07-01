// Load balancing — how a front door spreads requests across backend servers. Six
// strategies, each with different behaviour under uneven load:
//   round-robin       — cycle through backends in order; even when requests differ
//   weighted RR       — bigger servers get proportionally more requests
//   least-connections — send to whoever has the fewest active requests (adapts)
//   ip-hash           — hash the client id → always the same backend (sticky sessions)
//   random            — pick a backend uniformly at random (cheap, but a bad tail)
//   power-of-two (p2c)— sample TWO random backends, send to the less-loaded one.
// P2C is the surprising one: adding a single extra random sample drops the busiest
// backend's load from O(log n / log log n) above average down to O(log log n) — an
// exponential improvement — with none of least-conn's need to scan every backend. It
// is the modern default (NGINX, HAProxy, Netflix, Envoy). A request occupies a backend
// for a duration; least-conn and p2c react to that, RR/random don't.
// Pure, deterministic model (seeded RNG). Tested.

export type Algo = 'round-robin' | 'weighted' | 'least-conn' | 'ip-hash' | 'random' | 'p2c';

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
  private seed: number; // seeded PRNG state for random / p2c (deterministic)

  constructor(algo: Algo, backends: { id: string; weight?: number }[], seed = 1) {
    this.algo = algo;
    this.seed = seed >>> 0;
    this.backends = backends.map((b) => ({ id: b.id, weight: b.weight ?? 1, active: 0, handled: 0 }));
    this.weightedSeq = [];
    this.backends.forEach((b, i) => { for (let w = 0; w < b.weight; w++) this.weightedSeq.push(i); });
  }

  // LCG in [0,1); divide by 2^31 (not the mask) so it never returns exactly 1.0 → floor stays in range.
  private rand(): number { this.seed = (Math.imul(this.seed, 1103515245) + 12345) & 0x7fffffff; return this.seed / 0x80000000; }
  private randIndex(n: number): number { return Math.floor(this.rand() * n); }

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
      case 'random':
        return this.randIndex(this.backends.length);
      case 'p2c': {
        // sample two DISTINCT backends, send to the one with fewer active requests
        const n = this.backends.length;
        if (n === 1) return 0;
        const i = this.randIndex(n);
        let j = this.randIndex(n - 1); if (j >= i) j++; // distinct second sample
        const bi = this.backends[i], bj = this.backends[j];
        // fewer active wins; tie-break by higher weight, then lower index — deterministic
        if (bj.active < bi.active || (bj.active === bi.active && bj.weight > bi.weight)) return j;
        return i;
      }
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

/** The busiest backend's count — the tail metric P2C is designed to shrink. */
export function maxLoad(counts: Record<string, number>): number {
  const v = Object.values(counts);
  return v.length ? Math.max(...v) : 0;
}
