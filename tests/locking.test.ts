import { describe, it, expect } from 'vitest';
import { run, findCycle, type Request } from '../src/web/locking';

describe('lock compatibility', () => {
  it('shared locks coexist', () => {
    const o = run([{ txid: 1, resource: 'A', mode: 'S' }, { txid: 2, resource: 'A', mode: 'S' }]);
    expect(o.granted).toHaveLength(2);
    expect(o.waiting).toHaveLength(0);
  });

  it('an exclusive lock blocks any other request', () => {
    const o = run([{ txid: 1, resource: 'A', mode: 'X' }, { txid: 2, resource: 'A', mode: 'S' }]);
    expect(o.granted).toHaveLength(1);
    expect(o.waiting).toEqual([{ txid: 2, resource: 'A', mode: 'S' }]);
    expect(o.waitFor).toEqual([[2, 1]]); // T2 waits for T1
  });

  it('a transaction that already holds a lock is granted again', () => {
    const o = run([{ txid: 1, resource: 'A', mode: 'X' }, { txid: 1, resource: 'A', mode: 'X' }]);
    expect(o.granted).toHaveLength(2);
  });
});

describe('deadlock detection', () => {
  it('detects the classic two-transaction deadlock', () => {
    // T1 holds A, T2 holds B; T1 wants B (waits for T2), T2 wants A (waits for T1) → cycle
    const reqs: Request[] = [
      { txid: 1, resource: 'A', mode: 'X' },
      { txid: 2, resource: 'B', mode: 'X' },
      { txid: 1, resource: 'B', mode: 'X' },
      { txid: 2, resource: 'A', mode: 'X' },
    ];
    const o = run(reqs);
    expect(o.deadlock).not.toBeNull();
    expect(new Set(o.deadlock)).toEqual(new Set([1, 2]));
  });

  it('no deadlock when waits do not form a cycle', () => {
    const o = run([
      { txid: 1, resource: 'A', mode: 'X' },
      { txid: 2, resource: 'A', mode: 'X' }, // T2 waits for T1
      { txid: 3, resource: 'B', mode: 'X' }, // unrelated
    ]);
    expect(o.deadlock).toBeNull();
    expect(o.waitFor).toEqual([[2, 1]]);
  });

  it('detects a three-transaction cycle', () => {
    // wait-for edges 1→2, 2→3, 3→1
    expect(new Set(findCycle([[1, 2], [2, 3], [3, 1]]))).toEqual(new Set([1, 2, 3]));
    expect(findCycle([[1, 2], [2, 3]])).toBeNull(); // a chain, no cycle
  });
});
