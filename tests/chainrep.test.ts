import { describe, it, expect } from 'vitest';
import { propagate, isCommitted, read, reconfigure } from '../src/web/chainrep';

const CHAIN = ['head', 'mid1', 'mid2', 'tail'];

describe('chain replication — write propagation head→tail', () => {
  it('a write reaches nodes one hop at a time', () => {
    expect(propagate(CHAIN, 'v1', 'v2', 0).map((n) => n.value)).toEqual(['v2', 'v1', 'v1', 'v1']);
    expect(propagate(CHAIN, 'v1', 'v2', 1).map((n) => n.value)).toEqual(['v2', 'v2', 'v1', 'v1']);
    expect(propagate(CHAIN, 'v1', 'v2', 3).map((n) => n.value)).toEqual(['v2', 'v2', 'v2', 'v2']);
  });
  it('committed only when the write reaches the tail', () => {
    expect(isCommitted(CHAIN, 0)).toBe(false);
    expect(isCommitted(CHAIN, 2)).toBe(false);
    expect(isCommitted(CHAIN, 3)).toBe(true);
  });
});

describe('reads from the tail are linearizable', () => {
  it('a read never sees an uncommitted write', () => {
    for (let d = 0; d < CHAIN.length - 1; d++) {
      expect(read(propagate(CHAIN, 'old', 'new', d))).toBe('old'); // tail still has old until fully propagated
    }
    expect(read(propagate(CHAIN, 'old', 'new', 3))).toBe('new'); // now committed → visible
  });
  it('the tail is the single source of read truth, independent of head/middle state', () => {
    // head & mid already have 'new', but until the tail does, the read is 'old'
    const inflight = propagate(CHAIN, 'old', 'new', 2);
    expect(inflight[0].value).toBe('new');     // head ahead
    expect(read(inflight)).toBe('old');        // read still old
  });
});

describe('failure reconfiguration', () => {
  it('head failure: the successor becomes head', () => {
    expect(reconfigure(CHAIN, 'head')).toEqual({ newChain: ['mid1', 'mid2', 'tail'], newHead: 'mid1', newTail: 'tail', role: 'head' });
  });
  it('tail failure: the predecessor becomes tail', () => {
    expect(reconfigure(CHAIN, 'tail')).toEqual({ newChain: ['head', 'mid1', 'mid2'], newHead: 'head', newTail: 'mid2', role: 'tail' });
  });
  it('middle failure: just link around it', () => {
    expect(reconfigure(CHAIN, 'mid1')).toEqual({ newChain: ['head', 'mid2', 'tail'], newHead: 'head', newTail: 'tail', role: 'middle' });
  });
});
