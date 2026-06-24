// Two-phase locking (2PL) and deadlock — the lock-based alternative to MVCC for keeping
// concurrent transactions correct. Before touching a row a transaction must take a lock:
// SHARED (read) locks coexist, but an EXCLUSIVE (write) lock conflicts with everything. If
// the lock you want is held incompatibly, you WAIT. The danger: two transactions can each
// wait for a lock the other holds — a cycle in the "wait-for" graph, a deadlock that never
// resolves on its own. Databases detect the cycle and abort a victim. This models the lock
// table, the wait-for graph, and cycle detection. Pure, tested.

export type Mode = 'S' | 'X';
export interface Request { txid: number; resource: string; mode: Mode }

interface Hold { txid: number; mode: Mode }

const compatible = (a: Mode, b: Mode) => a === 'S' && b === 'S'; // only shared+shared coexist

export interface Outcome {
  granted: Request[];
  waiting: Request[];
  holders: Record<string, Hold[]>;
  waitFor: [number, number][]; // edge txid_i → txid_j : i waits for j
  deadlock: number[] | null;   // the txids in a wait cycle, or null
}

/** Process lock requests in order; a request that can't be granted blocks and adds wait-for
 *  edges to every transaction currently holding the resource incompatibly. */
export function run(requests: Request[]): Outcome {
  const holders: Record<string, Hold[]> = {};
  const granted: Request[] = [];
  const waiting: Request[] = [];
  const waitFor: [number, number][] = [];

  for (const req of requests) {
    const held = holders[req.resource] ?? (holders[req.resource] = []);
    if (held.some((h) => h.txid === req.txid)) { granted.push(req); continue; } // already holds it
    const conflicts = held.filter((h) => !compatible(h.mode, req.mode));
    if (conflicts.length === 0) { held.push({ txid: req.txid, mode: req.mode }); granted.push(req); }
    else { waiting.push(req); for (const h of conflicts) waitFor.push([req.txid, h.txid]); }
  }

  return { granted, waiting, holders, waitFor, deadlock: findCycle(waitFor) };
}

/** Find one cycle in the wait-for graph (DFS), returning the txids on it. */
export function findCycle(edges: [number, number][]): number[] | null {
  const adj = new Map<number, number[]>();
  for (const [a, b] of edges) (adj.get(a) ?? adj.set(a, []).get(a)!).push(b);
  const state = new Map<number, number>(); // 0=unseen,1=on-stack,2=done
  const stack: number[] = [];

  const dfs = (u: number): number[] | null => {
    state.set(u, 1); stack.push(u);
    for (const v of adj.get(u) ?? []) {
      if (state.get(v) === 1) return stack.slice(stack.indexOf(v)); // back-edge → cycle
      if (!state.get(v)) { const c = dfs(v); if (c) return c; }
    }
    state.set(u, 2); stack.pop();
    return null;
  };

  for (const node of adj.keys()) if (!state.get(node)) { const c = dfs(node); if (c) return c; }
  return null;
}
