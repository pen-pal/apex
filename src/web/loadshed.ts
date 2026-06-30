// Load shedding & backpressure — why, under overload, the right move is to REJECT work fast rather than
// queue it. A server processes at a fixed rate; when demand exceeds it, requests pile up. With an
// UNBOUNDED queue the wait grows without limit, so by the time a request reaches the front the client
// has already given up — the server burns 100% of its capacity serving responses nobody is waiting for
// (congestion collapse: offered load up, useful throughput → 0). The fix is a BOUNDED queue plus
// admission control: once the queue is full, shed the excess immediately (a fast 503 the client can
// retry elsewhere), which keeps the wait — and thus the latency of ACCEPTED requests — bounded, so they
// finish within their deadline. That fast rejection IS backpressure: it tells upstream to slow down.
// Reference: Google SRE "Handling Overload"; Little's law (wait = queue / rate).

export interface Tick { t: number; queueLen: number; goodput: number; wasted: number; shed: number; latency: number }
export interface ShedResult { ticks: Tick[]; goodput: number; wasted: number; shed: number; maxQueue: number; finalQueue: number }

/** Simulate FIFO service against an offered-load series. `deadline` is how long a client waits before
 *  giving up; a request served after that is "wasted" (served too late). mode 'shed' caps the queue at
 *  `capacity`; mode 'unbounded' queues everything. */
export function simulate(load: number[], capacity: number, rate: number, deadline: number, mode: 'shed' | 'unbounded'): ShedResult {
  let queue: number[] = []; // arrival ticks, FIFO
  let goodput = 0, wasted = 0, shed = 0, maxQueue = 0;
  const ticks: Tick[] = [];
  for (let t = 0; t < load.length; t++) {
    // serve up to `rate` from the front
    for (let s = 0; s < rate && queue.length; s++) {
      const arr = queue.shift()!;
      if (t - arr <= deadline) goodput++; else wasted++;
    }
    // admit this tick's arrivals
    const a = load[t];
    if (mode === 'shed') {
      const room = Math.max(0, capacity - queue.length);
      const admitted = Math.min(a, room);
      shed += a - admitted;
      for (let i = 0; i < admitted; i++) queue.push(t);
    } else {
      for (let i = 0; i < a; i++) queue.push(t);
    }
    maxQueue = Math.max(maxQueue, queue.length);
    ticks.push({ t, queueLen: queue.length, goodput, wasted, shed, latency: queue.length / rate });
  }
  return { ticks, goodput, wasted, shed, maxQueue, finalQueue: queue.length };
}
