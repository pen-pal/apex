// Join algorithms, side by side. The same two relations and the same join key, run three ways — and
// the work each does made concrete. The nested-loop grid literally IS its |R|·|S| comparisons (every
// cell is one), hash join shows the table it builds on S, sort-merge shows both inputs sorted for the
// single linear sweep. Edit the keys and watch the cost strip move. Real model from joins.ts.
import { useMemo, useState } from 'react';
import { nestedLoop, hashJoin, sortMerge, type Row } from './joins';

type Algo = 'nlj' | 'hash' | 'merge';
const ALGO_LABEL: Record<Algo, string> = { nlj: 'Nested-loop', hash: 'Hash join', merge: 'Sort-merge' };

const PRESETS: Record<string, { R: Row[]; S: Row[] }> = {
  'customers ⋈ orders': {
    R: [{ row: 'Ann', key: 1 }, { row: 'Bob', key: 2 }, { row: 'Cy', key: 2 }, { row: 'Dee', key: 4 }],
    S: [{ row: 'o100', key: 2 }, { row: 'o101', key: 1 }, { row: 'o102', key: 2 }, { row: 'o103', key: 3 }, { row: 'o104', key: 1 }],
  },
  'no matches': {
    R: [{ row: 'A', key: 1 }, { row: 'B', key: 3 }, { row: 'C', key: 5 }],
    S: [{ row: 'x', key: 2 }, { row: 'y', key: 4 }, { row: 'z', key: 6 }],
  },
  'many duplicates': {
    R: [{ row: 'A', key: 1 }, { row: 'B', key: 1 }, { row: 'C', key: 1 }],
    S: [{ row: 'x', key: 1 }, { row: 'y', key: 1 }, { row: 'z', key: 1 }],
  },
};

export function JoinsSection() {
  const [R, setR] = useState<Row[]>(PRESETS['customers ⋈ orders'].R);
  const [S, setS] = useState<Row[]>(PRESETS['customers ⋈ orders'].S);
  const [algo, setAlgo] = useState<Algo>('nlj');

  const nlj = useMemo(() => nestedLoop(R, S), [R, S]);
  const hash = useMemo(() => hashJoin(R, S), [R, S]);
  const merge = useMemo(() => sortMerge(R, S), [R, S]);

  const setKey = (side: 'R' | 'S', i: number, key: number) =>
    (side === 'R' ? setR : setS)((rows) => rows.map((r, k) => (k === i ? { ...r, key } : r)));
  const preset = (name: string) => { setR(PRESETS[name].R); setS(PRESETS[name].S); };

  const cost = [
    { algo: 'nlj' as Algo, headline: `${nlj.comparisons} comparisons`, detail: '|R| · |S| — every pair' },
    { algo: 'hash' as Algo, headline: `${hash.buildOps + hash.probeLookups + hash.probeComparisons} ops`, detail: `build ${hash.buildOps} + probe ${hash.probeLookups} + ${hash.probeComparisons} matches` },
    { algo: 'merge' as Algo, headline: `${merge.mergeComparisons} merge-compares`, detail: '+ one O(n log n) sort of each side' },
  ];
  const minComparisons = Math.min(nlj.comparisons, hash.probeComparisons, merge.mergeComparisons);

  return (
    <div className="jn">
      <div className="jn-controls">
        <div className="jn-algos">
          {(['nlj', 'hash', 'merge'] as Algo[]).map((a) => (
            <button key={a} type="button" className={`jn-algo ${algo === a ? 'on' : ''}`} onClick={() => setAlgo(a)}>{ALGO_LABEL[a]}</button>
          ))}
        </div>
        <div className="jn-presets">
          {Object.keys(PRESETS).map((name) => (
            <button key={name} type="button" className="jn-preset" onClick={() => preset(name)}>{name}</button>
          ))}
        </div>
      </div>

      <div className="jn-rels">
        {(['R', 'S'] as const).map((side) => {
          const rows = side === 'R' ? R : S;
          return (
            <div key={side} className="jn-rel">
              <div className="jn-rel-h">{side === 'R' ? 'R (left)' : 'S (right)'} <span>{rows.length} rows</span></div>
              {rows.map((r, i) => (
                <div key={r.row} className="jn-row">
                  <span className="jn-rlabel">{r.row}</span>
                  <span className="jn-rkey">key
                    <input type="number" min={0} max={9} value={r.key} onChange={(e) => setKey(side, i, Math.max(0, Math.min(9, +e.target.value)))} />
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {algo === 'nlj' && (
        <div className="jn-viz">
          <div className="jn-viz-h">Every cell is one comparison — {nlj.comparisons} total. Green = the keys match.</div>
          <table className="jn-grid">
            <thead><tr><th></th>{S.map((s) => <th key={s.row}>{s.row}<br /><span>{s.key}</span></th>)}</tr></thead>
            <tbody>
              {R.map((r) => (
                <tr key={r.row}>
                  <th>{r.row}<span>{r.key}</span></th>
                  {S.map((s) => <td key={s.row} className={r.key === s.key ? 'hit' : ''}>{r.key === s.key ? '✓' : '·'}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {algo === 'hash' && (
        <div className="jn-viz">
          <div className="jn-viz-h">Build a hash table on S ({hash.buildOps} inserts), then probe it once per R row ({hash.probeLookups} lookups).</div>
          <div className="jn-buckets">
            {hash.buckets.map((b) => (
              <div key={b.key} className="jn-bucket">
                <span className="jn-bkey">key {b.key}</span>
                <span className="jn-brows">{b.rows.join(', ')}</span>
                <span className="jn-bprobe">{R.filter((r) => r.key === b.key).map((r) => r.row).join(', ') || '—'} probes here</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {algo === 'merge' && (
        <div className="jn-viz">
          <div className="jn-viz-h">Sort both sides, then sweep with two cursors — {merge.mergeComparisons} key comparisons in the merge.</div>
          <div className="jn-merge">
            <div className="jn-mcol"><span className="jn-mh">sorted R</span>{merge.sortedR.map((r, i) => <span key={i} className="jn-mcell">{r.row}<b>{r.key}</b></span>)}</div>
            <div className="jn-mcol"><span className="jn-mh">sorted S</span>{merge.sortedS.map((s, i) => <span key={i} className="jn-mcell">{s.row}<b>{s.key}</b></span>)}</div>
          </div>
        </div>
      )}

      <div className="jn-cost">
        {cost.map((c) => (
          <button key={c.algo} type="button" className={`jn-costcard ${algo === c.algo ? 'on' : ''}`} onClick={() => setAlgo(c.algo)}>
            <span className="jn-cl">{ALGO_LABEL[c.algo]}</span>
            <span className="jn-ch">{c.headline}</span>
            <span className="jn-cd">{c.detail}</span>
          </button>
        ))}
      </div>

      <div className="jn-result">
        <div className="jn-result-h">Result — {nlj.pairs.length} matched rows (all three algorithms agree)</div>
        <div className="jn-pairs">
          {nlj.pairs.length === 0 ? <span className="jn-empty">no rows join</span> :
            nlj.pairs.map((p, i) => <span key={i} className="jn-pair">{p[0]} ⋈ {p[1]}</span>)}
        </div>
      </div>

      <p className="jn-foot">
        All three return the same rows; the optimizer chooses by cost. <strong>Nested-loop</strong> needs no setup but is quadratic — fine for
        tiny or indexed inputs. <strong>Hash join</strong> is usually the winner for equi-joins on large unsorted inputs (linear, but needs
        memory for the table and can’t do range/inequality joins). <strong>Sort-merge</strong> wins when the inputs are already sorted (e.g.
        from an index) or when you need the output sorted anyway — the sort dominates its cost, the merge itself is a cheap linear sweep
        {minComparisons === merge.mergeComparisons ? ' (the fewest comparisons here, once sorted)' : ''}.
      </p>
    </div>
  );
}
