import { describe, it, expect } from 'vitest';
import { emptyStore, read, write, inspect, type Snapshot } from '../src/web/mvcc';

// txid 1 commits the initial value before any of our transactions begin.
const snap = (txid: number, committed: number[]): Snapshot => ({ txid, committed: new Set(committed) });

describe('snapshot isolation', () => {
  it('a reader keeps seeing its snapshot even after a writer commits', () => {
    const store = emptyStore();
    write(store, 'balance', '100', snap(1, [])); // tx1 creates the row, then commits

    // T2 begins with a snapshot that sees tx1
    const t2 = snap(2, [1]);
    expect(read(store, 'balance', t2).value).toBe('100');

    // T3 updates the balance and commits
    const t3 = snap(3, [1]);
    write(store, 'balance', '200', t3);

    // T2's snapshot does NOT include tx3, so it still reads the old value
    expect(read(store, 'balance', t2).value).toBe('100');

    // a NEW transaction T4, whose snapshot includes tx3, sees the new value
    const t4 = snap(4, [1, 3]);
    expect(read(store, 'balance', t4).value).toBe('200');
  });

  it('keeps multiple versions of the row', () => {
    const store = emptyStore();
    write(store, 'x', 'v1', snap(1, []));
    write(store, 'x', 'v2', snap(2, [1]));
    write(store, 'x', 'v3', snap(3, [1, 2]));
    expect(read(store, 'x', snap(9, [1, 2, 3])).versionsTotal).toBe(3);
    expect(read(store, 'x', snap(9, [1, 2, 3])).value).toBe('v3'); // latest committed wins
  });

  it('a transaction sees its own uncommitted write', () => {
    const store = emptyStore();
    write(store, 'k', 'committed', snap(1, []));
    const t5 = snap(5, [1]);
    write(store, 'k', 'mine', t5); // t5 not yet "committed" to anyone
    expect(read(store, 'k', t5).value).toBe('mine');     // sees its own write
    expect(read(store, 'k', snap(6, [1])).value).toBe('committed'); // others don't
  });
});

describe('version visibility inspection', () => {
  it('marks exactly one version visible to a snapshot', () => {
    const store = emptyStore();
    write(store, 'q', 'old', snap(1, []));
    write(store, 'q', 'new', snap(2, [1]));
    const view = inspect(store, 'q', snap(3, [1, 2]));
    expect(view).toHaveLength(2);
    expect(view.filter((r) => r.visible)).toHaveLength(1);
    expect(view.find((r) => r.visible)!.version.value).toBe('new');
  });
});
