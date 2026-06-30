// Hinted handoff — how Dynamo-style stores (Cassandra, Riak, DynamoDB) keep accepting writes when a
// replica is down. Each key has a PREFERENCE LIST of nodes; the first N are its "home" replicas. If one of
// them is unreachable, the coordinator doesn't fail the write — it hands the value to the next healthy node
// on the ring with a HINT: "this really belongs to node X; hold it for them." The hint still counts toward
// the write quorum (a "sloppy quorum"), so the write stays available. When X comes back, whoever holds its
// hints REPLAYS them and deletes them. The result is high write availability with eventual consistency —
// the write is durable on N nodes immediately, just not all the "right" ones until recovery. Reference:
// DeCandia et al., "Dynamo: Amazon's Highly Available Key-value Store" (SOSP 2007).

export interface Node { id: string; up: boolean }
export interface Hint { key: string; value: string; intendedFor: string; storedOn: string }
export interface Placement { node: string; role: 'replica' | 'hint'; for?: string }
export interface WriteResult { acks: number; satisfied: boolean; placements: Placement[]; hints: Hint[]; durableHome: number }

/** Write `key`=`value` with replication factor N and write quorum W over an ordered preference list. Healthy
 *  home replicas (first N) store normally; for each DOWN home replica, the next healthy node beyond the home
 *  set takes a hint. The write is satisfied if total acks (replicas + hints) ≥ W — a sloppy quorum. */
export function write(key: string, value: string, prefList: Node[], N: number, W: number): WriteResult {
  const placements: Placement[] = [];
  const hints: Hint[] = [];
  const used = new Set<string>();
  const homeDown: string[] = [];

  for (let i = 0; i < N && i < prefList.length; i++) {
    const node = prefList[i];
    if (node.up) { placements.push({ node: node.id, role: 'replica' }); used.add(node.id); }
    else homeDown.push(node.id);
  }

  // hand each down home replica's write to the next healthy fallback node (beyond the home set)
  let j = N;
  for (const downId of homeDown) {
    while (j < prefList.length && (!prefList[j].up || used.has(prefList[j].id))) j++;
    if (j < prefList.length) {
      const h = prefList[j];
      placements.push({ node: h.id, role: 'hint', for: downId });
      hints.push({ key, value, intendedFor: downId, storedOn: h.id });
      used.add(h.id); j++;
    }
    // if we run out of healthy fallbacks, this replica simply gets no copy (acks fall short)
  }

  const acks = placements.length;
  const durableHome = placements.filter((p) => p.role === 'replica').length;
  return { acks, satisfied: acks >= W, placements, hints, durableHome };
}

/** A node recovers: replay every hint destined for it, and return the hints that remain elsewhere. */
export function recover(nodeId: string, hints: Hint[]): { replayed: Hint[]; remaining: Hint[] } {
  return {
    replayed: hints.filter((h) => h.intendedFor === nodeId),
    remaining: hints.filter((h) => h.intendedFor !== nodeId),
  };
}
