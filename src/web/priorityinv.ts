// Priority inversion — the bug that nearly killed the 1997 Mars Pathfinder mission. A HIGH-priority task needs
// a lock that a LOW-priority task is holding. Normally the high task just waits briefly for the low one to
// finish its critical section. But if a MEDIUM-priority task (that doesn't need the lock) wakes up, it
// preempts the low task — because medium > low — and now the low task can't run to release the lock, so the
// high task is stuck waiting on the medium task. Priorities are effectively INVERTED: medium work delays high
// work, without bound. On Pathfinder this triggered a watchdog reset loop until JPL enabled the fix remotely.
// The fix is PRIORITY INHERITANCE: while the high task is blocked on a lock, the lock's holder temporarily
// inherits the high priority, so medium tasks can't preempt it — the critical section finishes fast and the
// high task proceeds. This file simulates a fixed H/M/L scenario with and without inheritance.
// Reference: Sha, Rajkumar & Lehoczky (1990); the Mars Pathfinder post-mortem (Glenn Reeves, JPL).

export interface Task { id: 'H' | 'M' | 'L'; prio: number; arrival: number; work: number; lockAt: number; unlockAt: number }

// H needs the lock the instant it starts; L grabs it early and holds it a while; M needs no lock.
export const SCENARIO: Task[] = [
  { id: 'L', prio: 1, arrival: 0, work: 6, lockAt: 1, unlockAt: 5 },
  { id: 'H', prio: 3, arrival: 2, work: 4, lockAt: 0, unlockAt: 2 },
  { id: 'M', prio: 2, arrival: 3, work: 5, lockAt: -1, unlockAt: -1 },
];

export interface SimResult {
  timeline: string[];                 // who ran at each time step ('H'/'M'/'L'/'idle')
  completion: Record<string, number>; // finish time per task
  hWait: number;                      // extra time H waited beyond its own work (the inversion cost)
}

/** Run the fixed-priority preemptive scheduler over the scenario, with or without priority inheritance. */
export function simulate(tasks: Task[], inheritance: boolean, maxT = 60): SimResult {
  const st = tasks.map((t) => ({ ...t, executed: 0, holds: false, done: false, blocked: false }));
  const byId = (id: string) => st.find((s) => s.id === id)!;
  let lockHolder: string | null = null;
  const timeline: string[] = [];
  const completion: Record<string, number> = {};

  // A lock holder inherits the highest priority among tasks currently blocked waiting for the lock.
  const effPrio = (s: (typeof st)[number]) => {
    if (inheritance && s.holds) {
      const waiters = st.filter((w) => w.blocked && !w.done);
      return waiters.length ? Math.max(s.prio, ...waiters.map((w) => w.prio)) : s.prio;
    }
    return s.prio;
  };

  for (let t = 0; t < maxT; t++) {
    if (st.every((s) => s.done)) break;
    // Selection: pick the highest-effective-priority runnable task, blocking on the lock as needed.
    let ran: (typeof st)[number] | null = null;
    while (true) {
      const runnable = st.filter((s) => s.arrival <= t && !s.done && !s.blocked);
      if (!runnable.length) break;
      runnable.sort((a, b) => effPrio(b) - effPrio(a) || a.arrival - b.arrival);
      const cur = runnable[0];
      if (cur.lockAt >= 0 && cur.executed === cur.lockAt && !cur.holds) {
        if (lockHolder === null || lockHolder === cur.id) { lockHolder = cur.id; cur.holds = true; }
        else { cur.blocked = true; continue; } // can't get the lock → block, re-pick
      }
      ran = cur; break;
    }
    if (!ran) { timeline.push('idle'); continue; }

    ran.executed++;
    timeline.push(ran.id);
    if (ran.holds && ran.executed === ran.unlockAt) { ran.holds = false; lockHolder = null; st.forEach((w) => { w.blocked = false; }); }
    if (ran.executed === ran.work) {
      ran.done = true; completion[ran.id] = t + 1;
      if (ran.holds) { ran.holds = false; lockHolder = null; st.forEach((w) => { w.blocked = false; }); }
    }
  }

  const H = byId('H');
  const hWait = (completion['H'] ?? maxT) - H.arrival - H.work;
  return { timeline, completion, hWait };
}
