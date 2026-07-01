// The bulkhead pattern — named after a ship's watertight compartments: flood one, the others stay dry and the
// ship floats. In a service, the "resource" is a bounded pool of threads or connections, and the "compartments"
// are your downstream dependencies. The classic outage: your service calls dependencies A, B, and C from one
// SHARED pool of N slots. C gets slow (a GC pause, a locked table, a dead replica). Requests to C pile up,
// each holding a slot while it waits — and because the pool is shared, they consume ALL N slots. Now calls to
// the perfectly-healthy A and B can't get a slot either, and your whole service goes down because of one sick
// dependency. The bulkhead fix: give each dependency its OWN sub-pool (cap N/k slots). When C floods, it can
// only exhaust its own compartment; A and B keep their slots and keep serving. You trade a little peak capacity
// for blast-radius containment. Slots-in-use follows Little's law: a dependency at `rate` req/s with `latency`
// seconds each holds rate×latency slots concurrently. Reference: Nygard, "Release It!" (Bulkheads);
// Hystrix/resilience4j thread-pool isolation.

export interface Dep { name: string; rate: number; latencyMs: number } // requests/sec, per-request latency

export interface DepOutcome { name: string; demand: number; served: number; healthy: boolean }

export interface Result {
  poolSize: number;
  shared: { totalDemand: number; saturated: boolean; deps: DepOutcome[] };
  bulkhead: { capPerDep: number; deps: DepOutcome[] };
}

const demandOf = (d: Dep) => d.rate * (d.latencyMs / 1000); // concurrent slots needed (Little's law)

export function analyze(deps: Dep[], poolSize: number): Result {
  const totalDemand = deps.reduce((s, d) => s + demandOf(d), 0);
  const saturated = totalDemand > poolSize; // one shared pool: if total demand exceeds it, it's full for EVERYONE

  const shared = {
    totalDemand,
    saturated,
    // when the shared pool saturates, every dependency is starved of slots — the whole service degrades
    deps: deps.map((d) => ({ name: d.name, demand: demandOf(d), served: saturated ? 0 : demandOf(d), healthy: !saturated })),
  };

  const capPerDep = poolSize / deps.length; // each dependency gets its own compartment
  const bulkhead = {
    capPerDep,
    // a dependency can only exhaust its OWN cap; others are unaffected
    deps: deps.map((d) => {
      const demand = demandOf(d);
      return { name: d.name, demand, served: Math.min(demand, capPerDep), healthy: demand <= capPerDep };
    }),
  };

  return { poolSize, shared, bulkhead };
}
