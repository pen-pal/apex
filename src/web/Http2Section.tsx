// HTTP/2 multiplexing, made visible. Several requests share one TCP connection.
// Toggle between HTTP/1.1 (serial — a big response blocks everything behind it)
// and HTTP/2 (frames from every stream interleave), and watch the short requests
// stop waiting. The scheduling math is real (see http2.ts).
import { useEffect, useMemo, useState } from 'react';
import { scheduleHttp11, scheduleHttp2, avgFinish, type Stream } from './http2';

const DEFAULTS: Stream[] = [
  { id: 1, label: 'app.js', frames: 6 },
  { id: 3, label: 'logo.png', frames: 1 },
  { id: 5, label: 'style.css', frames: 2 },
  { id: 7, label: 'api.json', frames: 3 },
];
const hue = (i: number) => [212, 28, 145, 280, 0, 190][i % 6];
const color = (i: number) => `hsl(${hue(i)} 65% 60%)`;

export function Http2Section() {
  const [streams, setStreams] = useState<Stream[]>(DEFAULTS.map((s) => ({ ...s })));
  const [mode, setMode] = useState<'h11' | 'h2'>('h2');
  const [step, setStep] = useState(99);
  const [playing, setPlaying] = useState(false);

  const idx = useMemo(() => Object.fromEntries(streams.map((s, i) => [s.id, i])), [streams]);
  const h11 = useMemo(() => scheduleHttp11(streams), [streams]);
  const h2 = useMemo(() => scheduleHttp2(streams), [streams]);
  const sched = mode === 'h2' ? h2 : h11;
  const total = sched.totalSlots;

  useEffect(() => { setStep(total); }, [mode, total]);
  useEffect(() => {
    if (!playing) return;
    if (step >= total) { setPlaying(false); return; }
    const id = setTimeout(() => setStep((s) => Math.min(s + 1, total)), 320);
    return () => clearTimeout(id);
  }, [playing, step, total]);

  const shown = sched.ticks.slice(0, step);
  // map slot -> streamId for the revealed timeline
  const slotOf: Record<number, number> = {};
  for (const t of shown) slotOf[t.t] = t.streamId;

  const bump = (id: number, d: number) => { setStreams((ss) => ss.map((s) => (s.id === id ? { ...s, frames: Math.max(1, Math.min(9, s.frames + d)) } : s))); setStep(99); };

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>HTTP/2 multiplexing — one connection, many streams</h2></div>
        <p className="jsec-sub">
          HTTP/1.1 sends one response at a time per connection, so a big file <strong>head-of-line blocks</strong> the
          small ones queued behind it. HTTP/2 splits every response into frames and <strong>interleaves</strong> them on
          a single connection, so short requests finish early. Same bytes, much snappier page. Toggle and watch.
        </p>

        <div className="h2-controls">
          <div className="seg">
            <button className={mode === 'h11' ? 'on' : ''} onClick={() => setMode('h11')}>HTTP/1.1 (serial)</button>
            <button className={mode === 'h2' ? 'on' : ''} onClick={() => setMode('h2')}>HTTP/2 (multiplexed)</button>
          </div>
          <div className="h2-play">
            <button className="ghost small" onClick={() => { setStep(0); setPlaying(false); }}>⏮</button>
            <button className="ghost small" onClick={() => { if (step >= total) setStep(0); setPlaying((p) => !p); }}>{playing ? '⏸' : '▶ animate'}</button>
            <button className="ghost small" onClick={() => { setStep(total); setPlaying(false); }}>show all</button>
          </div>
        </div>

        {/* the shared connection wire (transmission order) */}
        <div className="h2-wire-label">the single TCP connection (frame transmission order →)</div>
        <div className="h2-wire">
          {Array.from({ length: total }, (_, t) => {
            const sid = slotOf[t];
            return <span key={t} className="h2-frame" style={{ background: sid != null ? color(idx[sid]) : 'transparent', borderStyle: sid != null ? 'solid' : 'dashed' }}>{sid != null ? sid : ''}</span>;
          })}
        </div>

        {/* per-stream lanes */}
        <div className="h2-lanes">
          {streams.map((s, i) => {
            const fin = sched.finish[s.id];
            const done = step >= fin;
            return (
              <div className="h2-lane" key={s.id}>
                <div className="h2-lane-head">
                  <span className="h2-dot" style={{ background: color(i) }} />
                  <span className="h2-name">stream {s.id} · {s.label}</span>
                  <span className="h2-frames">
                    <button onClick={() => bump(s.id, -1)}>−</button>{s.frames}f<button onClick={() => bump(s.id, 1)}>+</button>
                  </span>
                  <span className={`h2-fin ${done ? 'done' : ''}`}>{done ? `✓ done @ slot ${fin}` : `…`}</span>
                </div>
                <div className="h2-track">
                  {Array.from({ length: total }, (_, t) => {
                    const here = slotOf[t] === s.id;
                    return <span key={t} className="h2-cell" style={here ? { background: color(i) } : undefined} />;
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="h2-stats">
          <div className={`h2-stat ${mode === 'h11' ? 'on' : ''}`}>
            <span>HTTP/1.1</span><strong>avg {avgFinish(h11, streams).toFixed(1)}</strong><em>slots to finish</em>
          </div>
          <div className={`h2-stat ${mode === 'h2' ? 'on' : ''}`}>
            <span>HTTP/2</span><strong>avg {avgFinish(h2, streams).toFixed(1)}</strong><em>slots to finish</em>
          </div>
          <div className="h2-win">
            ↓ {Math.round((1 - avgFinish(h2, streams) / avgFinish(h11, streams)) * 100)}% lower average completion — the last byte arrives at the same time ({h2.lastFinish} slots), but most resources land sooner.
          </div>
        </div>
        <p className="enc-note">HTTP/2 removes <em>application-layer</em> head-of-line blocking, but all streams still ride one TCP
          stream — so a single lost packet stalls every stream at the transport layer. That residual blocking is exactly what QUIC (HTTP/3)
          fixes by giving each stream its own delivery.</p>
      </section>
    </div>
  );
}
