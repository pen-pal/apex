// Roaring bitmaps, made visible. Add scattered keys (sparse) or a dense block and watch each 65536-value chunk
// pick its own container: a small sorted ARRAY when sparse, a flat 8 KB BITMAP when dense. The memory bar
// compares Roaring against the two naive options it beats — a sorted uint32 array and a full 2^32 bitmap.
// Real model from roaring.ts.
import { useRef, useState } from 'react';
import { Roaring } from './roaring';

const fmtBytes = (b: number) => (b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`);

export function RoaringSection() {
  const rbRef = useRef<Roaring | null>(null);
  if (!rbRef.current) rbRef.current = new Roaring();
  const rb = rbRef.current;
  const [, setTick] = useState(0);
  const seedRef = useRef(12345);
  const denseRef = useRef(1);
  const bump = () => setTick((x) => x + 1);
  const rnd = (n: number) => { seedRef.current = (Math.imul(seedRef.current, 1103515245) + 12345) & 0x7fffffff; return seedRef.current % n; };

  const addSparse = () => { for (let i = 0; i < 24; i++) rb.add(rnd(400000)); bump(); };
  const addDense = () => { const base = denseRef.current++ * 65536; for (let i = 0; i < 9000; i++) rb.add(base + i); bump(); };
  const reset = () => { rbRef.current = new Roaring(); seedRef.current = 12345; denseRef.current = 1; bump(); };

  const containers = rb.containers();
  const card = rb.cardinality();
  const roaringBytes = containers.reduce((s, c) => s + c.bytes, 0) + containers.length * 4; // + a little map overhead
  const arrayBytes = card * 4;                 // naive sorted uint32 array
  const fullBitmap = 536870912;                // a flat 2^32 bitmap: always 512 MB
  const maxBar = Math.max(roaringBytes, arrayBytes, 1);

  return (
    <div className="roa">
      <p className="roa-intro">
        A set of integer IDs, split into <strong>chunks of 65536</strong>. Each chunk stores its members in the
        <strong> smallest</strong> container for its density — a sorted <span className="roa-k arr">array</span>
        when sparse, a flat 8 KB <span className="roa-k bmp">bitmap</span> when dense. Add some keys:
      </p>

      <div className="roa-controls">
        <button type="button" className="roa-btn arr" onClick={addSparse}>+ sparse scatter (24 keys)</button>
        <button type="button" className="roa-btn bmp" onClick={addDense}>+ dense block (9000 in a chunk)</button>
        <button type="button" className="roa-btn ghost" onClick={reset}>reset</button>
      </div>

      <div className="roa-stat">{card.toLocaleString()} keys across {containers.length} chunk{containers.length === 1 ? '' : 's'}</div>

      <div className="roa-chunks">
        {containers.length === 0 && <span className="roa-empty">empty — add some keys above</span>}
        {containers.map((c) => (
          <div key={c.chunk} className={`roa-chunk ${c.kind}`}>
            <div className="roa-chead"><span className="roa-cidx">chunk {c.chunk}</span><span className={`roa-cbadge ${c.kind}`}>{c.kind}</span></div>
            <div className="roa-cbar"><div className="roa-cfill" style={{ width: `${Math.min(100, (c.count / 65536) * 100)}%` }} /></div>
            <div className="roa-cmeta">{c.count.toLocaleString()} / 65536 · {fmtBytes(c.bytes)}</div>
          </div>
        ))}
      </div>

      {containers.length > 0 && (
        <div className="roa-mem">
          <div className="roa-mem-h">memory for these {card.toLocaleString()} keys</div>
          <div className="roa-mrow"><span className="roa-mlbl">Roaring</span><div className="roa-mtrack"><div className="roa-mfill win" style={{ width: `${(roaringBytes / maxBar) * 100}%` }} /></div><span className="roa-mval">{fmtBytes(roaringBytes)}</span></div>
          <div className="roa-mrow"><span className="roa-mlbl">sorted uint32[]</span><div className="roa-mtrack"><div className="roa-mfill" style={{ width: `${(arrayBytes / maxBar) * 100}%` }} /></div><span className="roa-mval">{fmtBytes(arrayBytes)}</span></div>
          <div className="roa-mrow"><span className="roa-mlbl">full 2³² bitmap</span><div className="roa-mtrack"><div className="roa-mfill full" style={{ width: '100%' }} /></div><span className="roa-mval">{fmtBytes(fullBitmap)}</span></div>
        </div>
      )}

      <p className="roa-foot">
        <strong>Each chunk decides independently</strong>. A chunk holding {'{'}5, 900, 60000{'}'}
        is 3 sorted 16-bit ints (6 bytes); a chunk holding 50,000 of its 65,536 values is a flat 8 KB bitmap — and
        Roaring flips a chunk from array to bitmap automatically once it passes ~4096 values (above that the array
        would cost more than the bitmap). Real Roaring adds a third <em>run</em> container for long consecutive
        spans (e.g. 1000–9000), storing just the run endpoints. Operations exploit the structure: to intersect
        two sets, only chunks present in <em>both</em> are examined, and within a chunk array∩array is a merge
        while bitmap∩bitmap is a word-parallel AND — so <code>A AND B</code> over billions of IDs touches only
        the overlapping chunks at cache speed. That's why it's the default posting-list/index format in
        Lucene/Elasticsearch, Druid, ClickHouse, and Spark. (Lemire et al., 2016.)
      </p>
    </div>
  );
}
