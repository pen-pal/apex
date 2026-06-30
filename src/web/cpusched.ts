// CPU scheduling — the same job set run under different policies, so the trade-offs become numbers.
// A single CPU, integer time. Each policy produces a Gantt timeline plus the three metrics every OS
// textbook compares: turnaround (completion − arrival), waiting (turnaround − burst), and response
// (first-run − arrival). The classic results fall straight out: FCFS suffers the convoy effect, SJF
// minimizes average waiting among non-preemptive policies, SRTF minimizes it overall, and round-robin
// trades turnaround for responsiveness. Anchored to hand-derived traces (see tests), not to OS output.
// Reference: Arpaci-Dusseau, OSTEP ch.7–8 ("Scheduling"); Silberschatz, Operating System Concepts ch.6.

export interface Job { id: string; arrival: number; burst: number }
export interface Slice { id: string; start: number; end: number }
export interface JobMetric { id: string; arrival: number; burst: number; completion: number; turnaround: number; waiting: number; response: number; firstRun: number }
export interface Schedule { gantt: Slice[]; metrics: JobMetric[]; avgTurnaround: number; avgWaiting: number; avgResponse: number }
export type Policy = 'fcfs' | 'sjf' | 'srtf' | 'rr';

// Merge adjacent CPU ticks that ran the same job into one Gantt bar.
function coalesce(ticks: (string | null)[]): Slice[] {
  const out: Slice[] = [];
  for (let t = 0; t < ticks.length; t++) {
    const id = ticks[t];
    if (id === null) continue;
    const last = out[out.length - 1];
    if (last && last.id === id && last.end === t) last.end = t + 1;
    else out.push({ id, start: t, end: t + 1 });
  }
  return out;
}

function finish(jobs: Job[], gantt: Slice[]): Schedule {
  const firstRun: Record<string, number> = {};
  const completion: Record<string, number> = {};
  for (const s of gantt) {
    if (firstRun[s.id] === undefined) firstRun[s.id] = s.start;
    completion[s.id] = s.end;
  }
  const metrics: JobMetric[] = jobs.map((j) => {
    const turnaround = completion[j.id] - j.arrival;
    return {
      id: j.id, arrival: j.arrival, burst: j.burst,
      completion: completion[j.id], turnaround, waiting: turnaround - j.burst,
      response: firstRun[j.id] - j.arrival, firstRun: firstRun[j.id],
    };
  });
  const n = metrics.length || 1;
  const sum = (f: (m: JobMetric) => number) => metrics.reduce((a, m) => a + f(m), 0);
  return {
    gantt, metrics,
    avgTurnaround: sum((m) => m.turnaround) / n,
    avgWaiting: sum((m) => m.waiting) / n,
    avgResponse: sum((m) => m.response) / n,
  };
}

// Non-preemptive: at each decision point pick the ready job with the smallest `key`; if the CPU is
// idle, fast-forward to the next arrival. `key` is arrival-then-id (FCFS) or burst-then-arrival (SJF).
function nonPreemptive(jobs: Job[], key: (j: Job) => [number, number, string]): Schedule {
  const rem = new Map(jobs.map((j) => [j.id, j.burst] as const));
  const done = new Set<string>();
  const ticks: (string | null)[] = [];
  let t = 0;
  while (done.size < jobs.length) {
    const ready = jobs.filter((j) => !done.has(j.id) && j.arrival <= t);
    if (ready.length === 0) { ticks[t] = null; t++; continue; }
    ready.sort((a, b) => { const ka = key(a), kb = key(b); return ka[0] - kb[0] || ka[1] - kb[1] || (ka[2] < kb[2] ? -1 : 1); });
    const job = ready[0];
    for (let k = 0; k < rem.get(job.id)!; k++) ticks[t + k] = job.id;
    t += rem.get(job.id)!;
    done.add(job.id);
  }
  return finish(jobs, coalesce(ticks));
}

// Preemptive shortest-remaining-time-first: every tick, run the arrived, unfinished job with the
// least time left (ties to earlier arrival, then id). Idle ticks advance the clock.
function srtf(jobs: Job[]): Schedule {
  const rem = new Map(jobs.map((j) => [j.id, j.burst] as const));
  const ticks: (string | null)[] = [];
  const total = jobs.reduce((a, j) => a + j.burst, 0);
  let t = 0, completed = 0;
  while (completed < total) {
    const ready = jobs.filter((j) => j.arrival <= t && rem.get(j.id)! > 0);
    if (ready.length === 0) { ticks[t] = null; t++; continue; }
    ready.sort((a, b) => rem.get(a.id)! - rem.get(b.id)! || a.arrival - b.arrival || (a.id < b.id ? -1 : 1));
    const job = ready[0];
    ticks[t] = job.id;
    rem.set(job.id, rem.get(job.id)! - 1);
    completed++; t++;
  }
  return finish(jobs, coalesce(ticks));
}

// Round-robin: FIFO ready queue, each job runs at most `quantum` ticks then goes to the back. When a
// slice ends at time t, jobs that have arrived by t are enqueued (in arrival order) BEFORE the
// preempted job is re-added — the standard textbook tie-break at a quantum/arrival boundary.
function roundRobin(jobs: Job[], quantum: number): Schedule {
  const rem = new Map(jobs.map((j) => [j.id, j.burst] as const));
  const byArrival = [...jobs].sort((a, b) => a.arrival - b.arrival || (a.id < b.id ? -1 : 1));
  const ticks: (string | null)[] = [];
  const queue: string[] = [];
  const enqueued = new Set<string>();
  const total = jobs.reduce((a, j) => a + j.burst, 0);
  let t = 0, completed = 0;
  const admit = (upto: number) => { for (const j of byArrival) if (!enqueued.has(j.id) && j.arrival <= upto) { queue.push(j.id); enqueued.add(j.id); } };
  admit(0);
  while (completed < total) {
    if (queue.length === 0) { ticks[t] = null; t++; admit(t); continue; }
    const id = queue.shift()!;
    const run = Math.min(quantum, rem.get(id)!);
    for (let k = 0; k < run; k++) { ticks[t + k] = id; }
    t += run;
    rem.set(id, rem.get(id)! - run);
    completed += run;
    admit(t);                       // newcomers (incl. those arriving exactly at t) go in first…
    if (rem.get(id)! > 0) queue.push(id); // …then the preempted job rejoins the back
  }
  return finish(jobs, coalesce(ticks));
}

export function schedule(jobs: Job[], policy: Policy, quantum = 2): Schedule {
  switch (policy) {
    case 'fcfs': return nonPreemptive(jobs, (j) => [j.arrival, 0, j.id]);
    case 'sjf': return nonPreemptive(jobs, (j) => [j.burst, j.arrival, j.id]);
    case 'srtf': return srtf(jobs);
    case 'rr': return roundRobin(jobs, quantum);
  }
}

export const POLICY_LABEL: Record<Policy, string> = {
  fcfs: 'FCFS', sjf: 'SJF (non-preemptive)', srtf: 'SRTF (preemptive)', rr: 'Round-robin',
};
