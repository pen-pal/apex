// Chain replication — a way to keep N replicas strongly consistent that's simpler than quorums and gives
// linearizable reads cheaply. Arrange the replicas in a CHAIN: head → middle(s) → tail. A WRITE goes to the
// head and propagates down the chain one node at a time; it is COMMITTED only when it reaches the TAIL,
// which then acks the client. A READ is served entirely by the TAIL — and because the tail only holds
// values that have made it all the way down, every read sees the latest committed write: strong consistency,
// no quorum math, and reads don't touch the head at all (great read throughput). Failures are easy: lose the
// head → its successor becomes head; lose the tail → its predecessor becomes tail; lose a middle node → link
// around it. Reference: van Renesse & Schneider, "Chain Replication for Supporting High Throughput and
// Availability" (OSDI 2004); CRAQ extends it to read from any node.

export interface NodeState { id: string; value: string }

/** Snapshot of every node's value while a new write is in flight, propagated to `depth` (0 = head only,
 *  ids.length-1 = reached the tail). Nodes at index ≤ depth hold newV; the rest still hold oldV. */
export function propagate(ids: string[], oldV: string, newV: string, depth: number): NodeState[] {
  return ids.map((id, i) => ({ id, value: i <= depth ? newV : oldV }));
}

/** A write is committed exactly when it has propagated all the way to the tail. */
export const isCommitted = (ids: string[], depth: number): boolean => depth >= ids.length - 1;

/** Reads are served by the tail — so they only ever return committed values (the new write isn't visible
 *  until it reaches the tail). This is what makes chain replication linearizable. */
export function read(state: NodeState[]): string {
  return state[state.length - 1].value;
}

export interface Reconfig { newChain: string[]; newHead: string; newTail: string; role: 'head' | 'tail' | 'middle' }

/** Reconfigure the chain after a node fails: drop it and relabel head/tail. */
export function reconfigure(ids: string[], failed: string): Reconfig {
  const idx = ids.indexOf(failed);
  const role = idx === 0 ? 'head' : idx === ids.length - 1 ? 'tail' : 'middle';
  const newChain = ids.filter((id) => id !== failed);
  return { newChain, newHead: newChain[0], newTail: newChain[newChain.length - 1], role };
}
