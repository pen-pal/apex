import { describe, it, expect } from 'vitest';
import { rarity, rarestFirst, providerOf, unchoke, complete, type Peer } from '../src/web/bittorrent';

// Independent oracle: BitTorrent (BEP-3). Rarest-first selects the piece the FEWEST peers hold; a seed can provide
// any piece; tit-for-tat unchokes the top-rate peers plus one optimistic. Asserted against the spec, not the code.

const bf = (n: number, ...idx: number[]) => Array.from({ length: n }, (_, i) => idx.includes(i));

describe('BitTorrent core mechanics (BEP-3)', () => {
  // 5-piece file; piece 4 is held ONLY by the seed → the rarest
  const peers: Peer[] = [
    { id: 's', name: 'seed', has: bf(5, 0, 1, 2, 3, 4), seed: true },
    { id: 'a', name: 'A', has: bf(5, 0, 1, 2), seed: false },
    { id: 'b', name: 'B', has: bf(5, 0, 1, 3), seed: false },
  ];

  it('rarity counts how many peers hold each piece', () => {
    expect(rarity(peers, 5)).toEqual([3, 3, 2, 2, 1]);
  });
  it('rarest-first picks the least-available piece you lack', () => {
    expect(rarestFirst([false, false, false, false, false], peers)).toBe(4);
  });
  it('rarest-first skips pieces you already have', () => {
    expect(rarestFirst([false, false, false, false, true], peers)).toBe(2);
  });
  it('ties break to the lowest index', () => {
    expect(rarestFirst([true, true, false, false, true], peers)).toBe(2);
  });
  it('provider spreads load off the seed: a non-seed holder if any, else the seed', () => {
    expect(providerOf(peers, 4)?.id).toBe('s'); // only the seed has piece 4
    expect(providerOf(peers, 0)?.id).toBe('a'); // A and B also have piece 0 → offload the seed
  });
  it('a piece no peer has has no provider and is never picked', () => {
    const none: Peer[] = [{ id: 'x', name: 'x', has: [false, false], seed: false }];
    expect(providerOf(none, 0)).toBe(null);
    expect(rarestFirst([false, false], none)).toBe(-1);
  });
  it('tit-for-tat unchokes the top-rate peers plus one optimistic', () => {
    const set = unchoke({ a: 100, b: 5, s: 50 }, peers, 1, 'b');
    expect(set.has('a')).toBe(true);  // best rate
    expect(set.has('b')).toBe(true);  // optimistic
    expect(set.has('s')).toBe(false); // choked
  });
  it('complete detects a finished download', () => {
    expect(complete([true, true, true])).toBe(true);
    expect(complete([true, false, true])).toBe(false);
  });
});
