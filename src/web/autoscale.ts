// Horizontal autoscaling (Kubernetes HPA) — how a service grows and shrinks its replica count to track
// load, with one disarmingly simple formula:
//     desiredReplicas = ceil( currentReplicas × currentMetric / targetMetric )
// If each of 3 replicas is at 100% CPU and you target 50%, you need ceil(3 × 100/50) = 6. The current
// replica count cancels out, so it really just chases "total load ÷ per-replica target", but expressing
// it as a ratio is what lets ANY metric (CPU, requests/sec, queue depth) drive it. Two practical guards
// keep it from thrashing: a TOLERANCE band (don't react to a <10% deviation) and a scale-down
// STABILIZATION window (only shrink after load has stayed low for a while), so a brief dip doesn't tear
// down capacity you'll need back in seconds. Reference: Kubernetes HPA algorithm docs.

export interface HpaOpts { target: number; min: number; max: number; tolerance?: number }

/** The core HPA step: replicas needed to bring the per-replica metric back to target (clamped, with a
 *  tolerance dead-band so tiny deviations don't cause churn). */
export function desiredReplicas(current: number, metric: number, opts: HpaOpts): number {
  const tol = opts.tolerance ?? 0.1;
  const ratio = metric / opts.target;
  if (Math.abs(ratio - 1) <= tol) return clamp(current, opts);   // within the dead-band → hold
  return clamp(Math.ceil(current * ratio), opts);
}
const clamp = (r: number, o: HpaOpts) => Math.max(o.min, Math.min(o.max, r));

export interface ScaleTick { t: number; load: number; replicas: number; perReplica: number; desired: number; action: 'scale up' | 'scale down' | 'hold' }

/** Simulate the autoscaler over a load time-series. `load` is total demand; per-replica metric is
 *  load / replicas, which the HPA drives toward `target`. Scale-down waits `downDelay` ticks of low
 *  demand (stabilization) before actually shrinking. */
export function simulate(loads: number[], start: number, opts: HpaOpts, downDelay = 1): ScaleTick[] {
  let replicas = clamp(start, opts);
  let lowStreak = 0;
  const out: ScaleTick[] = [];
  for (let t = 0; t < loads.length; t++) {
    const load = loads[t];
    const perReplica = load / replicas;
    const want = desiredReplicas(replicas, perReplica, opts);
    let next = replicas, action: ScaleTick['action'] = 'hold';
    if (want > replicas) { next = want; action = 'scale up'; lowStreak = 0; }   // scale up immediately
    else if (want < replicas) {
      lowStreak++;
      if (lowStreak >= downDelay) { next = want; action = 'scale down'; lowStreak = 0; } // wait out the stabilization window
    } else lowStreak = 0;
    out.push({ t, load, replicas, perReplica, desired: want, action });
    replicas = next;
  }
  return out;
}
