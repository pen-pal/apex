// CRDTs — conflict-free replicated data types. Replicas edit independently while
// offline and later merge with NO coordination and NO conflicts, because the merge is a
// join in a semilattice: commutative, associative, and idempotent. So every replica
// that has seen the same set of updates converges to the same value, regardless of
// message order, duplication, or delay. We model a G-Counter (grow-only) and a
// last-write-wins register. Pure, deterministic; the lattice laws are tested.

// ── G-Counter: one count per replica; merge = elementwise max; value = sum ──
export type GCounter = Record<string, number>;

export const gIncrement = (c: GCounter, replica: string, by = 1): GCounter => ({ ...c, [replica]: (c[replica] ?? 0) + by });

export function gMerge(a: GCounter, b: GCounter): GCounter {
  const out: GCounter = { ...a };
  for (const k in b) out[k] = Math.max(out[k] ?? 0, b[k]);
  return out;
}

export const gValue = (c: GCounter): number => Object.values(c).reduce((s, n) => s + n, 0);

// ── LWW-Register: value tagged with a timestamp; higher timestamp wins ──
export interface LWW { value: string; ts: number; replica: string }

export function lwwMerge(a: LWW, b: LWW): LWW {
  // tiebreak chain (ts, then replica, then value) must be TOTAL so the result is the same
  // regardless of argument order — otherwise replicas merging in different orders diverge
  if (a.ts !== b.ts) return a.ts > b.ts ? a : b;
  if (a.replica !== b.replica) return a.replica > b.replica ? a : b;
  return a.value >= b.value ? a : b; // last resort: order-independent on the value itself
}
