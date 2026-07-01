// Jump consistent hash, made visible. A grid of keys, each assigned to a bucket. Drag the bucket count and
// watch which keys have to MOVE when it grows by one. With jump hash, only a thin slice moves — and only onto
// the brand-new bucket, never between existing ones. Flip to plain "key % N" and almost every key jumps,
// reshuffling the whole dataset. The distribution bars stay even either way; it's the churn on resize that
// differs. Real model from jumphash.ts.
import { useMemo, useState } from 'react';
import { jumpHash, moduloHash, hashKey, movedFraction } from './jumphash';

const KEYS = Array.from({ length: 60 }, (_, i) => 'key' + i);
const KEYH = KEYS.map(hashKey);
const SAMPLE = Array.from({ length: 4000 }, (_, i) => hashKey('k' + i)); // for accurate percentages
const hue = (b: number, n: number) => `hsl(${Math.round((b / Math.max(1, n)) * 320)} 55% 50%)`;

export function JumpHashSection() {
  const [n, setN] = useState(6);
  const [mode, setMode] = useState<'jump' | 'mod'>('jump');
  const fn = mode === 'jump' ? jumpHash : moduloHash;

  const cells = KEYH.map((k) => ({ now: fn(k, n), prev: n > 1 ? fn(k, n - 1) : fn(k, n) }));
  const dist = useMemo(() => { const d = new Array(n).fill(0); for (const k of SAMPLE) d[fn(k, n)]++; return d; }, [n, mode]);

  const jMoved = n > 1 ? movedFraction(jumpHash, SAMPLE, n - 1) : 0;
  const mMoved = n > 1 ? movedFraction(moduloHash, SAMPLE, n - 1) : 0;
  const idealMove = 100 / n;

  return (
    <div className="jmp">
      <p className="jmp-intro">
        Each key must map to one of <strong>{n} shards</strong>. The hard part isn't the mapping — it's what
        happens when you <strong>add a shard</strong>. Drag the count and watch which keys move (highlighted).
        <strong> Jump hash</strong> moves the theoretical minimum; <strong>key % N</strong> reshuffles almost
        everything.
      </p>

      <div className="jmp-controls">
        <div className="jmp-modes">
          <button type="button" className={`jmp-mode ${mode === 'jump' ? 'on' : ''}`} onClick={() => setMode('jump')}>jump hash</button>
          <button type="button" className={`jmp-mode ${mode === 'mod' ? 'on' : ''}`} onClick={() => setMode('mod')}>key % N</button>
        </div>
        <label className="jmp-slider">buckets <b>{n}</b><input type="range" min={2} max={12} value={n} onChange={(e) => setN(+e.target.value)} /></label>
      </div>

      <div className="jmp-grid">
        {cells.map((c, i) => {
          const moved = c.now !== c.prev;
          return (
            <div key={i} className={`jmp-key ${moved ? 'moved' : ''}`} style={{ background: hue(c.now, n) }} title={`${KEYS[i]} → bucket ${c.now}${moved ? ` (moved from ${c.prev})` : ''}`}>{c.now}</div>
          );
        })}
      </div>

      <div className="jmp-dist">
        <div className="jmp-disth">shard load ({SAMPLE.length.toLocaleString()} keys)</div>
        <div className="jmp-bars">
          {dist.map((d, i) => (
            <div key={i} className="jmp-bar" style={{ height: `${(d / (SAMPLE.length / n)) * 50}%`, background: hue(i, n) }} title={`shard ${i}: ${d}`} />
          ))}
        </div>
      </div>

      <div className="jmp-stats">
        <div className={`jmp-stat ${mode === 'jump' ? 'good' : ''}`}><span>jump hash moved (→{n})</span><b>{(jMoved * 100).toFixed(1)}%</b></div>
        <div className={`jmp-stat ${mode === 'mod' ? 'bad' : ''}`}><span>key % N moved (→{n})</span><b>{(mMoved * 100).toFixed(1)}%</b></div>
        <div className="jmp-stat"><span>theoretical minimum</span><b>{idealMove.toFixed(1)}%</b></div>
      </div>

      <p className="jmp-foot">
        The invariant that makes it work: as N grows, jump hash only ever moves a key <em>onto the new top
        bucket</em> — a key never hops between two existing buckets — so the churn is exactly the ~1/N of keys
        that belong on the new shard, and no more. That's why resharding a cache or a database from N to N+1
        nodes with jump hash only relocates a thin slice, instead of the near-total remap that <code>key % N</code>
        forces (which would blow every cache and stream your whole dataset across the network). The tradeoff vs
        ring-based consistent hashing: jump hash's buckets are numbered 0..N-1, so it's perfect for growing or
        shrinking at the <em>end</em> (sharding by count) but can't cleanly remove an arbitrary middle node — for
        that you still want the hash ring, which pays a little memory to make any node removable. Same goal —
        minimal disruption — two different shapes of the problem. (Lamping &amp; Veach, 2014.)
      </p>
    </div>
  );
}
