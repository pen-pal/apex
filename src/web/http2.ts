// HTTP/2 multiplexing vs HTTP/1.1 head-of-line blocking. The single biggest win
// of HTTP/2 (RFC 7540) is that many requests share ONE TCP connection: each
// request is a STREAM, every stream's data is chopped into FRAMES, and frames
// from different streams INTERLEAVE on the wire. HTTP/1.1 on one connection must
// finish one response before the next can start — so a slow response blocks the
// quick ones behind it. We model both schedulers on an abstract time grid and
// compute per-stream completion times. Pure, tested.

export interface Stream {
  id: number; // HTTP/2 stream id (odd = client-initiated)
  label: string;
  frames: number; // how many frame-sized chunks this response takes
}

export interface Tick {
  t: number; // time slot index (one frame transmitted per slot)
  streamId: number; // which stream's frame occupies the shared connection this slot
}

export interface Schedule {
  ticks: Tick[]; // the shared-connection timeline, one frame per slot
  finish: Record<number, number>; // streamId → slot at which its LAST frame is sent (1-based)
  totalSlots: number;
  lastFinish: number; // when the final stream completes
}

/**
 * HTTP/1.1 over one connection: strictly serial. Stream A sends ALL its frames,
 * then stream B, etc. A long response head-of-line-blocks everything behind it.
 */
export function scheduleHttp11(streams: Stream[]): Schedule {
  const ticks: Tick[] = [];
  const finish: Record<number, number> = {};
  let t = 0;
  for (const s of streams) {
    for (let f = 0; f < s.frames; f++) ticks.push({ t: t++, streamId: s.id });
    finish[s.id] = t; // 1-based slot count when this stream's last frame went out
  }
  return { ticks, finish, totalSlots: t, lastFinish: t };
}

/**
 * HTTP/2: round-robin interleave one frame per active stream per slot, so every
 * stream makes progress concurrently. Short responses finish early instead of
 * waiting behind long ones. (Real HTTP/2 honours priority/weights; round-robin is
 * the fair-share baseline that shows the multiplexing win.)
 */
export function scheduleHttp2(streams: Stream[]): Schedule {
  const remaining = streams.map((s) => ({ id: s.id, left: s.frames }));
  const ticks: Tick[] = [];
  const finish: Record<number, number> = {};
  let t = 0;
  while (remaining.some((r) => r.left > 0)) {
    for (const r of remaining) {
      if (r.left <= 0) continue;
      ticks.push({ t: t++, streamId: r.id });
      r.left--;
      if (r.left === 0) finish[r.id] = t;
    }
  }
  return { ticks, finish, totalSlots: t, lastFinish: t };
}

/** Average completion time across streams (lower = snappier perceived load). */
export function avgFinish(sched: Schedule, streams: Stream[]): number {
  const sum = streams.reduce((a, s) => a + sched.finish[s.id], 0);
  return sum / streams.length;
}
