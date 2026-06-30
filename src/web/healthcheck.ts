// Liveness vs readiness probes — the Kubernetes distinction that, gotten wrong, causes restart storms.
// They answer different questions. READINESS: "should this instance receive traffic right now?" — if it
// fails, the load balancer simply stops routing to the pod (no restart); when it passes again, traffic
// resumes. Use it for warm-up, a full connection pool, or a temporary dependency outage. LIVENESS:
// "is this instance wedged and beyond saving?" — if it fails `failureThreshold` times in a row, the
// kubelet KILLS and restarts the container. Use it only for true deadlocks. The classic outage: putting
// a slow-under-load check on the LIVENESS probe, so when traffic spikes the app gets slow, liveness
// times out, and Kubernetes restarts every pod at once — turning a blip into a crashloop. The fix is to
// make that a readiness check (shed traffic) instead. Reference: Kubernetes docs, "Configure Liveness,
// Readiness and Startup Probes"; Google SRE.

export type Probe = 'pass' | 'fail';
export interface Tick { liveness: Probe; readiness: Probe }
export interface State { phase: 'starting' | 'live'; ready: boolean; serving: boolean; livenessFails: number; restarts: number }
export interface StepResult { state: State; restarted: boolean; note: string }

export const initState = (): State => ({ phase: 'starting', ready: false, serving: false, livenessFails: 0, restarts: 0 });

/** Apply one probe cycle. Liveness failures accumulate toward a restart; readiness only gates traffic. */
export function step(s: State, t: Tick, failureThreshold = 3): StepResult {
  // liveness first — a restart supersedes everything
  if (t.liveness === 'fail') {
    const fails = s.livenessFails + 1;
    if (fails >= failureThreshold) {
      return { state: { phase: 'starting', ready: false, serving: false, livenessFails: 0, restarts: s.restarts + 1 }, restarted: true,
        note: `liveness failed ${fails}× → container KILLED and restarted (restart #${s.restarts + 1})` };
    }
    // failing but not yet at the threshold: still running, traffic still gated by readiness
    const ready = t.readiness === 'pass';
    return { state: { ...s, phase: 'live', ready, serving: ready, livenessFails: fails }, restarted: false,
      note: `liveness failing (${fails}/${failureThreshold}) — not restarted yet` };
  }

  // liveness healthy → readiness decides traffic
  const ready = t.readiness === 'pass';
  return { state: { phase: 'live', ready, serving: ready, livenessFails: 0, restarts: s.restarts }, restarted: false,
    note: ready ? 'healthy & ready — receiving traffic' : 'alive but NOT ready → removed from the load balancer (no restart)' };
}

/** Run a probe sequence from a fresh start; returns the state after each tick. */
export function run(ticks: Tick[], failureThreshold = 3): StepResult[] {
  let s = initState();
  return ticks.map((t) => { const r = step(s, t, failureThreshold); s = r.state; return r; });
}
