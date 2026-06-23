import { describe, it, expect } from 'vitest';
import { emptyClock, localEvent, send, receive, compare, clockString } from '../src/web/vectorclock';

const P = ['A', 'B', 'C'];

describe('clock updates', () => {
  it('a local event bumps only the process’s own entry', () => {
    expect(localEvent(emptyClock(P), 'A')).toEqual({ A: 1, B: 0, C: 0 });
  });
  it('receive merges elementwise-max then bumps own', () => {
    const here = { A: 0, B: 2, C: 1 };
    const msg = { A: 3, B: 1, C: 0 };
    expect(receive(here, msg, 'B')).toEqual({ A: 3, B: 3, C: 1 }); // max then B+1
  });
});

describe('compare — causal relation', () => {
  it('detects happens-before and its inverse', () => {
    expect(compare({ A: 1, B: 0 }, { A: 1, B: 1 })).toBe('before');
    expect(compare({ A: 1, B: 1 }, { A: 1, B: 0 })).toBe('after');
  });
  it('detects equality', () => {
    expect(compare({ A: 2, B: 1 }, { A: 2, B: 1 })).toBe('equal');
  });
  it('detects concurrency when neither dominates', () => {
    // A ahead on its own axis, B ahead on its — no causal order
    expect(compare({ A: 2, B: 0 }, { A: 0, B: 2 })).toBe('concurrent');
  });
});

describe('the classic message-passing example', () => {
  // A: e1(local), then send m to B. B: f1(local), then receive m, then g(local).
  // C runs independently.
  it('orders causally-related events and flags concurrent ones', () => {
    let a = emptyClock(P), b = emptyClock(P), c = emptyClock(P);

    const e1 = (a = localEvent(a, 'A'));          // A:[1,0,0]
    const mSend = (a = send(a, 'A'));             // A sends, A:[2,0,0]  (message carries this)
    const f1 = (b = localEvent(b, 'B'));          // B:[0,1,0]
    const recv = (b = receive(b, mSend, 'B'));    // B receives m → [2,2,0]
    const g = (b = localEvent(b, 'B'));           // B:[2,3,0]
    const ce = (c = localEvent(c, 'C'));          // C:[0,0,1] independent

    expect(clockString(e1, P)).toBe('[A:1, B:0, C:0]');
    expect(clockString(recv, P)).toBe('[A:2, B:2, C:0]');

    // the send causally precedes the receive (and everything after it on B)
    expect(compare(mSend, recv)).toBe('before');
    expect(compare(e1, g)).toBe('before');
    // B's own first event f1 is concurrent with A's send (neither caused the other)
    expect(compare(f1, mSend)).toBe('concurrent');
    // C's event is concurrent with everything on A and B
    expect(compare(ce, g)).toBe('concurrent');
    expect(compare(ce, e1)).toBe('concurrent');
  });
});
