import { describe, it, expect } from 'vitest';
import { permits, assess, OPS, CAPS, ALL_CAPS, LEAST_PRIVILEGE, NEEDED } from '../src/web/capabilities';

// Independent oracle: the kernel's capability check — an operation is permitted iff it needs no capability or the
// process holds the one it requires. Least privilege permits exactly the app's op plus the cap-less ops and NO
// dangerous op; full root permits everything; no caps permits only the cap-less ops. Expected sets are enumerated by
// hand from those rules, not read from the model.

const op = (id: string) => OPS.find((o) => o.id === id)!;

describe('permits — needs the required capability, or none', () => {
  it('a cap-less operation is always allowed', () => {
    expect(permits(new Set(), op('readcfg'))).toBe(true);
  });
  it('a privileged operation needs its exact capability', () => {
    expect(permits(new Set(), op('shadow'))).toBe(false);
    expect(permits(new Set(['CAP_DAC_OVERRIDE']), op('shadow'))).toBe(true);
    expect(permits(new Set(['CAP_CHOWN']), op('shadow'))).toBe(false); // wrong cap doesn't help
  });
});

describe('least privilege permits exactly the job, nothing dangerous', () => {
  const held = LEAST_PRIVILEGE();
  it('binds :80 and reads its config', () => {
    expect(permits(held, op('bind80'))).toBe(true);
    expect(permits(held, op('readcfg'))).toBe(true);
  });
  it('every dangerous operation is denied', () => {
    for (const o of OPS.filter((x) => x.danger)) expect(permits(held, o)).toBe(false);
  });
  it('assess reports least privilege', () => {
    expect(assess(held).kind).toBe('least');
  });
});

describe('full root permits everything, including every attack', () => {
  const held = ALL_CAPS();
  it('all operations allowed', () => {
    for (const o of OPS) expect(permits(held, o)).toBe(true);
  });
  it('assess reports over-privileged', () => {
    expect(assess(held).kind).toBe('over');
  });
});

describe('dropping the needed capability breaks the app', () => {
  it('without CAP_NET_BIND_SERVICE it cannot bind :80', () => {
    const held = new Set(CAPS.map((c) => c.id).filter((id) => id !== NEEDED));
    expect(permits(held, op('bind80'))).toBe(false);
    expect(assess(held).kind).toBe('broken');
  });
});
