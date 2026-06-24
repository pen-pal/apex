import { describe, it, expect } from 'vitest';
import { localEvent, recvEvent, run, compare, type Event, type Hlc } from '../src/web/hlc';

describe('HLC update rules (hand-worked)', () => {
  it('a local event tracks physical time, resetting the counter when it advances', () => {
    expect(localEvent({ l: 0, c: 0 }, 10)).toEqual({ l: 10, c: 0 });   // advances → c=0
    expect(localEvent({ l: 10, c: 0 }, 10)).toEqual({ l: 10, c: 1 });  // same l → c++
    expect(localEvent({ l: 10, c: 1 }, 10)).toEqual({ l: 10, c: 2 });
  });

  it('a backward clock jump keeps l and just bumps the counter', () => {
    // physical clock went from 10 back to 9 — HLC must not go backwards
    expect(localEvent({ l: 10, c: 1 }, 9)).toEqual({ l: 10, c: 2 });
  });

  it('receive takes the max l across local, message, and physical, then sets c', () => {
    expect(recvEvent({ l: 10, c: 2 }, { l: 15, c: 0 }, 12)).toEqual({ l: 15, c: 1 }); // msg l wins → c=msg.c+1
    expect(recvEvent({ l: 10, c: 3 }, { l: 8, c: 9 }, 7)).toEqual({ l: 10, c: 4 });   // local l wins → c++
    expect(recvEvent({ l: 10, c: 3 }, { l: 10, c: 5 }, 9)).toEqual({ l: 10, c: 6 });  // tie → max(c)+1
    expect(recvEvent({ l: 5, c: 9 }, { l: 6, c: 2 }, 20)).toEqual({ l: 20, c: 0 });   // physical wins → c=0
  });
});

describe('HLC properties', () => {
  it('is monotonic and stays at or above physical time', () => {
    const events: Event[] = [
      { kind: 'local', pt: 10, label: 'a' },
      { kind: 'local', pt: 10, label: 'b' },
      { kind: 'local', pt: 9, label: 'c' },   // clock skews backward
      { kind: 'recv', pt: 12, msg: { l: 15, c: 0 }, label: 'd' },
      { kind: 'local', pt: 16, label: 'e' },
    ];
    const out = run(events);
    expect(out.map((s) => `${s.hlc.l}.${s.hlc.c}`)).toEqual(['10.0', '10.1', '10.2', '15.1', '16.0']);
    // monotonic non-decreasing
    for (let i = 1; i < out.length; i++) expect(compare(out[i].hlc, out[i - 1].hlc)).toBeGreaterThan(0);
    // l never below physical time
    for (const s of out) expect(s.hlc.l).toBeGreaterThanOrEqual(s.event.pt);
  });

  it('captures happens-before: a received event outranks the message it carried', () => {
    const sent: Hlc = { l: 15, c: 0 };
    const received = recvEvent({ l: 10, c: 0 }, sent, 11);
    expect(compare(received, sent)).toBeGreaterThan(0); // recv strictly after send
  });
});
