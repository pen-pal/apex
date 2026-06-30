// epoll & the C10k problem — how one thread can watch 10,000+ sockets at once. The old select()/poll()
// APIs make the kernel (and the app) walk the ENTIRE set of file descriptors on every wait, so cost grows
// O(n) with the number of connections even when only a handful are active — the wall that capped servers
// around 10k clients ("C10k"). epoll flips it: you register interest once, the kernel keeps a READY LIST,
// and epoll_wait returns only the fds that actually have events — O(active), independent of how many idle
// connections you hold. That's the engine under nginx, Node.js (libuv), Redis, and HAProxy. The other half
// of epoll is its sharpest edge: EDGE-triggered mode wakes you only on the transition to ready, so if you
// don't drain the socket fully you can deadlock waiting for an event that never repeats. References: Dan
// Kegel, "The C10K problem"; Linux epoll(7).

export interface CompareResult {
  selectScans: number;   // total fd-slots the kernel/app must examine with select/poll
  epollScans: number;    // total work with epoll (only ready fds)
  ratio: number;         // how many times more work select does
  perCall: { select: number; epoll: number; ready: number }[];
}

/** Compare select/poll vs epoll over a workload: `total` open connections, and for each epoll_wait call,
 *  how many of them are actually ready. select scans all `total` every call; epoll touches only the ready. */
export function compare(total: number, readyPerCall: number[]): CompareResult {
  const perCall = readyPerCall.map((ready) => ({ select: total, epoll: Math.max(1, ready), ready }));
  const selectScans = perCall.reduce((s, c) => s + c.select, 0);
  const epollScans = perCall.reduce((s, c) => s + c.epoll, 0);
  return { selectScans, epollScans, ratio: epollScans === 0 ? 0 : selectScans / epollScans, perCall };
}

export interface DrainResult { mode: 'level' | 'edge'; wakeups: number; bytesRead: number; stalled: number }

/** Level- vs edge-triggered draining. A socket holds `available` bytes; on each wakeup the app reads up to
 *  `readPerWakeup`. LEVEL-triggered keeps firing while data remains (you always drain it). EDGE-triggered
 *  fires once per arrival — if you don't loop until EAGAIN, the leftover bytes sit there with no further
 *  wakeup (a classic stall). Returns wakeups, bytes read, and bytes left stranded. */
export function drain(available: number, readPerWakeup: number, mode: 'level' | 'edge'): DrainResult {
  if (readPerWakeup <= 0) return { mode, wakeups: available > 0 ? 1 : 0, bytesRead: 0, stalled: available };
  if (mode === 'level') {
    const wakeups = Math.ceil(available / readPerWakeup) || 0;
    return { mode, wakeups, bytesRead: available, stalled: 0 };
  }
  // edge-triggered: exactly one wakeup for this arrival; a correct app loops, a naive one reads once
  const bytesRead = Math.min(available, readPerWakeup);
  return { mode, wakeups: available > 0 ? 1 : 0, bytesRead, stalled: available - bytesRead };
}
