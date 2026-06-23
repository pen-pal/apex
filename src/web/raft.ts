// Raft leader election — how a cluster agrees on ONE leader despite no shared
// clock and unreliable timing. Each node is a follower, candidate, or leader and
// tracks a monotonically increasing `term`. When a follower's election timer fires
// it becomes a candidate: it bumps its term, votes for itself, and sends RequestVote
// to everyone. A node grants its vote at most ONCE per term, to the first candidate
// whose term ≥ its own. A majority of votes makes a candidate the leader; a split
// vote elects no one and a new, higher-term election follows. Seeing a higher term
// always demotes you to follower. Deterministic model (Raft, Ongaro & Ousterhout).

export type Role = 'follower' | 'candidate' | 'leader';
export interface Node {
  id: number;
  role: Role;
  term: number;
  votedFor: number | null; // who this node voted for in its current term
}

export const majority = (n: number) => Math.floor(n / 2) + 1;

export function initCluster(n: number): Node[] {
  return Array.from({ length: n }, (_, id) => ({ id, role: 'follower', term: 0, votedFor: null }));
}

export interface VoteRequest { candidate: number; term: number }

/** RequestVote receiver rule: grant iff term ≥ ours AND we haven't voted this term. */
export function handleRequestVote(node: Node, req: VoteRequest): { granted: boolean; node: Node } {
  // a higher term always updates us and resets our vote
  let n = node;
  if (req.term > n.term) n = { ...n, term: req.term, role: 'follower', votedFor: null };
  if (req.term < n.term) return { granted: false, node: n }; // stale candidate
  if (n.votedFor === null || n.votedFor === req.candidate) {
    return { granted: true, node: { ...n, votedFor: req.candidate, term: req.term } };
  }
  return { granted: false, node: n }; // already voted for someone else this term
}

export interface ElectionResult {
  nodes: Node[];
  candidate: number;
  term: number;
  votes: number[]; // ids that granted the vote (incl. the candidate itself)
  outcome: 'leader' | 'split';
}

/**
 * Run one full election started by `starter`: it becomes a candidate at a new term,
 * everyone votes per the rules, and we tally. The `participating` predicate lets a
 * test/UI model crashed or partitioned nodes that don't respond.
 */
export function runElection(nodes: Node[], starter: number, participating: (id: number) => boolean = () => true): ElectionResult {
  const n = nodes.length;
  const term = Math.max(...nodes.map((x) => x.term)) + 1; // a fresh, higher term
  let cluster = nodes.map((x) => ({ ...x }));

  // candidate transitions and votes for itself
  cluster[starter] = { ...cluster[starter], role: 'candidate', term, votedFor: starter };
  const votes = [starter];

  // request votes from every other node that is reachable/alive
  for (let i = 0; i < n; i++) {
    if (i === starter || !participating(i)) continue;
    const res = handleRequestVote(cluster[i], { candidate: starter, term });
    cluster[i] = res.node;
    if (res.granted) votes.push(i);
  }

  const won = votes.length >= majority(n);
  if (won) {
    cluster[starter] = { ...cluster[starter], role: 'leader' };
    // followers learn of the leader via heartbeats (adopt the term, drop candidacy)
    cluster = cluster.map((x) => (x.id === starter ? x : { ...x, role: 'follower', term }));
  }
  return { nodes: cluster, candidate: starter, term, votes, outcome: won ? 'leader' : 'split' };
}

export interface RaceResult {
  nodes: Node[];
  term: number;
  tallies: Record<number, number[]>; // candidate id → voter ids (incl. itself)
  outcome: 'leader' | 'split';
  leader: number | null;
}

/**
 * Two (or more) candidates campaign in the SAME term — the classic split-vote case.
 * Each non-candidate node is asked by the candidates in a rotated order (so first-
 * dibs spreads around), and grants to the first valid asker. Without a majority,
 * the term ends with no leader. Deterministic.
 */
export function runRace(nodes: Node[], candidates: number[]): RaceResult {
  const n = nodes.length;
  const term = Math.max(...nodes.map((x) => x.term)) + 1;
  const cluster = nodes.map((x) => ({ ...x }));
  const tallies: Record<number, number[]> = {};
  for (const c of candidates) { cluster[c] = { ...cluster[c], role: 'candidate', term, votedFor: c }; tallies[c] = [c]; }

  for (let i = 0; i < n; i++) {
    if (candidates.includes(i)) continue;
    const order = candidates.slice(i % candidates.length).concat(candidates.slice(0, i % candidates.length));
    for (const c of order) {
      const res = handleRequestVote(cluster[i], { candidate: c, term });
      cluster[i] = res.node;
      if (res.granted) { tallies[c].push(i); break; }
    }
  }

  let leader: number | null = null;
  for (const c of candidates) if (tallies[c].length >= majority(n)) leader = c;
  if (leader !== null) {
    for (let i = 0; i < n; i++) cluster[i] = i === leader ? { ...cluster[i], role: 'leader' } : { ...cluster[i], role: 'follower', term };
  }
  return { nodes: cluster, term, tallies, outcome: leader !== null ? 'leader' : 'split', leader };
}

/** A leader that receives a message from a higher term steps down to follower. */
export function onHigherTerm(node: Node, term: number): Node {
  return term > node.term ? { ...node, role: 'follower', term, votedFor: null } : node;
}
