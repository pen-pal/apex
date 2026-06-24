import { describe, it, expect } from 'vitest';
import { selectBest, type Route } from '../src/web/bgpselect';

const base: Omit<Route, 'id'> = { nextHop: '10.0.0.1', localPref: 100, asPath: [65001, 65002], origin: 0, med: 0, ebgp: true, igpMetric: 10, routerId: 1 };
const mk = (id: string, over: Partial<Route>): Route => ({ ...base, id, ...over });

describe('BGP best-path cascade', () => {
  it('LOCAL_PREF wins even against a shorter AS path', () => {
    const r = selectBest([
      mk('A', { localPref: 200, asPath: [1, 2, 3, 4] }), // higher pref, longer path
      mk('B', { localPref: 100, asPath: [1] }), // lower pref, shortest path
    ]);
    expect(r.winner!.id).toBe('A'); // policy beats path length
    expect(r.steps[0].decided).toBe(true); // decided at Local Preference
  });

  it('falls through to AS path when LOCAL_PREF ties', () => {
    const r = selectBest([mk('A', { asPath: [1, 2, 3] }), mk('B', { asPath: [1, 2] })]);
    expect(r.winner!.id).toBe('B');
    expect(r.steps[1].decided).toBe(true); // AS Path Length step
  });

  it('eBGP beats iBGP when earlier fields tie', () => {
    const r = selectBest([mk('A', { ebgp: false }), mk('B', { ebgp: true })]);
    expect(r.winner!.id).toBe('B');
    expect(r.steps[4].decided).toBe(true);
  });

  it('router-id is the final, always-decisive tiebreaker', () => {
    const r = selectBest([mk('A', { routerId: 9 }), mk('B', { routerId: 2 }), mk('C', { routerId: 5 })]);
    expect(r.winner!.id).toBe('B'); // lowest router-id
    expect(r.steps[6].decided).toBe(true);
    expect(r.steps.slice(0, 6).every((s) => !s.decided)).toBe(true); // nothing earlier separated them
  });

  it('a single route wins with no contest', () => {
    expect(selectBest([mk('only', {})]).winner!.id).toBe('only');
  });
});
