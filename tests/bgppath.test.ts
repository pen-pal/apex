import { describe, it, expect } from 'vitest';
import { selectBestPath, LADDER, type Route } from '../src/web/bgp';

// A baseline route; helpers tweak one attribute at a time so each test isolates
// exactly one rung of the decision ladder.
const base = (id: string, over: Partial<Route> = {}): Route => ({
  id, nextHop: '0.0.0.0', weight: 0, localPref: 100, asPath: [65001, 65002],
  origin: 'IGP', med: 0, fromEbgp: true, igpMetric: 10, routerId: 100, ...over,
});

describe('BGP best-path ladder', () => {
  it('orders the rungs canonically', () => {
    expect(LADDER.map((r) => r.key)).toEqual([
      'weight', 'localPref', 'asPath', 'origin', 'med', 'ebgp', 'igpMetric', 'routerId',
    ]);
  });

  it('prefers higher weight first (before everything else)', () => {
    const d = selectBestPath([
      base('A', { weight: 100, asPath: [1, 2, 3, 4] }), // worse AS path but higher weight
      base('B', { weight: 0, asPath: [1] }),
    ]);
    expect(d.winner!.id).toBe('A');
    expect(d.decidedAt).toBe('weight');
  });

  it('falls through to higher local-pref when weight ties', () => {
    const d = selectBestPath([base('A', { localPref: 200 }), base('B', { localPref: 100 })]);
    expect(d.winner!.id).toBe('A');
    expect(d.decidedAt).toBe('localPref');
  });

  it('prefers the shorter AS_PATH when weight + local-pref tie', () => {
    const d = selectBestPath([base('A', { asPath: [65010, 65020, 65030] }), base('B', { asPath: [65040] })]);
    expect(d.winner!.id).toBe('B');
    expect(d.decidedAt).toBe('asPath');
  });

  it('uses origin (IGP < EGP < INCOMPLETE) to break an AS_PATH tie', () => {
    const d = selectBestPath([base('A', { origin: 'INCOMPLETE' }), base('B', { origin: 'IGP' })]);
    expect(d.winner!.id).toBe('B');
    expect(d.decidedAt).toBe('origin');
  });

  it('prefers lower MED, then eBGP over iBGP', () => {
    expect(selectBestPath([base('A', { med: 50 }), base('B', { med: 10 })]).winner!.id).toBe('B');
    const ebgp = selectBestPath([base('A', { fromEbgp: false }), base('B', { fromEbgp: true })]);
    expect(ebgp.winner!.id).toBe('B');
    expect(ebgp.decidedAt).toBe('ebgp');
  });

  it('falls all the way to the lowest router-ID when everything else ties', () => {
    const d = selectBestPath([base('A', { routerId: 9 }), base('B', { routerId: 3 }), base('C', { routerId: 7 })]);
    expect(d.winner!.id).toBe('B');
    expect(d.decidedAt).toBe('routerId');
  });

  it('records eliminations rung by rung', () => {
    const d = selectBestPath([
      base('A', { localPref: 200, asPath: [1, 2] }), // survives local-pref, loses AS_PATH
      base('B', { localPref: 200, asPath: [1] }),    // the winner
      base('C', { localPref: 100 }),                 // eliminated at local-pref
    ]);
    const lp = d.steps.find((s) => s.rung.key === 'localPref')!;
    expect(lp.eliminated).toEqual(['C']);
    expect(lp.survivors.sort()).toEqual(['A', 'B']);
    const ap = d.steps.find((s) => s.rung.key === 'asPath')!;
    expect(ap.eliminated).toEqual(['A']);
    expect(d.winner!.id).toBe('B');
    expect(d.decidedAt).toBe('asPath');
  });
});
