import { describe, it, expect } from 'vitest';
import { create, put, del, get, compact, readCost } from '../src/web/lsm';

describe('LSM writes and flushing', () => {
  it('flushes the memtable to a sorted SSTable when it fills', () => {
    const lsm = create(4);
    put(lsm, 'b', '1'); put(lsm, 'a', '2'); put(lsm, 'd', '3');
    expect(lsm.sstables).toHaveLength(0); // not full yet
    put(lsm, 'c', '4'); // 4th → flush
    expect(lsm.sstables).toHaveLength(1);
    expect(lsm.memtable.size).toBe(0);
    expect(lsm.sstables[0].entries.map(([k]) => k)).toEqual(['a', 'b', 'c', 'd']); // sorted
  });
});

describe('newest-wins reads', () => {
  it('a later value shadows an earlier one across flushes', () => {
    const lsm = create(2);
    put(lsm, 'x', 'old'); put(lsm, 'y', '_'); // flush #1 has x=old
    put(lsm, 'x', 'new'); put(lsm, 'z', '_'); // flush #2 has x=new
    expect(get(lsm, 'x').value).toBe('new'); // newest SSTable wins
  });

  it('a value still in the memtable beats everything on disk', () => {
    const lsm = create(2);
    put(lsm, 'k', 'disk'); put(lsm, 'q', '_'); // flush: k=disk
    put(lsm, 'k', 'mem'); // still in memtable
    const r = get(lsm, 'k');
    expect(r.value).toBe('mem');
    expect(r.foundIn).toBe('memtable');
  });
});

describe('tombstones and compaction', () => {
  it('a delete shadows an older value', () => {
    const lsm = create(2);
    put(lsm, 'd', 'here'); put(lsm, 'e', '_'); // flush: d=here
    del(lsm, 'd'); // tombstone in memtable
    expect(get(lsm, 'd').value).toBe(null);
  });

  it('compaction keeps the newest value per key and drops tombstones', () => {
    const lsm = create(2);
    put(lsm, 'a', 'v1'); put(lsm, 'b', 'keep'); // flush 1
    put(lsm, 'a', 'v2'); put(lsm, 'c', 'gone'); // flush 2
    del(lsm, 'c'); put(lsm, 'd', 'keep'); // flush 3 (c tombstone)
    compact(lsm);
    expect(lsm.sstables).toHaveLength(1);
    const map = Object.fromEntries(lsm.sstables[0].entries);
    expect(map).toEqual({ a: 'v2', b: 'keep', d: 'keep' }); // a=v2 (newest), c dropped (tombstone)
  });
});

describe('read amplification', () => {
  it('a key in an older SSTable costs more reads; compaction collapses it to one', () => {
    const lsm = create(2);
    put(lsm, 'old', 'v'); put(lsm, 'a', '_'); // flush 1 has 'old'
    put(lsm, 'b', '_'); put(lsm, 'c', '_');   // flush 2
    put(lsm, 'd', '_'); put(lsm, 'e', '_');   // flush 3
    expect(readCost(lsm, 'old')).toBe(3); // must scan past the two newer SSTables
    compact(lsm);
    expect(readCost(lsm, 'old')).toBe(1); // one merged SSTable
  });
});
