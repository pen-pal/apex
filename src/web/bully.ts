// The Bully algorithm for leader election (Garcia-Molina, 1982). When the coordinator
// dies, the live node with the HIGHEST id should take over. A node that notices the gap
// starts an election: it sends ELECTION to every higher-id node. Any live higher node
// answers OK ("I'll take it from here") and starts its own election upward. Whoever gets
// no OK back is the highest alive — it declares itself by broadcasting COORDINATOR. So the
// winner is always max(alive), no matter who starts. Pure model; the outcome and the
// message flow are tested.

export type MsgType = 'ELECTION' | 'OK' | 'COORDINATOR';
export interface Message { round: number; type: MsgType; from: number; to: number }

export interface Election { messages: Message[]; coordinator: number }

/** Run a Bully election. `nodes` are all node ids; `alive` is the set still up; `starter`
 *  is the node that first notices the coordinator is gone and kicks it off. */
export function runElection(nodes: number[], alive: Set<number>, starter: number): Election {
  const sorted = [...nodes].sort((a, b) => a - b);
  const coordinator = Math.max(...sorted.filter((n) => alive.has(n)));
  const messages: Message[] = [];

  // every live node from the starter up runs its own election (it received an ELECTION
  // and answers by starting one toward still-higher nodes)
  const runners = sorted.filter((n) => n === starter || (n > starter && alive.has(n)));

  runners.forEach((r, i) => {
    const higher = sorted.filter((n) => n > r);
    for (const h of higher) {
      messages.push({ round: i, type: 'ELECTION', from: r, to: h });
      if (alive.has(h)) messages.push({ round: i, type: 'OK', from: h, to: r });
    }
  });

  // the highest alive node got no OK → it announces itself to everyone else
  const announceRound = runners.length;
  for (const n of sorted) if (n !== coordinator) messages.push({ round: announceRound, type: 'COORDINATOR', from: coordinator, to: n });

  return { messages, coordinator };
}
