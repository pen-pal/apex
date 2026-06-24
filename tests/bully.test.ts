import { describe, it, expect } from 'vitest';
import { runElection } from '../src/web/bully';

const NODES = [1, 2, 3, 4, 5];

describe('Bully leader election', () => {
  it('elects the highest live node, regardless of who starts', () => {
    const all = new Set(NODES);
    expect(runElection(NODES, all, 2).coordinator).toBe(5);
    expect(runElection(NODES, all, 1).coordinator).toBe(5);
    expect(runElection(NODES, all, 4).coordinator).toBe(5);
  });

  it('skips dead higher nodes and elects the highest survivor', () => {
    const alive = new Set([1, 2, 3]); // 4 and 5 are down
    const e = runElection(NODES, alive, 1);
    expect(e.coordinator).toBe(3);
  });

  it('the winner announces COORDINATOR to every other node', () => {
    const e = runElection(NODES, new Set([1, 2, 3]), 1);
    const coordMsgs = e.messages.filter((m) => m.type === 'COORDINATOR');
    expect(coordMsgs.every((m) => m.from === 3)).toBe(true);
    expect(coordMsgs.map((m) => m.to).sort()).toEqual([1, 2, 4, 5]); // everyone but the coordinator
  });

  it('live higher nodes answer OK to a lower starter', () => {
    const e = runElection(NODES, new Set(NODES), 2);
    // node 2's ELECTION to 3,4,5 each draws an OK back to 2
    const oksTo2 = e.messages.filter((m) => m.type === 'OK' && m.to === 2).map((m) => m.from).sort();
    expect(oksTo2).toEqual([3, 4, 5]);
  });

  it('the highest node receives no OK (nobody is above it)', () => {
    const e = runElection(NODES, new Set(NODES), 2);
    expect(e.messages.some((m) => m.type === 'OK' && m.to === 5)).toBe(false);
  });

  it('a lone survivor immediately becomes coordinator', () => {
    const e = runElection(NODES, new Set([3]), 3);
    expect(e.coordinator).toBe(3);
    expect(e.messages.filter((m) => m.type === 'OK')).toHaveLength(0);
  });
});
