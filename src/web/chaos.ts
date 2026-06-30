// Chaos engineering — deliberately breaking one thing to discover how far the damage spreads, and
// proving your resilience actually contains it. Services depend on each other; when one goes DOWN, every
// service with a HARD dependency on a down service goes down too, and the failure cascades up to the
// user. A RESILIENT service (one with a fallback, cached default, or sensible timeout) instead stays up
// in a DEGRADED mode when a dependency dies — which is exactly what stops a single backend hiccup from
// taking down the whole product. The "blast radius" is the set of services that actually go down; the
// goal of a chaos experiment is to inject a failure and confirm the blast radius is as small as your
// steady-state hypothesis says. Reference: Netflix Chaos Monkey / Principles of Chaos; Google SRE.

export interface Service { id: string; deps: string[]; resilient: boolean }
export type Status = 'up' | 'degraded' | 'down';
export interface ChaosResult { status: Record<string, Status>; down: string[]; degraded: string[] }

/** Evaluate the fleet when `failedId` is injected as DOWN. A service is down if it failed or has a
 *  hard (non-resilient) dependency that is down; a resilient service degrades instead of going down.
 *  A degraded dependency still responds, so it does NOT take its callers down. Computed as a monotone
 *  fixpoint over the down-set, so it's correct and order-independent even for CYCLIC dependency graphs. */
export function evaluate(services: Service[], failedId: string | null): ChaosResult {
  const down = new Set<string>();
  if (failedId !== null) down.add(failedId);

  // Grow the down-set until stable: any non-failed, non-resilient service with a down dependency goes
  // down. 'down' only ever spreads (the injected failure never recovers), so this converges; a cycle of
  // hard dependencies that touches a down service collapses entirely, independent of array order.
  let changed = true;
  while (changed) {
    changed = false;
    for (const s of services) {
      if (down.has(s.id) || s.resilient) continue;            // already down, or it degrades instead
      if (s.deps.some((d) => down.has(d))) { down.add(s.id); changed = true; }
    }
  }

  const status: Record<string, Status> = {};
  const degraded: string[] = [];
  for (const s of services) {
    if (down.has(s.id)) status[s.id] = 'down';
    else if (s.deps.some((d) => down.has(d))) { status[s.id] = 'degraded'; degraded.push(s.id); } // resilient + down dep
    else status[s.id] = 'up';
  }
  return { status, down: services.filter((s) => down.has(s.id)).map((s) => s.id), degraded };
}
