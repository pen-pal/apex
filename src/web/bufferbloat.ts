// Bufferbloat — why a too-large buffer wrecks latency. A bottleneck link drains a
// fixed number of packets per tick; when arrivals exceed that, the excess queues.
// With a BIG dumb buffer the queue grows huge before it ever drops, so every packet
// waits behind a long line — queuing delay balloons (your video call stutters while
// someone uploads). Active Queue Management (AQM, e.g. CoDel) drops/marks early when
// the *standing* queue delay exceeds a small target, keeping latency low at a slight
// throughput cost. Pure, deterministic model. Tested.

export type Mode = 'big-buffer' | 'aqm';

export interface QueueTick {
  t: number;
  arrived: number; // packets offered this tick
  queueBefore: number;
  dropped: number; // packets dropped this tick (overflow or AQM)
  drained: number; // packets that left (≤ capacity)
  queueAfter: number;
  delay: number; // queuing delay in ticks = queueAfter / drain
}

export interface QueueConfig {
  ticks: number;
  drain: number; // link capacity: packets served per tick
  bufferSize: number; // max packets the buffer can hold
  arrivals: number[] | number; // per-tick arrivals (array) or a constant
  mode: Mode;
  aqmTargetDelay?: number; // AQM target standing delay in ticks (default 1)
}

/**
 * Simulate the bottleneck queue. AQM (CoDel-style) tolerates a single-tick burst
 * above the target, but once the queue has STOOD above the target it drops the
 * excess to hold the standing queue near `target` — so latency stays low while the
 * big-buffer case lets the queue (and delay) grow until the buffer is full.
 */
export function simulateQueue(cfg: QueueConfig): QueueTick[] {
  const target = cfg.aqmTargetDelay ?? 1;
  const targetQueue = Math.max(1, Math.round(target * cfg.drain)); // standing queue AQM tolerates
  const arrivalsAt = (t: number) => (Array.isArray(cfg.arrivals) ? cfg.arrivals[t] ?? 0 : cfg.arrivals);
  const out: QueueTick[] = [];
  let queue = 0;
  let stoodAbove = false; // was the queue above target on the previous tick? (CoDel interval)

  for (let t = 0; t < cfg.ticks; t++) {
    const arrived = arrivalsAt(t);
    const queueBefore = queue;
    let dropped = 0;

    queue += arrived; // admit arrivals (a transient burst is allowed to queue)

    if (cfg.mode === 'aqm') {
      // only drop once the queue has PERSISTED above target (not on the first burst)
      if (queue > targetQueue && stoodAbove) { dropped += queue - targetQueue; queue = targetQueue; }
      stoodAbove = queue > targetQueue;
    }

    // physical buffer limit (tail drop) applies in both modes
    if (queue > cfg.bufferSize) { dropped += queue - cfg.bufferSize; queue = cfg.bufferSize; }

    const drained = Math.min(cfg.drain, queue);
    queue -= drained;

    out.push({ t, arrived, queueBefore, dropped, drained, queueAfter: queue, delay: queue / cfg.drain });
  }
  return out;
}

/** Total packets dropped across a trace (AQM trades drops for low latency). */
export function totalDropped(trace: QueueTick[]): number {
  return trace.reduce((s, x) => s + x.dropped, 0);
}

/** Peak and average queuing delay across a trace (in ticks). */
export function delayStats(trace: QueueTick[]): { peak: number; avg: number } {
  const peak = trace.reduce((m, x) => Math.max(m, x.delay), 0);
  const avg = trace.reduce((s, x) => s + x.delay, 0) / Math.max(1, trace.length);
  return { peak, avg };
}
