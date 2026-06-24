import { describe, it, expect } from 'vitest';
import { journey, PATH } from '../src/web/mpls';

const hops = journey();

describe('MPLS label-switched path', () => {
  it('ingress pushes, core swaps, penultimate pops, egress does IP', () => {
    expect(hops.map((h) => h.action)).toEqual(['push', 'swap', 'pop', 'ip']);
  });

  it('the label sequence is 100 → 200 → (popped)', () => {
    expect(hops[0].outLabel).toBe(100); // PE1 pushes 100
    expect(hops[1].inLabel).toBe(100); // P1 receives 100
    expect(hops[1].outLabel).toBe(200); // …swaps to 200
    expect(hops[2].inLabel).toBe(200); // P2 receives 200
    expect(hops[2].outLabel).toBeNull(); // …pops (PHP)
  });

  it('the egress receives an unlabeled packet (penultimate-hop popping)', () => {
    expect(hops[3].inLabel).toBeNull();
    expect(hops[3].action).toBe('ip');
    expect(hops[3].next).toBe('CE2');
  });

  it('each hop forwards to the next router in the LSP', () => {
    expect(hops.map((h) => h.next)).toEqual(['P1', 'P2', 'PE2', 'CE2']);
    expect(PATH.map((r) => r.name)).toEqual(['PE1', 'P1', 'P2', 'PE2']);
  });
});
