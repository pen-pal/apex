import { describe, it, expect } from 'vitest';
import { lamport, totalOrder, messageArrows, type InputEvent } from '../src/web/lamport';

// Hand-worked space-time diagram (3 processes A=0, B=1, C=2):
//   A:  a1(local)   a2(send m1)
//   B:  b1(local)   b2(recv m1)   b3(send m2)
//   C:                            c1(recv m2)
// Replayed in causal order. Lamport rules give the timestamps asserted below.
const EVENTS: InputEvent[] = [
  { proc: 0, kind: 'local', label: 'a1' },
  { proc: 0, kind: 'send', msg: 'm1', label: 'a2' },
  { proc: 1, kind: 'local', label: 'b1' },
  { proc: 1, kind: 'recv', msg: 'm1', label: 'b2' },
  { proc: 1, kind: 'send', msg: 'm2', label: 'b3' },
  { proc: 2, kind: 'recv', msg: 'm2', label: 'c1' },
];

describe('Lamport timestamps', () => {
  const s = lamport(EVENTS);
  const ts = (label: string) => s.find((e) => e.label === label)!.ts;

  it('follows the three clock rules', () => {
    expect(ts('a1')).toBe(1); // A: 0→1
    expect(ts('a2')).toBe(2); // A: 1→2, m1 carries 2
    expect(ts('b1')).toBe(1); // B: 0→1
    expect(ts('b2')).toBe(3); // B: max(1, 2)+1 = 3
    expect(ts('b3')).toBe(4); // B: 3→4, m2 carries 4
    expect(ts('c1')).toBe(5); // C: max(0, 4)+1 = 5
  });

  it('satisfies the clock condition a→b ⇒ C(a) < C(b)', () => {
    expect(ts('a2')).toBeLessThan(ts('b2')); // send before its receive
    expect(ts('b3')).toBeLessThan(ts('c1'));
  });

  it('shows the converse fails: smaller timestamp need not mean happens-before', () => {
    // b1 (ts 1) and a2 (ts 2): C(b1) < C(a2), yet b1 and a2 are concurrent — neither
    // causally precedes the other. Lamport order alone cannot detect this.
    expect(ts('b1')).toBeLessThan(ts('a2'));
  });
});

describe('total order and message pairing', () => {
  const s = lamport(EVENTS);
  it('orders all events consistently by (timestamp, process)', () => {
    expect(totalOrder(s).map((e) => e.label)).toEqual(['a1', 'b1', 'a2', 'b2', 'b3', 'c1']);
  });
  it('pairs each send with its matching receive', () => {
    const arrows = messageArrows(s);
    expect(arrows.map((a) => `${a.from.label}->${a.to.label}`)).toEqual(['a2->b2', 'b3->c1']);
  });
});
