// Cuckoo hashing, made visible. A table where each key has two candidate slots; insert a
// key and watch it kick out the occupant of its slot, which re-homes in its other slot,
// chaining evictions until a free slot is found. Lookup highlights the (at most two) probed
// slots. Real structure in cuckoo.ts (tested).
import { useMemo, useState } from 'react';
import { create, insert, lookup, remove, slots, type Cuckoo } from './cuckoo';

const SEED = ['apple', 'mango', 'cherry', 'banana', 'kiwi', 'plum'];

function clone(c: Cuckoo): Cuckoo { return { ...c, table: [...c.table] }; }

export function CuckooSection() {
  const [c, setC] = useState<Cuckoo>(() => { const x = create(11); SEED.forEach((k) => insert(x, k)); return x; });
  const [key, setKey] = useState('grape');
  const [query, setQuery] = useState('mango');
  const [lastEvict, setLastEvict] = useState<Set<number>>(new Set());
  const [note, setNote] = useState('');

  const probe = useMemo(() => lookup(c, query), [c, query]);
  const probeSet = new Set(probe.probes);

  const add = () => {
    const k = key.trim(); if (!k) return;
    const next = clone(c); const r = insert(next, k);
    setLastEvict(new Set(r.evictions.flatMap((e) => [e.from, e.to])));
    setNote(r.ok ? (r.evictions.length ? `inserted “${k}” after ${r.evictions.length} eviction${r.evictions.length === 1 ? '' : 's'}` : `inserted “${k}”`) : `✗ couldn’t place “${k}” — chain too long, table needs a resize (no keys lost)`);
    setC(next);
  };
  const del = () => { const next = clone(c); remove(next, query); setLastEvict(new Set()); setC(next); };

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Cuckoo hashing — two nests per key</h2></div>
        <p className="jsec-sub">
          Every key has exactly <em>two</em> possible slots, picked by two hash functions — so a lookup is at most two probes, a
          worst-case guarantee a normal hash table can’t make. The cost is insertion: if both your slots’ logic lands you on an occupied
          one, you <strong>evict</strong> the occupant (like a cuckoo chick) and it re-homes in <em>its</em> other slot, possibly kicking
          out the next key — a chain of relocations.
        </p>

        <div className="cuck-ops">
          <input value={key} onChange={(e) => setKey(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="key" spellCheck={false} />
          <button onClick={add}>+ insert</button>
          {note && <span className={`cuck-note ${note.startsWith('✗') ? 'bad' : ''}`}>{note}</span>}
        </div>

        <div className="cuck-table">
          {c.table.map((v, i) => (
            <div key={i} className={`cuck-slot ${v ? 'filled' : ''} ${lastEvict.has(i) ? 'evicted' : ''} ${probeSet.has(i) ? 'probed' : ''}`}>
              <span className="cuck-idx">{i}</span>
              <span className="cuck-key">{v ?? ''}</span>
            </div>
          ))}
        </div>

        <div className="cuck-lookup">
          <span>look up</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} spellCheck={false} />
          <button onClick={del} className="cuck-del">delete</button>
          <span className={`cuck-result ${probe.found ? 'found' : 'miss'}`}>
            {probe.found ? `✓ found in slot ${probe.at} (${probe.probes.length} probe${probe.probes.length === 1 ? '' : 's'})` : `✗ not in slots [${probe.probes.join(', ')}]`}
          </span>
        </div>
        <div className="cuck-slots-hint">“{query}” hashes to slots <b>{slots(c, query)[0]}</b> and <b>{slots(c, query)[1]}</b> — the only two places it can be.</div>

        <p className="cuck-foot">
          Two probes maximum is gold for hardware and databases where worst-case latency matters. The price is insertion cost: as the
          table fills past ~50% (two-function) the eviction chains lengthen and can loop, forcing a resize — practical variants use more
          hash functions or buckets of several slots to push the load factor past 90%. A <strong>cuckoo filter</strong> stores tiny
          fingerprints this way to approximate set membership like a Bloom filter, but with one thing Bloom can’t do: <em>delete</em> an
          element (try the delete button above).
        </p>
      </section>
    </div>
  );
}
