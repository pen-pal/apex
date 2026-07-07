// BitTorrent (BEP-3) core mechanics, modelled honestly. A file is split into fixed-size PIECES. A SWARM of peers
// each holds some pieces (a bitfield); you download from MANY peers at once. Two ideas keep a swarm healthy:
//  • RAREST-FIRST piece selection — always fetch the piece the FEWEST peers have, so no piece goes extinct when a
//    seed leaves, and copies spread evenly.
//  • CHOKE/UNCHOKE with TIT-FOR-TAT — you only upload ("unchoke") to the few peers giving you the best download
//    rate, reciprocating; plus one OPTIMISTIC unchoke (a random other peer) to discover better partners. Freeloaders
//    who never upload get choked.

export type Peer = { id: string; name: string; has: boolean[]; seed: boolean };

// rarity[i] = how many peers in the swarm currently hold piece i
export function rarity(peers: Peer[], nPieces: number): number[] {
  const r = new Array(nPieces).fill(0);
  for (const p of peers) for (let i = 0; i < nPieces; i++) if (p.has[i]) r[i]++;
  return r;
}

// rarest-first: among pieces you lack (that some peer has), pick the one the fewest peers hold; ties → lowest index.
export function rarestFirst(mine: boolean[], peers: Peer[]): number {
  const r = rarity(peers, mine.length);
  let best = -1, bestR = Infinity;
  for (let i = 0; i < mine.length; i++) {
    if (mine[i] || r[i] === 0) continue;
    if (r[i] < bestR) { bestR = r[i]; best = i; }
  }
  return best;
}

// who to fetch piece i from: prefer a NON-seed peer that has it (spread load off the seed, as real clients do), and
// fall back to the seed only when it's the sole source — so single-source pieces come from the seed and common ones
// spread across the swarm.
export function providerOf(peers: Peer[], i: number): Peer | null {
  return peers.find((p) => !p.seed && p.has[i]) ?? peers.find((p) => p.has[i]) ?? null;
}

// tit-for-tat unchoke: rank peers by the rate they've given you, unchoke the top k, plus one optimistic peer.
export function unchoke(rates: Record<string, number>, peers: Peer[], k: number, optimistic: string | null): Set<string> {
  const ranked = [...peers].sort((a, b) => (rates[b.id] ?? 0) - (rates[a.id] ?? 0));
  const set = new Set(ranked.slice(0, k).map((p) => p.id));
  if (optimistic) set.add(optimistic);
  return set;
}

export const complete = (bits: boolean[]): boolean => bits.every(Boolean);
