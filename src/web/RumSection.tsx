// The RUM conjecture, made visible. Three storage engines, three amplifications — read, write (update),
// and space (memory). Drag the dataset size and the LSM size ratio and watch each engine optimize two
// dimensions while a third blows up: the B-tree keeps reads cheap, leveled-LSM keeps space tight (but
// rewrites data many times), tiered-LSM keeps writes cheap (but reads probe many runs). You can't win
// all three. Analytical model from rum.ts.
import { useMemo, useState } from 'react';
import { amplification, sacrifices, type Amp } from './rum';

const DIMS = [['read', 'read amp'], ['write', 'write amp'], ['space', 'space amp']] as const;
const ENGINES = [['btree', 'B-tree'], ['leveled', 'Leveled LSM'], ['tiered', 'Tiered LSM']] as const;
const fmt = (n: number) => (Number.isInteger(n) ? n.toString() : n.toFixed(1));

export function RumSection() {
  const [logN, setLogN] = useState(6); // 10^6 rows
  const [T, setT] = useState(10);
  const N = 10 ** logN;
  const r = useMemo(() => amplification(N, T, 100), [N, T]);
  const engines: Record<string, Amp> = { btree: r.btree, leveled: r.leveled, tiered: r.tiered };
  const dimMax = (d: keyof Amp) => Math.max(...ENGINES.map(([k]) => engines[k][d]));

  return (
    <div className="rum">
      <div className="rum-controls">
        <label>dataset size N <input type="range" min={3} max={9} value={logN} onChange={(e) => setLogN(+e.target.value)} /><b>10^{logN} = {N.toLocaleString('en-US')}</b></label>
        <label>LSM size ratio T <input type="range" min={2} max={20} value={T} onChange={(e) => setT(+e.target.value)} /><b>{T}</b></label>
        <span className="rum-meta">LSM levels ≈ log_T(N) = <b>{r.levels}</b> · B-tree height = <b>{r.btreeHeight}</b></span>
      </div>

      <div className="rum-cards">
        {ENGINES.map(([key, label]) => {
          const amp = engines[key];
          const sac = sacrifices(amp);
          return (
            <div key={key} className="rum-card">
              <div className="rum-card-h">{label}<span className={`rum-sac ${key === 'btree' ? 'ok' : ''}`}>{key === 'btree' ? 'read-optimized' : `sacrifices ${sac}`}</span></div>
              {DIMS.map(([d, dl]) => {
                const v = amp[d];
                const worst = d === sac && key !== 'btree';
                return (
                  <div key={d} className="rum-dim">
                    <span className="rum-dl">{dl}</span>
                    <div className="rum-bar"><div className={`rum-fill ${worst ? 'bad' : ''}`} style={{ width: `${(v / dimMax(d)) * 100}%` }} /></div>
                    <span className={`rum-val ${worst ? 'bad' : ''}`}>{fmt(v)}×</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <p className="rum-foot">
        Every access method picks two corners of the triangle and pays on the third. <strong>B-trees</strong> read in a few page hops and waste
        little space, but random in-place updates are expensive at scale. <strong>Leveled LSM</strong> (RocksDB default) compacts eagerly into one
        run per level — almost no space overhead — but each record is rewritten ~T times per level, so write amplification soars.
        <strong> Tiered LSM</strong> (Cassandra-style) lets runs pile up — cheap writes — but a lookup must probe up to T runs per level and the
        same key can sit in many runs, inflating reads and space. Tuning T (and adding <em>bloom filters</em> to erase most LSM read amp, the
        Monkey result) is how you slide along the tradeoff for a given workload. These are the standard analytical amplifications, not measurements.
        (Athanassoulis et al., the RUM Conjecture, EDBT 2016.)
      </p>
    </div>
  );
}
