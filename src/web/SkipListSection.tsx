// Skip list, made visible. The express lanes are drawn as stacked rows; search a key and
// the path lights up, riding the high lanes rightward and dropping down — visibly skipping
// most nodes. Insert keys (with a coin-flipped height) and watch the towers grow. Real
// structure in skiplist.ts (tested deterministically).
import { useMemo, useState } from 'react';
import { create, insert, search, toArray, heights, type SkipList } from './skiplist';

const MAXLVL = 4;
const SEED: [number, number][] = [[3, 1], [6, 4], [7, 1], [9, 2], [12, 1], [17, 3], [19, 2], [25, 4]];

// coin-flip a height (≥1), capped at MAXLVL — browser RNG, fine for the demo
const coinHeight = () => { let h = 1; while (h < MAXLVL && Math.random() < 0.5) h++; return h; };

export function SkipListSection() {
  const [list, setList] = useState<SkipList>(() => { const l = create(MAXLVL); SEED.forEach(([k, h]) => insert(l, k, h)); return l; });
  const [query, setQuery] = useState(19);
  const [nextKey, setNextKey] = useState('15');

  const keys = useMemo(() => toArray(list), [list]);
  const h = useMemo(() => heights(list), [list]);
  const result = useMemo(() => search(list, query), [list, query]);
  const onPath = new Set(result.visited);

  const add = () => { const k = parseInt(nextKey, 10); if (!isNaN(k) && !keys.includes(k)) { const l = create(MAXLVL); [...keys, k].forEach((kk) => insert(l, kk, kk === k ? coinHeight() : h[kk])); setList(l); } };

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Skip list — express lanes over a sorted list</h2></div>
        <p className="jsec-sub">
          Start with a plain sorted linked list (level 0). Now promote a random half of the nodes to a second level, a random half of
          <em> those</em> to a third, and so on — building sparse <strong>express lanes</strong>. To search, ride the highest lane right
          until the next key would overshoot, drop down a level, and repeat. You skip exponentially more nodes the higher you start, giving
          O(log n) search with nothing but linked lists.
        </p>

        <div className="skl-search">
          <span>search for</span>
          <select value={query} onChange={(e) => setQuery(+e.target.value)}>
            {keys.map((k) => <option key={k} value={k}>{k}</option>)}
            <option value={18}>18 (absent)</option>
          </select>
          <span className={`skl-verdict ${result.found ? 'found' : 'miss'}`}>{result.found ? `✓ found in ${result.hops} hops` : `✗ not found (${result.hops} hops)`}</span>
        </div>

        <div className="skl-grid">
          {Array.from({ length: MAXLVL }, (_, lv) => MAXLVL - 1 - lv).map((lvl) => (
            <div key={lvl} className="skl-row">
              <span className="skl-lvl">L{lvl}</span>
              <div className="skl-nodes">
                <span className="skl-head">▶</span>
                {keys.map((k) => (
                  <span key={k} className={`skl-cell ${h[k] > lvl ? 'present' : 'gap'} ${onPath.has(k) && h[k] > lvl ? 'path' : ''} ${k === query && result.found ? 'target' : ''}`}>
                    {h[k] > lvl ? k : ''}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="skl-add">
          <input value={nextKey} onChange={(e) => setNextKey(e.target.value)} inputMode="numeric" />
          <button onClick={add}>+ insert (random height)</button>
          <span className="skl-hint">{keys.length} keys</span>
        </div>

        <p className="skl-foot">
          The promotion probability ½ makes level <code>i</code> hold about n/2ⁱ nodes, so the tower is ~log₂n tall and each search drops
          through every level visiting O(1) nodes per level — O(log n) expected, with no rotations or rebalancing, ever. That simplicity
          and good concurrency is why Redis uses a skip list for sorted sets (ZSET), LevelDB/RocksDB use one for the memtable, and Java’s
          ConcurrentSkipListMap is built on it. The trade vs a balanced tree: bounds are probabilistic, not worst-case guaranteed.
        </p>
      </section>
    </div>
  );
}
