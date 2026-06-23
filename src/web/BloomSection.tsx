// Bloom filter, made visible. Add items and watch their k bits light up in the
// array; query an item to get "definitely not present" (some bit is 0) or "possibly
// present" (all bits 1 — maybe a false positive). The false-positive rate climbs as
// the array fills, matching the theory. Real model (see bloom.ts).
import { useMemo, useState } from 'react';
import { BloomFilter } from './bloom';

const WORDS = ['apple', 'banana', 'cherry', 'date', 'elder', 'fig', 'grape', 'kiwi', 'lemon', 'mango', 'olive', 'pear', 'quince', 'rasp', 'plum'];
const ABSENT = Array.from({ length: 400 }, (_, i) => `absent-${i}`);

export function BloomSection() {
  const [m, setM] = useState(96);
  const [k, setK] = useState(3);
  const [added, setAdded] = useState<string[]>([]);
  const [addText, setAddText] = useState('');
  const [queryText, setQueryText] = useState('');
  const [result, setResult] = useState<{ key: string; positions: number[]; verdict: string; falsePositive: boolean } | null>(null);

  const bf = useMemo(() => { const b = new BloomFilter(m, k); added.forEach((x) => b.add(x)); return b; }, [m, k, added]);
  const queryPos = result ? new Set(result.positions) : new Set<number>();

  const measuredFp = useMemo(() => {
    if (added.length === 0) return 0;
    let fp = 0;
    for (const key of ABSENT) if (bf.query(key).verdict === 'possibly') fp++;
    return fp / ABSENT.length;
  }, [bf, added.length]);

  const add = (word: string) => { const w = word.trim(); if (w && !added.includes(w)) setAdded((a) => [...a, w]); setResult(null); };
  const addSome = () => { const next = WORDS.filter((w) => !added.includes(w)).slice(0, 5); setAdded((a) => [...a, ...next]); setResult(null); };
  const query = (word: string) => {
    const w = word.trim(); if (!w) return;
    const q = bf.query(w);
    setResult({ key: w, positions: q.positions, verdict: q.verdict, falsePositive: q.verdict === 'possibly' && !bf.wasAdded(w) });
  };
  const reset = () => { setAdded([]); setResult(null); };

  const fill = bf.setBits / m;
  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Bloom filter — “definitely not” or “probably yes”</h2></div>
        <p className="jsec-sub">
          A Bloom filter answers set-membership in a few bits and a few hashes. Adding an item sets <strong>k</strong> bits;
          a query checks those bits. If any is 0 the item was <strong>definitely never added</strong> (no false negatives,
          ever). If all are 1 it’s <strong>probably</strong> present — but other items may have set those bits, so it can be a
          false positive. Add items and watch the array fill.
        </p>

        <div className="bloom-sliders">
          <label>array size m: {m}<input type="range" min={32} max={192} step={8} value={m} onChange={(e) => { setM(+e.target.value); setResult(null); }} /></label>
          <label>hashes k: {k}<input type="range" min={1} max={8} value={k} onChange={(e) => { setK(+e.target.value); setResult(null); }} /></label>
        </div>

        <div className="bloom-grid" style={{ gridTemplateColumns: `repeat(${Math.min(m, 24)}, 1fr)` }}>
          {Array.from({ length: m }, (_, i) => {
            const set = bf.bits[i] === 1;
            const inQuery = queryPos.has(i);
            const badBit = inQuery && !set; // a zero bit that proves definitely-not
            return <span key={i} className={`bloom-bit ${set ? 'set' : ''} ${inQuery ? 'q' : ''} ${badBit ? 'bad' : ''}`} />;
          })}
        </div>
        <div className="bloom-stats">
          <span><strong>{added.length}</strong> items</span>
          <span><strong>{bf.setBits}</strong>/{m} bits set ({Math.round(fill * 100)}%)</span>
          <span>false-positive rate: <strong>{(measuredFp * 100).toFixed(1)}%</strong> <em>(theory {(bf.theoreticalFpRate() * 100).toFixed(1)}%)</em></span>
        </div>

        <div className="bloom-actions">
          <div className="bloom-row">
            <input className="enc-input narrow" value={addText} onChange={(e) => setAddText(e.target.value)} placeholder="add an item…" spellCheck={false} onKeyDown={(e) => e.key === 'Enter' && (add(addText), setAddText(''))} />
            <button className="ghost small" onClick={() => { add(addText); setAddText(''); }}>+ add</button>
            <button className="ghost small" onClick={addSome}>+ add 5 fruits</button>
            <button className="ghost small" onClick={reset}>↺ reset</button>
          </div>
          <div className="bloom-row">
            <input className="enc-input narrow" value={queryText} onChange={(e) => setQueryText(e.target.value)} placeholder="query an item…" spellCheck={false} onKeyDown={(e) => e.key === 'Enter' && query(queryText)} />
            <button className="ghost small" onClick={() => query(queryText)}>? query</button>
          </div>
        </div>

        {result && (
          <div className={`bloom-verdict ${result.verdict === 'possibly' ? 'maybe' : 'no'}`}>
            <strong>{result.key}</strong>: {result.verdict === 'possibly' ? '🟢 possibly present (all k bits are 1)' : '🔴 definitely NOT present (a queried bit is 0)'}
            {result.falsePositive && <div className="bloom-fp">⚠ false positive — this item was never added, but its {k} bits all happened to be set by other items.</div>}
          </div>
        )}
        <p className="enc-note">This is why your browser’s “is this URL malicious?” check, a database’s “might this key exist before I hit disk?”,
          and CDN cache lookups use Bloom filters: a definite “no” avoids an expensive lookup, and a rare false “maybe” just costs one. You can’t
          delete from a plain Bloom filter (clearing a bit could break another item) — that’s what counting Bloom filters are for.</p>
      </section>
    </div>
  );
}
