import { describe, it, expect } from 'vitest';
import { Balancer, skew, maxLoad, type Req, type Algo } from '../src/web/loadbalance';

const backends = [{ id: 'S1' }, { id: 'S2' }, { id: 'S3' }];
const req = (client = 'c', duration = 1): Req => ({ client, duration });

describe('round-robin', () => {
  it('cycles through backends in order', () => {
    const lb = new Balancer('round-robin', backends);
    const seq = Array.from({ length: 6 }, () => lb.dispatch(req()).backend);
    expect(seq).toEqual(['S1', 'S2', 'S3', 'S1', 'S2', 'S3']);
    expect(skew(lb.handledMap)).toBe(0); // perfectly even
  });
});

describe('weighted round-robin', () => {
  it('gives a heavier backend proportionally more requests', () => {
    const lb = new Balancer('weighted', [{ id: 'big', weight: 3 }, { id: 'small', weight: 1 }]);
    for (let i = 0; i < 8; i++) lb.dispatch(req());
    expect(lb.handledMap).toEqual({ big: 6, small: 2 }); // 3:1 ratio over 8 requests
  });
});

describe('least-connections', () => {
  it('sends new work to the idlest backend, skipping the busiest', () => {
    const lb = new Balancer('least-conn', backends);
    expect(lb.dispatch(req('a')).backend).toBe('S1'); // all idle → S1 (index tie-break)
    expect(lb.dispatch(req('b')).backend).toBe('S2');
    expect(lb.dispatch(req('c')).backend).toBe('S3'); // each now active=1
    expect(lb.dispatch(req('d')).backend).toBe('S1'); // tie → S1, now S1 active=2 (busiest)
    // S1 is the busiest now, so the next requests avoid it
    expect(lb.dispatch(req('e')).backend).not.toBe('S1');
    expect(lb.dispatch(req('f')).backend).not.toBe('S1');
  });
  it('reacts when a backend finishes its work (active drops)', () => {
    const lb = new Balancer('least-conn', backends);
    lb.dispatch(req('a')); lb.dispatch(req('b')); lb.dispatch(req('c')); // 1 each
    lb.dispatch(req('d')); // → S1, now S1=2
    lb.release('S1'); lb.release('S1'); // S1's two requests finish → S1 idle again
    expect(lb.dispatch(req('e')).backend).toBe('S1'); // idlest again → gets work
  });
});

describe('ip-hash (sticky sessions)', () => {
  it('always routes the same client to the same backend', () => {
    const lb = new Balancer('ip-hash', backends);
    const first = lb.dispatch(req('alice')).backend;
    for (let i = 0; i < 5; i++) expect(lb.dispatch(req('alice')).backend).toBe(first);
  });
  it('different clients can land on different backends', () => {
    const lb = new Balancer('ip-hash', backends);
    const targets = new Set(['alice', 'bob', 'carol', 'dave', 'eve'].map((c) => lb.dispatch(req(c)).backend));
    expect(targets.size).toBeGreaterThan(1); // not all on one backend
  });
});

describe('random', () => {
  it('stays in range, is deterministic per seed, and spreads across backends', () => {
    const run = () => { const lb = new Balancer('random', backends, 42); return Array.from({ length: 30 }, () => lb.dispatch(req()).backend); };
    const a = run(), b = run();
    expect(a).toEqual(b);                          // same seed → same sequence
    expect(a.every((x) => ['S1', 'S2', 'S3'].includes(x))).toBe(true);
    expect(new Set(a).size).toBeGreaterThan(1);    // uses more than one backend
  });
});

describe('power of two choices (p2c)', () => {
  it('samples two and picks the less-loaded, so it avoids the busiest', () => {
    const lb = new Balancer('p2c', backends, 1);
    // pile several onto whatever it picks, then confirm it steers away from the busiest over time
    for (let i = 0; i < 30; i++) lb.dispatch(req()); // never released → active accumulates
    const active = Object.fromEntries(lb.backends.map((b) => [b.id, b.active]));
    expect(maxLoad(active) - Math.min(...Object.values(active))).toBeLessThan(30); // not all on one
  });
  it('the tail is much smaller than pure random under overload (the whole point)', () => {
    const n = 16, balls = n * 10;
    const peak = (algo: Algo) => {
      let total = 0;
      for (let seed = 1; seed <= 15; seed++) {
        const lb = new Balancer(algo, Array.from({ length: n }, (_, i) => ({ id: 's' + i })), seed);
        for (let k = 0; k < balls; k++) lb.dispatch(req('c' + k, 99)); // no release → active = load
        total += maxLoad(Object.fromEntries(lb.backends.map((b) => [b.id, b.active])));
      }
      return total / 15;
    };
    const randomPeak = peak('random'), p2cPeak = peak('p2c');
    expect(p2cPeak).toBeLessThan(randomPeak);      // p2c's busiest server is less loaded
    expect(p2cPeak).toBeLessThan(balls / n + 4);   // and stays close to the ideal average (10)
    expect(randomPeak).toBeGreaterThan(balls / n + 4); // random's tail runs well above average
  });
  it('is deterministic per seed', () => {
    const run = () => { const lb = new Balancer('p2c', backends, 7); return Array.from({ length: 20 }, () => lb.dispatch(req()).backend); };
    expect(run()).toEqual(run());
  });
});

describe('skew / maxLoad', () => {
  it('measures spread and the busiest count', () => {
    expect(skew({ a: 5, b: 5, c: 5 })).toBe(0);
    expect(skew({ a: 9, b: 2, c: 1 })).toBe(8);
    expect(maxLoad({ a: 9, b: 2, c: 1 })).toBe(9);
  });
});
