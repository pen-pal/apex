// QoS packet scheduling — when many traffic classes share one output link, which
// packet goes next? Two classic disciplines, with very different fairness:
//   STRICT PRIORITY  — always serve the highest-priority non-empty class first.
//                      Latency-perfect for the top class, but a busy high class can
//                      STARVE the low ones (bulk never leaves while VoIP keeps coming).
//   WEIGHTED ROUND ROBIN — give each class a share of the link proportional to its
//                      weight, cycling so nobody starves (the basis of WFQ/DRR).
// We dequeue a fixed number of "slots" and record the output order + per-class share.
// Pure, deterministic model. Tested.

export interface TClass {
  id: string;
  priority: number; // lower number = higher priority (for strict priority)
  weight: number; // for weighted round robin (slots per round)
  queue: number; // packets waiting
}
export type Discipline = 'priority' | 'wrr';

export interface ScheduleResult {
  order: string[]; // the class id served at each output slot
  share: Record<string, number>; // packets sent per class
  starved: string[]; // classes that had packets but sent none
}

/** Schedule `slots` output opportunities over the classes under `discipline`. */
export function schedule(classes: TClass[], discipline: Discipline, slots: number): ScheduleResult {
  const q: Record<string, number> = {};
  for (const c of classes) q[c.id] = c.queue;
  const order: string[] = [];
  const share: Record<string, number> = Object.fromEntries(classes.map((c) => [c.id, 0]));

  if (discipline === 'priority') {
    const byPrio = [...classes].sort((a, b) => a.priority - b.priority);
    for (let s = 0; s < slots; s++) {
      const c = byPrio.find((x) => q[x.id] > 0);
      if (!c) break; // nothing to send
      q[c.id]--; share[c.id]++; order.push(c.id);
    }
  } else {
    // weighted round robin: each round, serve up to `weight` packets per class
    let sent = 0;
    let progress = true;
    while (sent < slots && progress) {
      progress = false;
      for (const c of classes) {
        for (let w = 0; w < c.weight && sent < slots; w++) {
          if (q[c.id] > 0) { q[c.id]--; share[c.id]++; order.push(c.id); sent++; progress = true; }
        }
      }
    }
  }

  const starved = classes.filter((c) => c.queue > 0 && share[c.id] === 0).map((c) => c.id);
  return { order, share, starved };
}
