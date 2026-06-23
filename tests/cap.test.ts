import { describe, it, expect } from 'vitest';
import { CapSystem } from '../src/web/cap';

describe('no partition — both replicas agree', () => {
  it('a write propagates so both sides read the same value', () => {
    const sys = new CapSystem('CP');
    sys.write('A', 'x=1');
    expect(sys.read('B')).toMatchObject({ ok: true, value: 'x=1' });
    expect(sys.diverged).toBe(false);
  });
  it('works the same in AP mode when healthy', () => {
    const sys = new CapSystem('AP');
    sys.write('B', 'y=2');
    expect(sys.read('A')).toMatchObject({ ok: true, value: 'y=2' });
  });
});

describe('CP under partition — minority is unavailable', () => {
  const sys = new CapSystem('CP', 'v0');
  sys.primary = 'A';
  sys.setPartitioned(true);

  it('the primary stays writable and readable', () => {
    expect(sys.write('A', 'v1').ok).toBe(true);
    expect(sys.read('A')).toMatchObject({ ok: true, value: 'v1' });
  });
  it('the minority side refuses reads AND writes (consistency over availability)', () => {
    expect(sys.available('B')).toBe(false);
    expect(sys.read('B').ok).toBe(false);
    expect(sys.write('B', 'rogue').ok).toBe(false);
  });
  it('never serves stale data: B is never readable with an old value', () => {
    // even though B still physically holds v0, CP won't serve it
    expect(sys.B.value).toBe('v0');
    expect(sys.read('B').ok).toBe(false);
  });
});

describe('AP under partition — both available, replicas diverge', () => {
  it('accepts writes on both sides and they disagree', () => {
    const sys = new CapSystem('AP', 'v0');
    sys.setPartitioned(true);
    expect(sys.write('A', 'fromA').ok).toBe(true);
    expect(sys.write('B', 'fromB').ok).toBe(true);
    expect(sys.read('A')).toMatchObject({ ok: true, value: 'fromA' });
    expect(sys.read('B')).toMatchObject({ ok: true, value: 'fromB' });
    expect(sys.diverged).toBe(true); // the cost of availability
  });

  it('reconciles on heal (last-writer-wins by version) and converges', () => {
    const sys = new CapSystem('AP', 'v0');
    sys.setPartitioned(true);
    sys.write('A', 'fromA'); // A.version = 1
    sys.write('B', 'fromB'); // B.version = 1
    sys.write('B', 'fromB2'); // B.version = 2 → B is the later writer
    expect(sys.diverged).toBe(true);

    sys.setPartitioned(false); // heal → reconcile
    expect(sys.diverged).toBe(false); // converged
    expect(sys.read('A')).toMatchObject({ value: 'fromB2' }); // higher version won
    expect(sys.read('B')).toMatchObject({ value: 'fromB2' });
  });
});
