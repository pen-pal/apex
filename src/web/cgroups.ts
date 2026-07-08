// cgroups v2 — how the kernel caps what a process can USE (the other half of a container; namespaces cap what it can
// SEE). Three controllers with three distinct effects. cpu.max is a quota/period pair: a task may run for `quota`
// microseconds out of every `period`, so a CPU-hungry task runs full then is throttled (paused) for the rest of each
// period — its throughput is capped at quota/period. memory.max triggers the OOM killer when the working set can't fit.
// pids.max makes fork() return EAGAIN past the cap, so a fork bomb can't exhaust the host's process table. This models
// the three limit semantics; it isn't the scheduler, but the caps match how cgroups behave.

// ---- CPU (cpu.max = quota/period) ----
export interface CpuResult { effectivePct: number; throttled: boolean; throttledPct: number }
// quotaPct and demandPct are percentages of one core (100 = a full core).
export function cpuThrottle(quotaPct: number, demandPct: number): CpuResult {
  const effectivePct = Math.min(demandPct, quotaPct);
  const throttled = demandPct > quotaPct;
  // Of the CPU it wanted, the fraction it was denied (0 when it fits under quota).
  const throttledPct = throttled ? Math.round(((demandPct - quotaPct) / demandPct) * 100) : 0;
  return { effectivePct, throttled, throttledPct };
}

// ---- Memory (memory.max) ----
export interface MemResult { usedMb: number; oom: boolean }
export function memoryOutcome(needMb: number, limitMb: number): MemResult {
  const oom = needMb > limitMb;
  return { usedMb: oom ? limitMb : needMb, oom };
}

// ---- PIDs (pids.max) ----
export interface PidsResult { running: number; failedForks: number; contained: boolean }
export function pidsOutcome(demand: number, limitMax: number): PidsResult {
  const running = Math.min(demand, limitMax);
  const failedForks = Math.max(0, demand - limitMax);
  return { running, failedForks, contained: demand > limitMax };
}
