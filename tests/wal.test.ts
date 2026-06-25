import { describe, it, expect } from 'vitest';
import { recover, crashAt, type Rec } from '../src/web/wal';

const INITIAL = { x: '100', y: '50' };

// T1 updates x and commits; T2 updates y but the crash hits before its commit.
const LOG: Rec[] = [
  { lsn: 1, txid: 1, type: 'update', key: 'x', before: '100', after: '200' },
  { lsn: 2, txid: 1, type: 'commit' },
  { lsn: 3, txid: 2, type: 'update', key: 'y', before: '50', after: '999' },
  // (crash — no commit for tx2)
];

describe('crash recovery', () => {
  it('REDOes a committed transaction (durability)', () => {
    const r = recover(LOG, INITIAL);
    expect(r.final.x).toBe('200');     // tx1 committed → redone
    expect(r.committed).toContain(1);
    expect(r.redone).toHaveLength(1);
  });

  it('UNDOes an uncommitted transaction (atomicity)', () => {
    const r = recover(LOG, INITIAL);
    expect(r.final.y).toBe('50');      // tx2 never committed → rolled back to its pre-image
    expect(r.aborted).toContain(2);
    expect(r.undone).toHaveLength(1);
  });

  it('a later uncommitted overwrite reveals the earlier committed value', () => {
    const log: Rec[] = [
      { lsn: 1, txid: 1, type: 'update', key: 'x', before: '100', after: '200' },
      { lsn: 2, txid: 1, type: 'commit' },
      { lsn: 3, txid: 2, type: 'update', key: 'x', before: '200', after: '300' }, // uncommitted
    ];
    expect(recover(log, INITIAL).final.x).toBe('200'); // tx2 undone → tx1's committed value
  });
});

describe('the crash point matters (write-ahead guarantee)', () => {
  it('if the commit record survived, the transaction is durable', () => {
    expect(recover(crashAt(LOG, 2), INITIAL).final.x).toBe('200'); // commit at lsn 2 survived
  });

  it('if the crash hit before the commit record, the transaction is rolled back', () => {
    const r = recover(crashAt(LOG, 1), INITIAL); // only the update survived, not the commit
    expect(r.final.x).toBe('100'); // no commit record → undone
    expect(r.committed).not.toContain(1);
  });
});

describe('recovery replays in LSN order, not array order', () => {
  it('a shuffled log recovers identically to the ordered one', () => {
    const ordered: Rec[] = [
      { lsn: 1, txid: 1, type: 'update', key: 'x', before: '100', after: '200' },
      { lsn: 2, txid: 1, type: 'update', key: 'x', before: '200', after: '300' },
      { lsn: 3, txid: 1, type: 'commit' },
    ];
    const shuffled = [ordered[2], ordered[0], ordered[1]]; // out of LSN order
    expect(recover(shuffled, { x: '100' }).final).toEqual(recover(ordered, { x: '100' }).final);
    expect(recover(shuffled, { x: '100' }).final.x).toBe('300'); // last committed write by LSN wins
  });
});
