// Linux CFS (the Completely Fair Scheduler) — how Linux shared the CPU for ~15 years (until EEVDF in
// 6.6). The idea: track each task's "virtual runtime" (vruntime) and always run the one that has had the
// LEAST, so over time everyone converges to a fair share. Fairness is weighted by nice value: vruntime
// advances as real_time × (NICE_0_WEIGHT / weight), so a low-weight (niced-down) task's clock runs FAST
// and it earns proportionally less CPU. CFS keeps tasks in a red-black tree keyed by vruntime and runs
// the leftmost (smallest) one. Result: long-run CPU share ∝ weight. The weight table is the kernel's
// sched_prio_to_weight[] (nice 0 = 1024, ~1.25× per level). Reference: kernel/sched/fair.c; OSTEP ch.9.

export const NICE_0_WEIGHT = 1024;
// Exact kernel sched_prio_to_weight[] values for nice −5..+5 (each step ≈ 1.25×).
export const WEIGHT: Record<number, number> = {
  [-5]: 3121, [-4]: 2501, [-3]: 1991, [-2]: 1586, [-1]: 1277,
  [0]: 1024, [1]: 820, [2]: 655, [3]: 526, [4]: 423, [5]: 335,
};
export const weightOf = (nice: number) => WEIGHT[Math.max(-5, Math.min(5, nice))] ?? NICE_0_WEIGHT;

export interface Task { id: string; nice: number }
export interface CfsState { vruntime: Record<string, number>; cpu: Record<string, number> }
export interface Pick { id: string; ranFor: number; vrAfter: number; minVruntime: number }

export const initCfs = (tasks: Task[]): CfsState => ({
  vruntime: Object.fromEntries(tasks.map((t) => [t.id, 0])),
  cpu: Object.fromEntries(tasks.map((t) => [t.id, 0])),
});

/** The task CFS runs next: the leftmost in the RB-tree = smallest vruntime (ties → lexicographic id). */
export function leftmost(tasks: Task[], st: CfsState): string {
  return [...tasks].sort((a, b) => st.vruntime[a.id] - st.vruntime[b.id] || (a.id < b.id ? -1 : 1))[0].id;
}

/** Run the scheduler for one timeslice: pick the min-vruntime task, give it `slice` ms, advance its
 *  vruntime by slice × NICE_0_WEIGHT/weight (so heavy tasks' clocks tick slower → more real CPU). */
export function tick(tasks: Task[], st: CfsState, slice: number): { state: CfsState; pick: Pick } {
  const id = leftmost(tasks, st);
  const nice = tasks.find((t) => t.id === id)!.nice;
  const vr = st.vruntime[id] + slice * (NICE_0_WEIGHT / weightOf(nice));
  const next: CfsState = {
    vruntime: { ...st.vruntime, [id]: vr },
    cpu: { ...st.cpu, [id]: st.cpu[id] + slice },
  };
  const minV = Math.min(...tasks.map((t) => next.vruntime[t.id]));
  return { state: next, pick: { id, ranFor: slice, vrAfter: vr, minVruntime: minV } };
}

/** Run `n` timeslices and report each task's achieved CPU share vs the weight-proportional ideal. */
export function run(tasks: Task[], slice: number, n: number): { state: CfsState; picks: Pick[]; share: Record<string, number>; ideal: Record<string, number> } {
  let st = initCfs(tasks);
  const picks: Pick[] = [];
  for (let i = 0; i < n; i++) { const r = tick(tasks, st, slice); st = r.state; picks.push(r.pick); }
  const totalCpu = tasks.reduce((a, t) => a + st.cpu[t.id], 0) || 1;
  const totalW = tasks.reduce((a, t) => a + weightOf(t.nice), 0);
  const share = Object.fromEntries(tasks.map((t) => [t.id, st.cpu[t.id] / totalCpu]));
  const ideal = Object.fromEntries(tasks.map((t) => [t.id, weightOf(t.nice) / totalW]));
  return { state: st, picks, share, ideal };
}
