import { describe, it, expect } from 'vitest';
import { deliverable, receive, type BMsg } from '../src/web/causalbcast';

// 3 processes (0,1,2). m1 from P0 [1,0,0]; m2 from P1 [1,1,0] is a reply that causally follows m1.
const m1: BMsg = { id: 'm1', from: 0, vc: [1, 0, 0] };
const m2: BMsg = { id: 'm2', from: 1, vc: [1, 1, 0] };

describe('deliverability rule (Birman-Schiper-Stephenson)', () => {
  it('a message is deliverable only when it is the next from its sender AND has no missing dependency', () => {
    expect(deliverable([0, 0, 0], m1)).toBe(true); // m1 is the first thing from P0, depends on nothing
    expect(deliverable([0, 0, 0], m2)).toBe(false); // m2 depends on m1 (vc[0]=1) which we haven't seen
    expect(deliverable([1, 0, 0], m2)).toBe(true); // once m1 is delivered, m2 becomes deliverable
  });
});

describe('causal delivery at a receiver', () => {
  it('reordered arrivals are buffered and released so causality holds', () => {
    const run = receive(3, [m2, m1]); // m2 arrives BEFORE m1 (network reorder)
    expect(run.deliveryOrder).toEqual(['m1', 'm2']); // but the reply is never delivered before the original
    const acts = run.events.map((e) => `${e.msgId}:${e.action}`);
    expect(acts).toContain('m2:buffered'); // held back
    expect(acts).toContain('m2:released'); // then released after m1
    expect(run.finalVc).toEqual([1, 1, 0]);
  });

  it('in-order arrivals deliver immediately with no buffering', () => {
    const run = receive(3, [m1, m2]);
    expect(run.deliveryOrder).toEqual(['m1', 'm2']);
    expect(run.events.every((e) => e.action !== 'buffered')).toBe(true);
  });

  it('a chain of dependencies arriving fully reversed still delivers in causal order', () => {
    // m1[1,0,0] → m2[1,1,0] → m3 from P2 [1,1,1]; arrive as m3, m2, m1
    const m3: BMsg = { id: 'm3', from: 2, vc: [1, 1, 1] };
    const run = receive(3, [m3, m2, m1]);
    expect(run.deliveryOrder).toEqual(['m1', 'm2', 'm3']);
    expect(run.finalVc).toEqual([1, 1, 1]);
  });

  it('concurrent (independent) messages deliver in arrival order, no waiting', () => {
    // two first-messages from different senders depend on nothing
    const a: BMsg = { id: 'a', from: 0, vc: [1, 0, 0] };
    const b: BMsg = { id: 'b', from: 1, vc: [0, 1, 0] };
    expect(receive(3, [b, a]).deliveryOrder).toEqual(['b', 'a']); // arrival order preserved (no causal link)
  });
});
