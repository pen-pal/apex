import { describe, it, expect } from 'vitest';
import { analyze, type Span } from '../src/web/tracing';

// A checkout request: frontend calls auth and the order DB; the DB call hits a cache then executes.
const SPANS: Span[] = [
  { id: 'A', parent: null, service: 'frontend', op: 'GET /checkout', start: 0, duration: 100 },
  { id: 'B', parent: 'A', service: 'auth', op: 'verify token', start: 5, duration: 20 },
  { id: 'C', parent: 'A', service: 'orders-db', op: 'query orders', start: 30, duration: 50 },
  { id: 'D', parent: 'C', service: 'cache', op: 'GET cache', start: 35, duration: 10 },
  { id: 'E', parent: 'C', service: 'orders-db', op: 'exec', start: 48, duration: 30 },
];

describe('trace analysis', () => {
  const t = analyze(SPANS);

  it('total latency is the root span duration', () => {
    expect(t.total).toBe(100);
    expect(t.root.id).toBe('A');
  });

  it('self time = own duration minus children (the work each span did itself)', () => {
    expect(t.selfTime['A']).toBe(30); // 100 − (B 20 + C 50)
    expect(t.selfTime['C']).toBe(10); // 50 − (D 10 + E 30)
    expect(t.selfTime['B']).toBe(20); // leaf
    expect(t.selfTime['E']).toBe(30);
  });

  it('self times partition the whole request latency exactly', () => {
    const sum = SPANS.reduce((a, s) => a + t.selfTime[s.id], 0);
    expect(sum).toBe(t.total); // 30+20+10+10+30 = 100
  });

  it('attributes self time to the right services (orders-db is the hot spot)', () => {
    const byService = Object.fromEntries(t.byService.map((x) => [x.service, x.ms]));
    expect(byService['orders-db']).toBe(40); // C's 10 self + E's 30
    expect(byService['frontend']).toBe(30);
    expect(t.byService[0].service).toBe('orders-db'); // ranked highest
  });

  it('computes nesting depth for the waterfall indent', () => {
    expect(t.depth['A']).toBe(0);
    expect(t.depth['C']).toBe(1);
    expect(t.depth['D']).toBe(2);
  });

  it('orders spans pre-order by start for the waterfall', () => {
    expect(t.spans.map((s) => s.id)).toEqual(['A', 'B', 'C', 'D', 'E']);
  });
});
