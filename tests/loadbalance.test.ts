import { describe, it, expect } from 'vitest';
import { Balancer, skew, type Req } from '../src/web/loadbalance';

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

describe('skew', () => {
  it('measures the spread between busiest and idlest', () => {
    expect(skew({ a: 5, b: 5, c: 5 })).toBe(0);
    expect(skew({ a: 9, b: 2, c: 1 })).toBe(8);
  });
});
