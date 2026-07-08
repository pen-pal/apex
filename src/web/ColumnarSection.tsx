// Columnar encoding, made visible. Pick a column profile and watch raw → dictionary-encoded → +RLE byte sizes and the
// compression ratio. Sorted low-cardinality crushes; shuffled loses RLE; unique IDs defeat the dictionary. Model +
// tests in columnar.ts.
import { useMemo, useState } from 'react';
import { encode, ratio } from './columnar';

const rep = (parts: [string, number][]) => parts.flatMap(([v, k]) => Array<string>(k).fill(v));
const PRESETS: Record<string, { values: string[]; blurb: string }> = {
  'sorted category': { values: rep([['US', 300], ['UK', 300], ['FR', 250], ['DE', 150]]), blurb: 'a country column, sorted — 4 values in 4 long runs' },
  'shuffled category': { values: Array.from({ length: 1000 }, (_, i) => ['US', 'UK', 'FR', 'DE'][i % 4]), blurb: 'the same 4 values, interleaved — every row is its own run' },
  'unique ids': { values: Array.from({ length: 1000 }, (_, i) => 'id' + String(i).padStart(5, '0')), blurb: '1000 distinct primary keys — nothing repeats' },
};

export function ColumnarSection() {
  const [preset, setPreset] = useState('sorted category');
  const { values, blurb } = PRESETS[preset];
  const e = useMemo(() => encode(values), [values]);
  const max = Math.max(e.raw, e.dictTotal, e.rleTotal);
  const bars = [
    { label: 'raw (row store)', bytes: e.raw, cls: 'clm-raw', r: 1 },
    { label: 'dictionary', bytes: e.dictTotal, cls: 'clm-dict', r: ratio(e.raw, e.dictTotal) },
    { label: 'dictionary + RLE', bytes: e.rleTotal, cls: 'clm-rle', r: ratio(e.raw, e.rleTotal) },
  ];

  return (
    <div className="clm">
      <div className="clm-presets">
        <span className="clm-lbl">column</span>
        {Object.keys(PRESETS).map((k) => <button key={k} type="button" className={preset === k ? 'on' : ''} onClick={() => setPreset(k)}>{k}</button>)}
      </div>

      <div className="clm-col">
        <div className="clm-lbl">{blurb}</div>
        <div className="clm-cells">
          {values.slice(0, 20).map((v, i) => <span key={i} className="clm-cell">{v}</span>)}
          <span className="clm-more">… {e.n} rows</span>
        </div>
      </div>

      <div className="clm-bars">
        {bars.map((b) => (
          <div key={b.label} className="clm-bar-row">
            <span className="clm-bar-lbl">{b.label}</span>
            <div className="clm-track"><div className={`clm-bar ${b.cls}`} style={{ width: `${Math.max(2, (b.bytes / max) * 100)}%` }} /></div>
            <span className="clm-bytes">{b.bytes.toLocaleString()} B{b.r !== 1 && <em className={b.r >= 1 ? 'clm-win' : 'clm-lose'}> · {b.r >= 1 ? `${b.r.toFixed(b.r >= 10 ? 0 : 1)}×` : `${(1 / b.r).toFixed(1)}× bigger`}</em>}</span>
          </div>
        ))}
      </div>

      <div className="clm-stats">
        <div className="clm-stat"><b>{e.n.toLocaleString()}</b><span>rows</span></div>
        <div className="clm-stat"><b>{e.distinct.toLocaleString()}</b><span>distinct</span></div>
        <div className="clm-stat"><b>{e.codeBits}</b><span>bits / code</span></div>
        <div className="clm-stat"><b>{e.runs.toLocaleString()}</b><span>RLE runs</span></div>
      </div>

      <div className={`clm-verdict ${ratio(e.raw, e.rleTotal) >= 2 ? 'clm-good' : 'clm-bad'}`}>
        {preset === 'sorted category' && <>Four values in four runs: the dictionary shrinks each cell to {e.codeBits} bits, and RLE collapses the {e.n} codes to just {e.runs} (code, count) pairs — <b>{ratio(e.raw, e.rleTotal).toFixed(0)}×</b> smaller than the row bytes. This is why analytics engines sort by low-cardinality columns before writing.</>}
        {preset === 'shuffled category' && <>Same 4 distinct values, so the <b>dictionary</b> still wins ({ratio(e.raw, e.dictTotal).toFixed(1)}×) — but interleaving makes every row its own run, so <b>RLE</b> ({e.runs.toLocaleString()} runs) adds overhead instead of saving. Clustering, not just cardinality, decides whether RLE helps.</>}
        {preset === 'unique ids' && <>Every value is distinct, so the dictionary has to store all {e.n.toLocaleString()} of them — it’s <b>as big as the raw data</b> and RLE can’t find a single run. High-cardinality columns don’t dictionary-compress; you’d delta- or prefix-encode sorted keys instead.</>}
      </div>

      <p className="clm-foot">
        A row store keeps each record’s fields together, which is right when you read whole rows (OLTP). Analytics does
        the opposite — <code>SELECT avg(price) WHERE country='US'</code> touches two columns out of forty — so
        <strong> column stores</strong> (Parquet, ORC, Arrow, ClickHouse) keep each column contiguous: you read only the
        columns a query needs, and neighbouring values are alike, so they compress with cheap schemes that a CPU can
        decode vectorized. <strong>Dictionary</strong> encoding turns values into narrow integer codes;
        <strong> run-length</strong> encoding collapses sorted runs; real files stack these with bit-packing, delta, and
        Parquet’s per-page min/max stats for <em>predicate pushdown</em> (skip whole pages that can’t match). The catch is
        the mirror of this demo: point lookups and single-row writes get slower, which is the OLTP↔OLAP split.
        (Parquet/Arrow; C-Store / MonetDB lineage.)
      </p>
    </div>
  );
}
