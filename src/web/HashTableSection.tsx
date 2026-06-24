// Hash table collision resolution, made visible. The same keys go into two tables side by
// side: separate chaining (lists hung off each slot) and open addressing (linear probing in
// a flat array). Insert keys and watch collisions either chain or probe forward; a lookup
// highlights the probe path. Real logic in hashtable.ts (tested).
import { useMemo, useState } from 'react';
import { createChained, chainInsert, createProbed, probeInsert, probeLookup, loadFactor, slotOf, type Chained, type Probed } from './hashtable';

const M = 8;
const SEED = ['apple', 'mango', 'cherry', 'banana', 'kiwi', 'plum'];

export function HashTableSection() {
  const [keys, setKeys] = useState<string[]>(SEED);
  const [next, setNext] = useState('grape');
  const [query, setQuery] = useState('mango');

  const { chained, probed } = useMemo(() => {
    const c: Chained = createChained(M);
    const p: Probed = createProbed(M);
    for (const k of keys) { chainInsert(c, k); probeInsert(p, k); }
    return { chained: c, probed: p };
  }, [keys]);

  const probeRes = useMemo(() => probeLookup(probed, query), [probed, query]);
  const querySlot = slotOf(query, M);
  // the probe path for the query (slots visited)
  const probePath = useMemo(() => {
    const path: number[] = [];
    for (let i = 0; i < M; i++) { const s = (querySlot + i) % M; path.push(s); if (probed.slots[s] === null || probed.slots[s] === query) break; }
    return path;
  }, [probed, querySlot, query]);

  const add = () => { const k = next.trim().toLowerCase(); if (k && /^[a-z]+$/.test(k) && !keys.includes(k)) { setKeys([...keys, k]); setNext(''); } };

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Hash tables — handling collisions two ways</h2></div>
        <p className="jsec-sub">
          A hash function maps a key to a slot, but different keys collide on the same slot. The two classic fixes: <strong>separate
          chaining</strong> keeps a little list at each slot, and <strong>open addressing</strong> stores everything in the flat array,
          walking forward to the next free slot on a collision. The same {keys.length} keys go into both below.
        </p>

        <div className="ht-ops">
          <input value={next} onChange={(e) => setNext(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="key" spellCheck={false} />
          <button onClick={add}>+ insert into both</button>
          <button onClick={() => setKeys(SEED)} className="ht-reset">reset</button>
          <span className="ht-load">load factor {(loadFactor(probed) * 100).toFixed(0)}%</span>
        </div>

        <div className="ht-tables">
          <div className="ht-table">
            <h3>Separate chaining</h3>
            {chained.buckets.map((bucket, i) => (
              <div key={i} className="ht-row">
                <span className="ht-slot">{i}</span>
                <div className="ht-chain">
                  {bucket.length === 0 ? <span className="ht-nil">∅</span> : bucket.map((k, j) => (
                    <span key={j} className={`ht-item ${k === query ? 'q' : ''}`}>{k}{j < bucket.length - 1 && <i className="ht-link">→</i>}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="ht-table">
            <h3>Open addressing (linear probing)</h3>
            {probed.slots.map((v, i) => (
              <div key={i} className="ht-row">
                <span className={`ht-slot ${probePath.includes(i) ? 'probe' : ''}`}>{i}</span>
                <div className="ht-cell">
                  {v ? <span className={`ht-item ${v === query ? 'q' : ''} ${slotOf(v, M) !== i ? 'displaced' : ''}`}>{v}{slotOf(v, M) !== i && <i className="ht-from">↩{slotOf(v, M)}</i>}</span> : <span className="ht-nil">empty</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="ht-lookup">
          <span>look up</span>
          <input value={query} onChange={(e) => setQuery(e.target.value.toLowerCase())} spellCheck={false} />
          <span className="ht-lresult">hashes to slot <b>{querySlot}</b>; probing {probeRes.found ? `found it in ${probeRes.probes} probe${probeRes.probes === 1 ? '' : 's'} at slot ${probeRes.slot}` : `scanned ${probeRes.probes} slot${probeRes.probes === 1 ? '' : 's'}, not present`}</span>
        </div>

        <p className="ht-foot">
          The trade-off is load factor. Chaining degrades gracefully — at load factor α the average chain is α long, so it stays usable
          past 100%. Probing is cache-friendly (everything’s contiguous) but suffers <em>primary clustering</em>: filled runs grow and
          merge, so lookups slow sharply as α nears 1, which is why open-addressed tables resize around 70%. The displaced markers
          (<i>↩</i>) show keys that didn’t get their home slot. Better probe sequences (quadratic, double hashing) and cuckoo hashing all
          attack this clustering.
        </p>
      </section>
    </div>
  );
}
