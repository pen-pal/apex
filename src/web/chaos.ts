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
 *  A degraded dependency still responds, so it does NOT take its callers down. */
export function evaluate(services: Service[], failedId: string | null): ChaosResult {
  const byId: Record<string, Service> = Object.fromEntries(services.map((s) => [s.id, s]));
  const memo: Record<string, Status> = {};
  const visiting = new Set<string>();

  const status = (id: string): Status => {
    if (memo[id]) return memo[id];
    if (visiting.has(id)) return 'up';          // dependency cycle guard
    visiting.add(id);
    const s = byId[id];
    let result: Status;
    if (id === failedId) result = 'down';
    else {
      const anyDepDown = s.deps.some((d) => status(d) === 'down');
      result = anyDepDown ? (s.resilient ? 'degraded' : 'down') : 'up';
    }
    visiting.delete(id);
    memo[id] = result;
    return result;
  };

  const statusMap: Record<string, Status> = {};
  for (const s of services) statusMap[s.id] = status(s.id);
  return {
    status: statusMap,
    down: services.filter((s) => statusMap[s.id] === 'down').map((s) => s.id),
    degraded: services.filter((s) => statusMap[s.id] === 'degraded').map((s) => s.id),
  };
}
