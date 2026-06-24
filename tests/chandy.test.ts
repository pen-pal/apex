import { describe, it, expect } from 'vitest';
import { run, CLASSIC, type Scenario } from '../src/web/chandy';

// Hand-traced from the algorithm, not read back from the implementation.
// Initial: P0=$100, P1=$50, total $150. A $20 transfer is received before the marker (so it
// becomes part of P1's recorded state); a $10 transfer P1→P0 is in flight ACROSS the cut and
// must be captured as channel state for the books to balance.
describe('Chandy-Lamport snapshot — the classic two-account scenario', () => {
  const r = run(CLASSIC);

  it('completes: every process recorded and every channel marker consumed', () => {
    expect(r.complete).toBe(true);
  });

  it('records the cut: P0=$80, P1=$60, with $10 caught in flight on P1→P0', () => {
    expect(r.recordedBalance).toEqual({ P0: 80, P1: 60 });
    expect(r.chMsgs['P1->P0']).toEqual([10]); // the in-flight transfer
    expect(r.chMsgs['P0->P1']).toEqual([]); // the $20 was received pre-marker, not in flight
  });

  it('the recorded snapshot conserves the total — the Chandy-Lamport guarantee', () => {
    expect(r.snapshotTotal).toBe(150);
    expect(r.snapshotTotal).toBe(r.initialTotal);
    expect(r.conserved).toBe(true);
  });

  it('ignoring channel state would lose money (why capturing the channel matters)', () => {
    expect(r.naiveTotal).toBe(140); // process balances alone are $10 short
    expect(r.initialTotal - r.naiveTotal).toBe(10); // exactly the in-flight transfer
  });
});

describe('the snapshot is a consistent cut regardless of how messages interleave', () => {
  // Same books, but P0 transfers nothing and P1 sends $30 to P0 which is still in flight when
  // the markers sweep through. Conservation must still hold (total stays $150).
  const s: Scenario = {
    processes: [{ id: 'P0', balance: 100 }, { id: 'P1', balance: 50 }],
    channels: [['P0', 'P1'], ['P1', 'P0']],
    events: [
      { type: 'init', p: 'P0' }, //                       P0 records $100, sends marker on P0→P1
      { type: 'send', from: 'P1', to: 'P0', amount: 30 },// $30 P1→P0 in flight (sent before P1 records)
      { type: 'recv', from: 'P0', to: 'P1' }, //           P1 gets the marker ⇒ records $50, marks P0→P1 empty, sends marker on P1→P0
      { type: 'recv', from: 'P1', to: 'P0' }, //           P0 receives $30 ⇒ captured on P1→P0
      { type: 'recv', from: 'P1', to: 'P0' }, //           P0 receives the marker ⇒ done
    ],
  };
  const r = run(s);

  it('captures the $30 still in the channel and stays balanced', () => {
    expect(r.complete).toBe(true);
    // P1 sent the $30 BEFORE it recorded, so it records $20; the $30 lives in the channel.
    expect(r.recordedBalance).toEqual({ P0: 100, P1: 20 });
    expect(r.chMsgs['P1->P0']).toEqual([30]);
    expect(r.snapshotTotal).toBe(150);
    expect(r.conserved).toBe(true);
    expect(r.naiveTotal).toBe(120); // balances alone ($100+$20) miss the $30 in flight
    expect(r.initialTotal - r.naiveTotal).toBe(30);
  });
});
