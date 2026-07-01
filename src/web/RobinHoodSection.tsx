// Robin Hood hashing, made visible. An open-addressing table where each occupied slot shows its key and its
// probe distance from home, tinted by how far it had to travel (green = at home, red = far). Add keys and watch
// the "rob from the rich" rule keep the distances flat; the comparison shows how much smaller the max probe
// distance is than plain linear probing on the same keys. Real model from robinhood.ts.
import { useMemo, useState } from 'react';
import { RobinHood, plainLinearProbe } from './robinhood';

const CAP = 32;
const INITIAL = Array.from({ length: 20 }, (_, i) => 'k' + i);

const distClass = (d: number) => (d === 0 ? 'd0' : d === 1 ? 'd1' : d === 2 ? 'd2' : 'd3');

export function RobinHoodSection() {
  const [keys, setKeys] = useState<string[]>(INITIAL);
  const [input, setInput] = useState('');

  const table = useMemo(() => { const t = new RobinHood(CAP); for (const k of keys) t.insert(k); return t; }, [keys]);
  const stats = table.probeStats();
  const plain = useMemo(() => plainLinearProbe(keys, CAP), [keys]);
  const load = Math.round((table.size / CAP) * 100);

  const add = (key: string) => { if (key && !keys.includes(key) && table.size < CAP) setKeys((ks) => [...ks, key]); };
  const addRandom = () => { let s = (keys.length * 2654435761) >>> 0; s = (Math.imul(s, 1103515245) + 12345) >>> 0; add('x' + (s % 900)); };
  const reset = () => setKeys(INITIAL);

  const dist = (i: number) => { const sl = table.slots[i]; return sl ? (i - sl.home + CAP) % CAP : -1; };

  return (
    <div className="rbh">
      <p className="rbh-intro">
        In open addressing a key hashes to a <strong>home</strong> slot and probes forward if it's taken; the
        number of steps is its <strong>probe distance</strong>. Plain linear probing leaves some keys stranded far
        from home. Robin Hood's rule: while probing, if you meet a <em>richer</em> element (closer to its home
        than you are to yours), <strong>evict it and take its slot</strong>, carrying it onward — equalizing
        everyone's distance. Add keys:
      </p>

      <div className="rbh-controls">
        <input className="rbh-in" value={input} placeholder="key" onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && input) { add(input); setInput(''); } }} />
        <button type="button" className="rbh-btn" onClick={() => { if (input) { add(input); setInput(''); } }}>add</button>
        <button type="button" className="rbh-btn ghost" onClick={addRandom}>+ random</button>
        <button type="button" className="rbh-btn ghost" onClick={reset}>reset</button>
        <span className="rbh-load">load {load}% ({table.size}/{CAP})</span>
      </div>

      <div className="rbh-table">
        {table.slots.map((sl, i) => (
          <div key={i} className={`rbh-slot ${sl ? distClass(dist(i)) : 'empty'}`} title={sl ? `${sl.key} · home ${sl.home} · probe ${dist(i)}` : `slot ${i} empty`}>
            <span className="rbh-key">{sl ? sl.key : ''}</span>
            <span className="rbh-d">{sl ? dist(i) : ''}</span>
          </div>
        ))}
      </div>
      <div className="rbh-legend">probe distance: <span className="rbh-lg d0">0 (home)</span><span className="rbh-lg d1">1</span><span className="rbh-lg d2">2</span><span className="rbh-lg d3">3+</span></div>

      <div className="rbh-compare">
        <div className="rbh-cmp-h">max probe distance — the worst-case lookup:</div>
        <div className="rbh-crow"><span className="rbh-cname">Robin Hood</span><div className="rbh-ctrack"><div className="rbh-cfill rh" style={{ width: `${(stats.max / Math.max(1, plain.max)) * 100}%` }} /></div><span className="rbh-cval">{stats.max}</span></div>
        <div className="rbh-crow"><span className="rbh-cname">plain linear</span><div className="rbh-ctrack"><div className="rbh-cfill lp" style={{ width: '100%' }} /></div><span className="rbh-cval">{plain.max}</span></div>
        <div className="rbh-cmp-note">variance of probe distances: Robin Hood <b>{stats.variance.toFixed(2)}</b> vs plain linear <b>{plain.variance.toFixed(2)}</b> — same keys, same table, but Robin Hood's are far more uniform.</div>
      </div>

      <p className="rbh-foot">
        The win is variance, not average: Robin Hood doesn't reduce the <em>total</em> probing (the mean distance
        is identical to plain linear probing for the same keys — the elements occupy the same set of slots), it
        just redistributes it so no single key is a straggler. That flat distribution is what you want, because
        lookup cost is bounded by the MAX probe distance, not the mean — and a table's tail latency is set by its
        unluckiest key. It also enables the <strong>early-exit lookup</strong>: while probing for a key, if you
        reach a slot whose resident is closer to home than you'd be, your key can't be here (Robin Hood would have
        evicted that resident to place yours earlier), so you stop without walking the whole cluster. Deletion
        uses a <strong>backward shift</strong> — pull each following displaced element one slot back toward its
        home — which keeps the invariant without the tombstones that plague naive open addressing. The costs:
        insertions do extra swaps (writes), and like all open addressing it degrades sharply past ~90% load, so
        real implementations resize before then. Variants push further — <strong>hopscotch</strong> hashing keeps
        each key within a small neighborhood of its home for cache-friendly lookups, and Swiss tables (Abseil,
        Rust's current <code>HashMap</code>) use SIMD to scan control bytes — but Robin Hood remains a favorite
        for its simplicity and predictable latency. (Celis, 1986.)
      </p>
    </div>
  );
}
