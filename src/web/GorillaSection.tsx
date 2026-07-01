// Gorilla compression, made visible. Pick a metric shape and watch how small it gets. Regular timestamps
// ride on delta-of-delta ≈ 0 (one bit each); repeated or near-repeated values XOR to almost nothing. A flat,
// regular series collapses to a couple of bits per point; a noisy one costs more but still beats the naive
// 128 bits (a 64-bit time + a 64-bit double). Real model from gorilla.ts (a true bit-level encode/decode).
import { useMemo, useState } from 'react';
import { ratio } from './gorilla';

const BASE = 1600000000;
type Shape = 'constant' | 'steady' | 'noisy';

function series(shape: Shape): { t: number; v: number }[] {
  let s = 7; const r = () => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s / 0x80000000; };
  let v = 64;
  return Array.from({ length: 240 }, (_, i) => {
    if (shape === 'constant') v = 64;
    else if (shape === 'steady') v = Math.round((v + (r() - 0.5) * 1.5) * 10) / 10;
    else v = Math.round(r() * 1000) / 10;
    return { t: BASE + i * 60, v };
  });
}

const SHAPES: { id: Shape; label: string; desc: string }[] = [
  { id: 'constant', label: 'constant', desc: 'a metric pinned at one value' },
  { id: 'steady', label: 'steady drift', desc: 'a slowly-wandering gauge (temp, memory)' },
  { id: 'noisy', label: 'noisy', desc: 'a value that jumps every sample' },
];

export function GorillaSection() {
  const [shape, setShape] = useState<Shape>('steady');
  const data = useMemo(() => series(shape), [shape]);
  const r = useMemo(() => ratio(data), [data]);

  // cheap-case counts
  const stats = useMemo(() => {
    let dodZero = 0, xorZero = 0;
    for (let i = 2; i < data.length; i++) if ((data[i].t - data[i - 1].t) === (data[i - 1].t - data[i - 2].t)) dodZero++;
    for (let i = 1; i < data.length; i++) if (data[i].v === data[i - 1].v) xorZero++;
    return { dodZero: (dodZero / (data.length - 2)) * 100, xorZero: (xorZero / (data.length - 1)) * 100 };
  }, [data]);

  const vals = data.map((d) => d.v);
  const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * 100},${30 - ((v - min) / span) * 28}`).join(' ');

  return (
    <div className="gor">
      <p className="gor-intro">
        A time series is a stream of <code>(timestamp, value)</code> points. Stored naively that's
        <strong> 128 bits each</strong> — a 64-bit time and a 64-bit double. Gorilla shrinks it with two ideas:
        <strong> delta-of-delta</strong> on the timestamps (regular intervals → 0 → one bit) and <strong>XOR</strong>
        on the values (unchanged or similar → almost no bits). Pick a shape:
      </p>

      <div className="gor-shapes">
        {SHAPES.map((sh) => (
          <button key={sh.id} type="button" className={`gor-shape ${shape === sh.id ? 'on' : ''}`} onClick={() => setShape(sh.id)}>
            <b>{sh.label}</b><span>{sh.desc}</span>
          </button>
        ))}
      </div>

      <div className="gor-spark">
        <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="gor-sparksvg"><polyline points={pts} /></svg>
        <span className="gor-sparklbl">{data.length} samples · every 60s</span>
      </div>

      <div className="gor-sizes">
        <div className="gor-sizerow"><span className="gor-slbl">naive (128 b/sample)</span><div className="gor-track"><div className="gor-fill naive" style={{ width: '100%' }} /></div><span className="gor-sval">{((data.length * 128) / 8 / 1024).toFixed(1)} KB</span></div>
        <div className="gor-sizerow"><span className="gor-slbl">Gorilla ({r.perSample.toFixed(1)} b/sample)</span><div className="gor-track"><div className="gor-fill gor" style={{ width: `${(r.perSample / 128) * 100}%` }} /></div><span className="gor-sval">{(r.bits / 8 / 1024).toFixed(2)} KB</span></div>
      </div>

      <div className="gor-stats">
        <div className="gor-stat big"><span>compression</span><b>{r.factor.toFixed(1)}×</b></div>
        <div className="gor-stat"><span>bits / sample</span><b>{r.perSample.toFixed(1)}</b></div>
        <div className="gor-stat"><span>timestamps: Δ-of-Δ = 0</span><b>{stats.dodZero.toFixed(0)}%</b></div>
        <div className="gor-stat"><span>values: XOR = 0 (repeat)</span><b>{stats.xorZero.toFixed(0)}%</b></div>
      </div>

      <p className="gor-foot">
        The timestamp trick is the big win in practice: production metrics are scraped on a fixed schedule, so
        the interval barely changes and delta-of-delta is 0 the vast majority of the time — <strong>one bit per
        timestamp</strong>. When a scrape is a second late, the small non-zero delta-of-delta still fits in ~7–12
        bits. The value trick shines when a gauge sits still or moves slowly: XOR-ing a double with a nearly-equal
        double zeroes out the sign, exponent, and high mantissa bits, leaving a short run in the middle that's
        stored with just its leading- and trailing-zero counts (and reused from the previous point when the run
        lines up). Facebook reported ~1.37 bytes per point on real data — a ~12× win that let Gorilla keep 26
        hours of metrics <em>in RAM</em>. It's lossless (we decode back to the exact doubles), which is why it
        underpins Prometheus's TSDB, InfluxDB, TimescaleDB, and M3. The limits: it assumes near-regular
        timestamps and slowly-changing values, so truly random data (like the "noisy" shape) barely compresses —
        which is fine, because real telemetry almost never looks like that. (Pelkonen et al., VLDB 2015.)
      </p>
    </div>
  );
}
