// NTP (RFC 5905) clock synchronization — how a client sets its clock from a server
// across a network whose delay it doesn't know. Four timestamps: T1 (client sends),
// T2 (server receives), T3 (server replies), T4 (client receives). Two subtractions
// recover both the round-trip delay and the clock offset, and — elegantly — the
// server's own processing time cancels out, and the offset is exact when the path is
// symmetric. The only error is path asymmetry. Pure formulas (tested).

export interface Stamps { t1: number; t2: number; t3: number; t4: number }
export interface NtpResult { delay: number; offset: number }

/** δ = (T4−T1) − (T3−T2) ;  θ = ((T2−T1) + (T3−T4)) / 2. */
export function compute(s: Stamps): NtpResult {
  return {
    delay: (s.t4 - s.t1) - (s.t3 - s.t2),
    offset: ((s.t2 - s.t1) + (s.t3 - s.t4)) / 2,
  };
}

/**
 * Simulate the exchange. The server's clock leads the client's by `trueOffset`; the
 * request takes `dUp`, the reply `dDown`, and the server spends `serverProc` between
 * receiving and replying. Timestamps are written in each side's OWN clock.
 */
export function simulate(trueOffset: number, dUp: number, dDown: number, serverProc: number, t1 = 1000): Stamps {
  const t2 = t1 + dUp + trueOffset; // server clock when the request arrives
  const t3 = t2 + serverProc; // server clock when it replies
  const t4 = t1 + dUp + serverProc + dDown; // client clock when the reply arrives
  return { t1, t2, t3, t4 };
}

/** The unavoidable error from an asymmetric path: (dUp − dDown) / 2. */
export const asymmetryError = (dUp: number, dDown: number): number => (dUp - dDown) / 2;
