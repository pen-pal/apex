// Gossip / epidemic dissemination — how a cluster spreads state (membership,
// config, a new value) without a central coordinator. Start with one node knowing
// the news; each round every informed node tells `fanout` random peers. The count
// informed follows an S-curve: a slow start, then near-exponential growth, then
// saturation as the last few uninformed nodes get harder to reach. It converges in
// about log_fanout(N) rounds — fast and resilient (no single point of failure).
// Deterministic via a seeded PRNG so the spread is reproducible and testable.

/** Mulberry32 — a tiny, fast, deterministic PRNG (so runs are reproducible). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface GossipRound {
  round: number;
  informed: boolean[]; // snapshot of who knows after this round
  count: number; // how many are informed
  newlyInformed: number[]; // node indices informed THIS round
  contacts: [number, number][]; // [from, to] pairs attempted this round (for the viz)
}

export interface GossipResult {
  n: number;
  fanout: number;
  rounds: GossipRound[]; // rounds[0] = the seed state
  roundsToFull: number; // first round where everyone is informed (or -1 if not)
}

/** Run push-gossip from node 0 with the given fanout until everyone knows (or maxRounds). */
export function gossip(n: number, fanout: number, seed = 1, maxRounds = 40): GossipResult {
  const rand = rng(seed);
  const informed = new Array<boolean>(n).fill(false);
  informed[0] = true;
  const rounds: GossipRound[] = [{ round: 0, informed: informed.slice(), count: 1, newlyInformed: [0], contacts: [] }];
  let roundsToFull = n === 1 ? 0 : -1;

  for (let r = 1; r <= maxRounds && roundsToFull < 0; r++) {
    const senders: number[] = [];
    for (let i = 0; i < n; i++) if (informed[i]) senders.push(i);
    const newly: number[] = [];
    const contacts: [number, number][] = [];

    for (const s of senders) {
      for (let f = 0; f < fanout; f++) {
        const target = Math.floor(rand() * n);
        if (target === s) continue; // don't gossip to yourself
        contacts.push([s, target]);
        if (!informed[target]) { informed[target] = true; newly.push(target); }
      }
    }
    const count = informed.filter(Boolean).length;
    rounds.push({ round: r, informed: informed.slice(), count, newlyInformed: newly, contacts });
    if (count === n) roundsToFull = r;
  }
  return { n, fanout, rounds, roundsToFull };
}
