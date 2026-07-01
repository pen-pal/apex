// Bitmap index, made visible. A small table of rows; below it, one bitmap per column value (a bit per row).
// Click column-value chips to build a WHERE clause and watch the query evaluate as raw bitwise AND/OR (with an
// optional NOT per predicate) over the bitmaps — the matching rows light up in the table and the result bitmap.
// Real model from bitmapindex.ts.
import { useState } from 'react';
import { buildIndex, evalQuery, predicateMask, popcount, type Row, type Predicate } from './bitmapindex';

const COLS = ['color', 'size', 'region'];
const VALUES: Record<string, string[]> = { color: ['red', 'green', 'blue'], size: ['S', 'M', 'L'], region: ['US', 'EU', 'APAC'] };
const ROWS: Row[] = [
  { color: 'red', size: 'L', region: 'US' }, { color: 'blue', size: 'M', region: 'EU' }, { color: 'red', size: 'S', region: 'EU' },
  { color: 'green', size: 'L', region: 'US' }, { color: 'red', size: 'L', region: 'APAC' }, { color: 'blue', size: 'S', region: 'US' },
  { color: 'green', size: 'M', region: 'EU' }, { color: 'red', size: 'L', region: 'US' }, { color: 'blue', size: 'L', region: 'APAC' },
  { color: 'green', size: 'S', region: 'EU' }, { color: 'red', size: 'M', region: 'US' }, { color: 'blue', size: 'L', region: 'EU' },
];
const IDX = buildIndex(ROWS, COLS);
const N = ROWS.length;
const CLR: Record<string, string> = { red: '#cf4b4b', green: '#3fa060', blue: '#3b7dd8' };

const Bits = ({ mask, tone }: { mask: number; tone?: string }) => (
  <span className="bmi-bits">{Array.from({ length: N }, (_, i) => <span key={i} className={`bmi-bit ${(mask >> i) & 1 ? `on ${tone ?? ''}` : ''}`}>{(mask >> i) & 1}</span>)}</span>
);

export function BitmapIndexSection() {
  const [preds, setPreds] = useState<Predicate[]>([{ col: 'color', value: 'red' }, { col: 'size', value: 'L' }]);
  const [op, setOp] = useState<'AND' | 'OR'>('AND');

  const key = (p: Predicate) => `${p.col}=${p.value}`;
  const active = new Set(preds.map(key));
  const toggle = (col: string, value: string) => {
    const k = `${col}=${value}`;
    setPreds((ps) => active.has(k) ? ps.filter((p) => key(p) !== k) : [...ps, { col, value }]);
  };
  const toggleNeg = (i: number) => setPreds((ps) => ps.map((p, j) => j === i ? { ...p, negate: !p.negate } : p));

  const result = evalQuery(IDX, preds, op, N);
  const matched = (i: number) => (result >> i) & 1;

  return (
    <div className="bmi">
      <p className="bmi-intro">
        For columns with few distinct values, a database keeps one <strong>bitmap</strong> per value — a bit per
        row, set where that row matches. Then a <code>WHERE</code> clause is just <strong>bitwise arithmetic</strong>
        on those bitmaps: AND to intersect, OR to union, NOT to complement — 64 rows per CPU instruction, no
        non-matching row ever touched. Click values to build a query:
      </p>

      <div className="bmi-builder">
        {COLS.map((col) => (
          <div key={col} className="bmi-colgroup">
            <span className="bmi-colname">{col}</span>
            {VALUES[col].map((v) => <button key={v} type="button" className={`bmi-chip ${active.has(`${col}=${v}`) ? 'on' : ''}`} style={active.has(`${col}=${v}`) ? { borderColor: CLR[v] ?? 'var(--accent)' } : {}} onClick={() => toggle(col, v)}>{v}</button>)}
          </div>
        ))}
        <div className="bmi-op">
          <button type="button" className={`bmi-opbtn ${op === 'AND' ? 'on' : ''}`} onClick={() => setOp('AND')}>AND</button>
          <button type="button" className={`bmi-opbtn ${op === 'OR' ? 'on' : ''}`} onClick={() => setOp('OR')}>OR</button>
        </div>
      </div>

      <div className="bmi-eval">
        {preds.length === 0 && <div className="bmi-empty">no predicates — all {N} rows match</div>}
        {preds.map((p, i) => (
          <div key={i} className="bmi-erow">
            <button type="button" className={`bmi-plabel ${p.negate ? 'neg' : ''}`} onClick={() => toggleNeg(i)} title="toggle NOT">{p.negate ? 'NOT ' : ''}{p.col}={p.value}</button>
            <Bits mask={predicateMask(IDX, p, N)} />
          </div>
        ))}
        {preds.length > 0 && (
          <div className="bmi-erow result">
            <span className="bmi-plabel op">{op} =</span>
            <Bits mask={result} tone="res" />
            <span className="bmi-count">{popcount(result)} rows</span>
          </div>
        )}
      </div>

      <div className="bmi-table">
        <div className="bmi-thead"><span className="bmi-rid">#</span>{COLS.map((c) => <span key={c} className="bmi-th">{c}</span>)}</div>
        {ROWS.map((r, i) => (
          <div key={i} className={`bmi-tr ${matched(i) ? 'match' : ''}`}>
            <span className="bmi-rid">{i}</span>
            {COLS.map((c) => <span key={c} className="bmi-td"><span className="bmi-dot" style={{ background: CLR[r[c]] ?? 'var(--muted)' }} />{r[c]}</span>)}
          </div>
        ))}
      </div>

      <p className="bmi-foot">
        Why this beats a B-tree for analytics: a B-tree index answers "give me the rows where colour = red" as a
        <em> list</em> of row IDs, and to combine three such conditions you must fetch three lists and merge them.
        Bitmaps combine in the ALU — the intersection of a million-row red-bitmap and a million-row large-bitmap
        is a stream of ANDed machine words, cache-friendly and branch-free, and the answer is itself a bitmap you
        can feed into the next operation or <strong>popcount</strong> to get <code>COUNT(*)</code> for free.
        That's why they power OLAP engines and columnar stores. The trade-offs shape where you use them:
        cardinality (a bitmap per distinct value means a unique-ID column would need millions of bitmaps — bad,
        so bitmaps are for LOW-cardinality columns, sometimes "binned" for numeric ranges); and updates (changing
        one row's value flips bits in two bitmaps and, once compressed, can force a re-encode) — so they're built
        for read-mostly warehouses, not write-heavy OLTP. Sparsity is handled by compression:
        <strong> Roaring bitmaps</strong> store dense chunks as words and sparse chunks as sorted arrays, keeping
        the bitwise ops fast while shrinking the footprint. (O'Neil, Model 204, 1987.)
      </p>
    </div>
  );
}
