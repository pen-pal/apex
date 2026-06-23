import { describe, it, expect } from 'vitest';
import { Switch, BROADCAST } from '../src/web/switch';

const A = 'aa:aa:aa:aa:aa:aa', B = 'bb:bb:bb:bb:bb:bb', C = 'cc:cc:cc:cc:cc:cc';

describe('learning switch (IEEE 802.1D)', () => {
  it('floods the first frame to an unknown destination, and learns the source', () => {
    const sw = new Switch(4);
    const r = sw.frame(A, B, 1); // A (port 1) → B (unknown)
    expect(r.learned).toBe(true);
    expect(r.action).toBe('flood-unknown');
    expect(r.egress).toEqual([2, 3, 4]); // all ports except ingress
    expect(sw.lookup(A)).toBe(1); // A is now learned on port 1
    expect(sw.lookup(B)).toBeNull(); // B still unknown
  });

  it('forwards to a single port once the destination is learned', () => {
    const sw = new Switch(4);
    sw.frame(A, B, 1); // A learned on 1 (flood)
    const reply = sw.frame(B, A, 2); // B (port 2) replies to A
    expect(reply.action).toBe('forward'); // A is known on port 1
    expect(reply.egress).toEqual([1]); // unicast, no flood
    expect(sw.lookup(B)).toBe(2); // B now learned too
    // and now A→B is a clean unicast as well
    expect(sw.frame(A, B, 1).action).toBe('forward');
    expect(sw.frame(A, B, 1).egress).toEqual([2]);
  });

  it('always floods a broadcast frame', () => {
    const sw = new Switch(4);
    sw.frame(A, B, 1);
    sw.frame(B, A, 2); // both learned
    const r = sw.frame(A, BROADCAST, 1);
    expect(r.action).toBe('flood-broadcast');
    expect(r.egress).toEqual([2, 3, 4]); // even though everything is learned
  });

  it('filters a frame whose destination is on the same port it arrived on', () => {
    const sw = new Switch(4);
    sw.frame(A, C, 1); // learn A on port 1
    sw.frame(C, A, 1); // learn C ALSO on port 1 (e.g. a hub/segment behind port 1)
    const r = sw.frame(A, C, 1); // A→C, both on port 1
    expect(r.action).toBe('filter');
    expect(r.egress).toEqual([]); // dropped — same segment
  });

  it('relearns (moves) a MAC when it appears on a new port', () => {
    const sw = new Switch(4);
    sw.frame(A, B, 1);
    expect(sw.lookup(A)).toBe(1);
    const moved = sw.frame(A, B, 3); // A now seen on port 3
    expect(moved.learned).toBe(true);
    expect(sw.lookup(A)).toBe(3);
  });

  it('ages out stale entries', () => {
    const sw = new Switch(4);
    sw.frame(A, B, 1); // clock 1
    sw.frame(B, A, 2); // clock 2
    sw.frame(B, A, 2); // clock 3 — refreshes B
    sw.age(2); // drop entries with age delta >= 2  → A (last seen clock 1) goes
    expect(sw.lookup(A)).toBeNull();
    expect(sw.lookup(B)).toBe(2); // B was refreshed, still present
  });
});
