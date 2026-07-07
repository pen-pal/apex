// seccomp-BPF — how a process shrinks its own attack surface by allowlisting syscalls. After installing a filter, a
// process may only make the syscalls it declared; anything else hits the filter's DEFAULT ACTION — usually KILL the
// process (SCMP_ACT_KILL) or return EPERM (SCMP_ACT_ERRNO). It's how Docker, Chrome, and systemd (SystemCallFilter)
// keep a compromised process from doing damage: even with code execution, a blocked execve/ptrace/socket goes
// nowhere. Modelled: the per-syscall decision and what running a whole trace under a filter does.

export type Action = 'allow' | 'errno' | 'kill';
export type Filter = { allow: string[]; def: Action }; // allowlist + default action for everything else
export type Syscall = { name: string; danger?: boolean }; // danger = an escape primitive (execve, ptrace, …)
export type Step = { name: string; action: Action; danger: boolean };
export type Outcome = {
  steps: Step[];
  killedAt: number | null;   // index where the process was killed, or null
  completed: boolean;        // reached the end of the trace without being killed
  escaped: boolean;          // a dangerous syscall was ALLOWED — the sandbox failed
};

// One syscall's fate: allowed if on the list, otherwise the filter's default action.
export function decide(filter: Filter, name: string): Action {
  return filter.allow.includes(name) ? 'allow' : filter.def;
}

// Run a whole trace under the filter. An 'errno' on a needed syscall lets the process keep running (it just gets an
// error back); a 'kill' terminates it there. A dangerous syscall that is ALLOWED means the sandbox was too loose and
// the exploit escaped.
export function run(filter: Filter, trace: Syscall[]): Outcome {
  const steps: Step[] = [];
  let killedAt: number | null = null;
  let escaped = false;
  for (let i = 0; i < trace.length; i++) {
    const sc = trace[i];
    const action = decide(filter, sc.name);
    steps.push({ name: sc.name, action, danger: !!sc.danger });
    if (action === 'allow' && sc.danger) escaped = true;
    if (action === 'kill') { killedAt = i; break; }
  }
  return { steps, killedAt, completed: killedAt === null, escaped };
}

// The win condition for the sandbox puzzle: the program finishes its legitimate work (never killed before its last
// non-dangerous syscall) AND no dangerous syscall was allowed. `lastLegitIndex` is the last index that must run.
export function verdict(outcome: Outcome, lastLegitIndex: number): 'secure' | 'escaped' | 'broke-program' {
  if (outcome.escaped) return 'escaped';
  if (outcome.killedAt !== null && outcome.killedAt <= lastLegitIndex) return 'broke-program';
  return 'secure';
}
