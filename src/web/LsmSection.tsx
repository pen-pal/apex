// LSM-tree, made visible. Put keys into the memtable and watch it flush to immutable
// SSTables once full; look a key up and see how many SSTables the read must scan
// (read amplification); then compact to merge them, keeping the newest value per key and
// dropping tombstones. Real engine in lsm.ts (tested).
import { useMemo, useState } from 'react';
import { create, put, del, get, compact, readCost, type Lsm } from './lsm';

function clone(l: Lsm): Lsm {
  return { ...l, memtable: new Map(l.memtable), sstables: l.sstables.map((t) => ({ ...t, entries: [...t.entries] })) };
}

const SEED: [string, string][] = [['apple', '1'], ['mango', '2'], ['cherry', '3'], ['banana', '4'], ['kiwi', '5'], ['lime', '6']];

export function LsmSection() {
  const [lsm, setLsm] = useState<Lsm>(() => { const l = create(4); SEED.forEach(([k, v]) => put(l, k, v)); return l; });
  const [key, setKey] = useState('grape');
  const [val, setVal] = useState('7');
  const [query, setQuery] = useState('apple');

  const mutate = (fn: (l: Lsm) => void) => setLsm((cur) => { const l = clone(cur); fn(l); return l; });
  const lookup = useMemo(() => get(lsm, query), [lsm, query]);
  const cost = useMemo(() => readCost(lsm, query), [lsm, query]);

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>LSM-tree — writes that never seek</h2></div>
        <p className="jsec-sub">
          Where a B+tree updates pages in place, an LSM-tree just appends. Every write lands in a sorted in-memory <strong>memtable</strong>;
          when it fills, it’s frozen to disk as an immutable sorted <strong>SSTable</strong> and a new memtable begins. That makes writes
          blazingly fast — but a read may have to check several SSTables newest-first, so periodic <strong>compaction</strong> merges them.
        </p>

        <div className="lsm-write">
          <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="key" spellCheck={false} />
          <input value={val} onChange={(e) => setVal(e.target.value)} placeholder="value" spellCheck={false} />
          <button onClick={() => key && mutate((l) => put(l, key, val))}>put</button>
          <button onClick={() => key && mutate((l) => del(l, key))}>delete (tombstone)</button>
          <button onClick={() => mutate(compact)} className="lsm-compact">⚙ compact</button>
        </div>

        <div className="lsm-store">
          <div className="lsm-memtable">
            <div className="lsm-label">memtable (RAM) · {lsm.memtable.size}/{lsm.threshold}</div>
            <div className="lsm-entries">
              {lsm.memtable.size === 0 ? <span className="lsm-empty">empty</span> :
                [...lsm.memtable.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([k, v]) => (
                  <span key={k} className={`lsm-kv ${v === null ? 'tomb' : ''}`}>{k}:{v === null ? '✗' : v}</span>
                ))}
            </div>
          </div>
          <div className="lsm-sstables">
            {lsm.sstables.length === 0 ? <div className="lsm-label dim">no SSTables yet</div> : lsm.sstables.map((t, i) => (
              <div key={t.id} className="lsm-sst">
                <div className="lsm-label">SSTable {t.id} {i === lsm.sstables.length - 1 ? '(newest)' : ''} · disk</div>
                <div className="lsm-entries">
                  {t.entries.map(([k, v]) => <span key={k} className={`lsm-kv ${v === null ? 'tomb' : ''}`}>{k}:{v === null ? '✗' : v}</span>)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lsm-read">
          <span>read key</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} spellCheck={false} />
          <div className={`lsm-result ${lookup.value === null && lookup.foundIn === 'not found' ? 'miss' : lookup.value === null ? 'tomb' : 'hit'}`}>
            {lookup.foundIn === 'not found' ? '∅ not found'
              : lookup.value === null ? `deleted — tombstone in ${lookup.foundIn}`
              : `“${lookup.value}” from ${lookup.foundIn}`}
            <span className="lsm-cost">· scanned {cost} SSTable{cost === 1 ? '' : 's'}</span>
          </div>
        </div>

        <p className="lsm-foot">
          The trade is explicit: writes are sequential and cheap, but reads pay <em>read amplification</em> (more SSTables to check) and
          compaction pays <em>write amplification</em> (rewriting data to merge). A per-SSTable <strong>Bloom filter</strong> (see that
          section) skips files that definitely lack the key, and leveled compaction bounds the file count. This append-merge design is
          why LSM stores ingest writes far faster than B+trees — the engine behind Cassandra, RocksDB, and time-series databases.
        </p>
      </section>
    </div>
  );
}
