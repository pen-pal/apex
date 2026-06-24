import { describe, it, expect } from 'vitest';
import { analyze } from '../src/web/sack';

// Segments 1..7, with 3 and 6 lost: received = T T F T T F T
const R = [true, true, false, true, true, false, true];

describe('SACK analysis of a gapped stream', () => {
  const a = analyze(R);

  it('the cumulative ACK stops at the first hole', () => {
    expect(a.cumulativeAck).toBe(2);     // has 1,2 contiguously, 3 missing
    expect(a.highestReceived).toBe(7);
  });

  it('SACK blocks report exactly the received ranges above the cumulative ack', () => {
    expect(a.sackBlocks).toEqual([[4, 5], [7, 7]]);
    expect(a.holes).toEqual([3, 6]);
  });

  it('SACK retransmits only the holes; go-back-N resends everything after the gap', () => {
    expect(a.retransmitWithSack).toEqual([3, 6]);
    expect(a.retransmitGoBackN).toEqual([3, 4, 5, 6, 7]);
    expect(a.saved).toBe(3); // 4,5,7 needlessly resent without SACK
  });
});

describe('edge cases', () => {
  it('no loss → nothing to retransmit', () => {
    const a = analyze([true, true, true]);
    expect(a.cumulativeAck).toBe(3);
    expect(a.holes).toEqual([]);
    expect(a.retransmitWithSack).toEqual([]);
    expect(a.saved).toBe(0);
  });

  it('a single hole costs SACK and go-back-N the same', () => {
    const a = analyze([true, false, true]); // only 2 lost
    expect(a.holes).toEqual([2]);
    expect(a.retransmitWithSack).toEqual([2]);
    expect(a.retransmitGoBackN).toEqual([2, 3]);
    expect(a.saved).toBe(1);
  });

  it('loss at the very front leaves cumulative ACK at 0', () => {
    const a = analyze([false, true, true]);
    expect(a.cumulativeAck).toBe(0);
    expect(a.sackBlocks).toEqual([[2, 3]]);
    expect(a.holes).toEqual([1]);
  });
});
