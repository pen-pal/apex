// Bandwidth-Delay Product — why a fast link can still be slow. To keep a pipe full, a
// sender must have at least one round-trip's worth of data "in flight": that's the BDP =
// bandwidth × RTT. TCP can only have one window of unacknowledged data outstanding, so if
// the window is smaller than the BDP, throughput is capped at window / RTT — far below the
// link's capacity. This is why the original 64 KB window throttles transfers on
// high-bandwidth, high-latency ("long fat") links, and why Window Scaling (RFC 7323)
// exists. Pure arithmetic, tested against the textbook 1 Gbps / 100 ms case.

export interface Bdp {
  bdpBytes: number;            // bandwidth × RTT, the bytes needed to fill the pipe
  windowBytes: number;
  linkBytesPerSec: number;
  windowLimitedMbps: number;   // throughput the window allows = window / RTT
  effectiveMbps: number;       // min(link bandwidth, window-limited)
  utilization: number;         // effective / bandwidth, in [0,1]
  windowNeededKB: number;      // window size that would fill the pipe
  windowLimited: boolean;      // is the window the bottleneck?
}

/** @param bandwidthMbps link rate, @param rttMs round-trip time, @param windowKB TCP window. */
export function compute(bandwidthMbps: number, rttMs: number, windowKB: number): Bdp {
  const rttSec = rttMs / 1000;
  const linkBytesPerSec = (bandwidthMbps * 1e6) / 8;
  const bdpBytes = linkBytesPerSec * rttSec;
  const windowBytes = windowKB * 1024;
  const windowLimitedMbps = (windowBytes / rttSec) * 8 / 1e6;
  const effectiveMbps = Math.min(bandwidthMbps, windowLimitedMbps);
  return {
    bdpBytes,
    windowBytes,
    linkBytesPerSec,
    windowLimitedMbps,
    effectiveMbps,
    utilization: effectiveMbps / bandwidthMbps,
    windowNeededKB: bdpBytes / 1024,
    windowLimited: windowBytes < bdpBytes,
  };
}

/** The classic windows: 64 KB is the un-scaled TCP maximum; scaling reaches into GBs. */
export const UNSCALED_MAX_KB = 64;
