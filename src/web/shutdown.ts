// Graceful shutdown / connection draining — how to take an instance down WITHOUT dropping the requests
// it's already serving. When the orchestrator sends SIGTERM, a naive process exits immediately and every
// in-flight request becomes a 5xx. The graceful sequence instead: (1) fail the readiness probe so the
// load balancer stops sending NEW requests (this takes a moment to propagate — until then new requests
// still arrive and must be accepted), (2) keep serving in-flight requests until they finish, (3) exit
// once drained. A termination grace period bounds the wait: anything still running when it expires is
// force-killed (SIGKILL) and those connections DO drop. So the budget you want is grace period ≥ your
// longest normal request. This is the same dance rolling deploys and autoscale-down rely on every day.
// Reference: Kubernetes pod termination lifecycle (preStop, terminationGracePeriodSeconds); SRE practice.

export interface Req { id: string; arrival: number; duration: number } // arrival relative to SIGTERM (negative = already in flight)
export type Outcome = 'completed' | 'dropped' | 'rejected';
export interface ReqResult extends Req { finish: number; outcome: Outcome }
export interface ShutdownResult { results: ReqResult[]; completed: number; dropped: number; rejected: number; cleanExit: boolean; drainNeeded: number }

/** SIGTERM lands at t=0. For `readinessDelay` ticks the LB still routes new requests here (probe hasn't
 *  propagated); after that, new arrivals are rejected (sent elsewhere — fine). At `gracePeriod` the
 *  process is force-killed, dropping anything still running. */
export function shutdown(reqs: Req[], readinessDelay: number, gracePeriod: number): ShutdownResult {
  const results: ReqResult[] = reqs.map((r) => {
    const finish = r.arrival + r.duration;
    let outcome: Outcome;
    if (r.arrival > readinessDelay) outcome = 'rejected';        // arrived after the LB stopped routing here
    else if (finish > gracePeriod) outcome = 'dropped';          // still running when force-killed
    else outcome = 'completed';                                   // finished within the grace period
    return { ...r, finish, outcome };
  });
  const count = (o: Outcome) => results.filter((r) => r.outcome === o).length;
  // how long draining the accepted requests actually needs (longest finish among non-rejected)
  const drainNeeded = Math.max(0, ...results.filter((r) => r.outcome !== 'rejected').map((r) => r.finish));
  return {
    results, completed: count('completed'), dropped: count('dropped'), rejected: count('rejected'),
    cleanExit: count('dropped') === 0, drainNeeded,
  };
}
