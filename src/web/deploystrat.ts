// Deployment strategies — how you ship v2 without (usually) taking the service down. Same goal, very
// different risk/cost trade-offs, and they're best understood by watching the fleet change version and
// the traffic re-route step by step:
//   • recreate   — stop all v1, start all v2. Simplest, but a window of full DOWNTIME.
//   • rolling    — replace instances a batch at a time. Zero downtime, but v1 and v2 serve at once
//                  (must be compatible) and capacity dips by a batch during each swap.
//   • blue-green — stand up a full v2 environment beside v1, smoke-test it at 0% traffic, then flip the
//                  router atomically. Instant cutover and instant rollback, but needs 2× capacity.
//   • canary     — send a small slice of traffic to one v2 instance, watch error rate/latency, then ramp.
//                  Safest for catching a bad release, at the cost of a slower, more complex rollout.
// Each strategy is a deterministic sequence of fleet states; availability falls straight out of how many
// instances are up. Reference: Humble & Farley, "Continuous Delivery"; Google SRE Workbook (canarying).

export type Version = 'v1' | 'v2' | 'down';
export type Strategy = 'recreate' | 'rolling' | 'bluegreen' | 'canary';
export interface Step { instances: Version[]; trafficV2: number; phase: string }

export const availability = (s: Step) => Math.round((s.instances.filter((v) => v !== 'down').length / s.instances.length) * 100);
const fill = (n: number, v: Version) => Array<Version>(n).fill(v);
const countV2 = (a: Version[]) => a.filter((v) => v === 'v2').length;

export function simulate(strategy: Strategy, n: number, batch = 1): Step[] {
  switch (strategy) {
    case 'recreate':
      return [
        { instances: fill(n, 'v1'), trafficV2: 0, phase: 'v1 in production' },
        { instances: fill(n, 'down'), trafficV2: 0, phase: 'all v1 stopped — DOWNTIME while v2 boots' },
        { instances: fill(n, 'v2'), trafficV2: 100, phase: 'v2 started — back online' },
      ];

    case 'rolling': {
      const steps: Step[] = [{ instances: fill(n, 'v1'), trafficV2: 0, phase: 'v1 in production' }];
      let cur = fill(n, 'v1');
      for (let i = 0; i < n; i += batch) {
        const draining = [...cur];
        for (let j = i; j < Math.min(i + batch, n); j++) draining[j] = 'down';
        steps.push({ instances: draining, trafficV2: Math.round((countV2(draining) / n) * 100), phase: `draining ${Math.min(batch, n - i)} instance(s) → capacity dips` });
        cur = [...cur];
        for (let j = i; j < Math.min(i + batch, n); j++) cur[j] = 'v2';
        steps.push({ instances: cur, trafficV2: Math.round((countV2(cur) / n) * 100), phase: `${countV2(cur)}/${n} on v2 (v1 and v2 serve together)` });
      }
      return steps;
    }

    case 'bluegreen':
      return [
        { instances: fill(n, 'v1'), trafficV2: 0, phase: 'green (v1) live; blue (v2) provisioned in parallel' },
        { instances: fill(n, 'v1'), trafficV2: 0, phase: 'blue (v2) fully up & smoke-tested — still 0% traffic' },
        { instances: fill(n, 'v2'), trafficV2: 100, phase: 'atomic router flip → blue (v2) live; green kept warm for instant rollback' },
      ];

    case 'canary': {
      const one = fill(n, 'v1'); one[0] = 'v2';
      const half = Array.from({ length: n }, (_, i) => (i < Math.ceil(n / 2) ? 'v2' : 'v1') as Version);
      return [
        { instances: fill(n, 'v1'), trafficV2: 0, phase: '100% on v1' },
        { instances: one, trafficV2: 5, phase: 'one canary on v2 — route 5% of traffic, watch error rate & latency' },
        { instances: half, trafficV2: 50, phase: 'canary healthy → ramp to 50%' },
        { instances: fill(n, 'v2'), trafficV2: 100, phase: 'full rollout to v2' },
      ];
    }
  }
}

export const STRATEGY_LABEL: Record<Strategy, string> = { recreate: 'Recreate', rolling: 'Rolling', bluegreen: 'Blue-green', canary: 'Canary' };
/** The minimum availability across a strategy's rollout — 0 means it has a downtime window. */
export const minAvailability = (steps: Step[]) => Math.min(...steps.map(availability));
