import { describe, it, expect } from 'vitest';
import { before, takeNumbers, entryOrder, winner, waitsFor, type Ticket } from '../src/web/bakery';

describe('the (number, id) total order', () => {
  it('lower number wins; ties broken by lower id', () => {
    expect(before({ id: 5, number: 1 }, { id: 0, number: 2 })).toBe(true);  // number 1 < 2
    expect(before({ id: 0, number: 2 }, { id: 2, number: 2 })).toBe(true);  // tie → id 0 < 2
    expect(before({ id: 2, number: 2 }, { id: 0, number: 2 })).toBe(false);
  });
});

describe('the doorway — taking numbers', () => {
  it('threads served one at a time take increasing numbers', () => {
    expect(takeNumbers([[0], [1], [2]])).toEqual([
      { id: 0, number: 1 }, { id: 1, number: 2 }, { id: 2, number: 3 },
    ]);
  });
  it('threads that read the counter simultaneously TIE on the number', () => {
    expect(takeNumbers([[0, 1, 2]])).toEqual([
      { id: 0, number: 1 }, { id: 1, number: 1 }, { id: 2, number: 1 },
    ]);
  });
  it('mixed waves: a tie, then a later single', () => {
    // 2 and 0 grab number 1 together; 1 arrives after and takes 2
    expect(takeNumbers([[2, 0], [1]])).toEqual([
      { id: 2, number: 1 }, { id: 0, number: 1 }, { id: 1, number: 2 },
    ]);
  });
});

describe('critical-section entry order & mutual exclusion', () => {
  it('enters in (number, id) order', () => {
    const t: Ticket[] = [{ id: 0, number: 2 }, { id: 1, number: 1 }, { id: 2, number: 2 }];
    expect(entryOrder(t)).toEqual([1, 0, 2]); // number-1 thread first; then number-2 by id
  });
  it('all-tie wave is served purely by id (FIFO by identity)', () => {
    expect(entryOrder(takeNumbers([[3, 1, 2, 0]]))).toEqual([0, 1, 2, 3]);
  });
  it('exactly one thread is the winner — mutual exclusion', () => {
    const t = takeNumbers([[2, 0], [1]]);
    expect(winner(t)).toBe(0); // (1,0) is the smallest key
    const firsts = t.filter((x) => !t.some((o) => waitsFor(x, o))); // threads with nobody ahead
    expect(firsts.map((x) => x.id)).toEqual([0]);                    // one and only one
  });
  it('for any two distinct threads, exactly one waits for the other (no deadlock)', () => {
    const t = takeNumbers([[0, 1], [2]]);
    for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) {
      const a = waitsFor(t[i], t[j]), b = waitsFor(t[j], t[i]);
      expect(a !== b).toBe(true); // exactly one direction holds
    }
  });
});
