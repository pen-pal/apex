import { describe, it, expect } from 'vitest';
import { decide, run, verdict, type Filter, type Syscall } from '../src/web/seccomp';

// Independent oracle: seccomp-BPF semantics. A syscall on the allowlist is allowed; anything else takes the filter's
// default action. SCMP_ACT_KILL terminates the process at that syscall (nothing after runs); SCMP_ACT_ERRNO lets it
// keep running with an error. Expected outcomes are worked out from those rules on hand-built traces, not the code.

const TRACE: Syscall[] = [
  { name: 'openat' }, { name: 'read' }, { name: 'write' }, { name: 'close' }, { name: 'execve', danger: true },
];
const LAST_LEGIT = 3; // 'close' — the program must reach here to have done its job

describe('decide — allowlist vs default action', () => {
  it('allows a listed syscall and applies the default to the rest', () => {
    const f: Filter = { allow: ['read', 'write'], def: 'kill' };
    expect(decide(f, 'read')).toBe('allow');
    expect(decide(f, 'execve')).toBe('kill');
    expect(decide({ allow: ['read'], def: 'errno' }, 'socket')).toBe('errno');
  });
});

describe('run — a trace under a filter', () => {
  it('a correct allowlist + default-kill lets the program work, then kills the exploit', () => {
    const f: Filter = { allow: ['openat', 'read', 'write', 'close'], def: 'kill' };
    const o = run(f, TRACE);
    expect(o.escaped).toBe(false);
    expect(o.killedAt).toBe(4);            // killed exactly at execve
    expect(o.steps).toHaveLength(5);       // execve was reached and blocked
    expect(verdict(o, LAST_LEGIT)).toBe('secure');
  });

  it('SCMP_ACT_KILL stops execution — nothing after the killed syscall runs', () => {
    const f: Filter = { allow: ['openat', 'read'], def: 'kill' }; // 'write' missing
    const o = run(f, TRACE);
    expect(o.killedAt).toBe(2);            // killed at write
    expect(o.steps).toHaveLength(3);       // close and execve never happened
    expect(verdict(o, LAST_LEGIT)).toBe('broke-program');
  });

  it('a too-loose filter that allows execve lets the exploit escape', () => {
    const f: Filter = { allow: ['openat', 'read', 'write', 'close', 'execve'], def: 'kill' };
    const o = run(f, TRACE);
    expect(o.escaped).toBe(true);
    expect(verdict(o, LAST_LEGIT)).toBe('escaped');
  });

  it('default ERRNO does not kill: the program runs to the end and the exploit is still blocked', () => {
    const f: Filter = { allow: ['openat', 'read', 'write', 'close'], def: 'errno' };
    const o = run(f, TRACE);
    expect(o.killedAt).toBe(null);
    expect(o.completed).toBe(true);
    expect(o.steps[4]).toEqual({ name: 'execve', action: 'errno', danger: true });
    expect(o.escaped).toBe(false);
    expect(verdict(o, LAST_LEGIT)).toBe('secure');
  });

  it('a dangerous syscall counts as escaped only when ALLOWED, not when blocked', () => {
    const blocked = run({ allow: ['openat'], def: 'errno' }, [{ name: 'execve', danger: true }]);
    expect(blocked.escaped).toBe(false);
    const allowed = run({ allow: ['execve'], def: 'kill' }, [{ name: 'execve', danger: true }]);
    expect(allowed.escaped).toBe(true);
  });
});
