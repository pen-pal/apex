// Stream watermarks, made visible. Events arrive out of order (top ribbon = arrival order). Step through
// them and watch the WATERMARK line sweep right across the event-time axis: it's max-seen-time minus the
// lateness slack. The moment it passes a window's right edge, that window FIRES its aggregate. An event
// that lands after its window already elapsed is LATE — struck out and dropped. Crank the lateness slider
// to trade latency for tolerance of stragglers. Real model from watermark.ts.
import { useMemo, useState } from 'react';
import { processStream, type Ev } from './watermark';

const WINDOW = 10;
const MAXT = 30; // event-time axis 0..30 → three windows
// Arrival order is deliberately jumbled vs event-time.
const EVENTS: Ev[] = [
  { id: 'A', time: 1 }, { id: 'B', time: 3 }, { id: 'C', time: 12 },
  { id: 'D', time: 7 }, { id: 'E', time: 25 }, { id: 'F', time: 6 }, { id: 'G', time: 18 },
];
const pct = (t: number) => `${(t / MAXT) * 100}%`;

export function WatermarkSection() {
  const [lateness, setLateness] = useState(2);
  const [si, setSi] = useState(0); // step = arrival index revealed so far — start at the first

  const result = useMemo(() => processStream(EVENTS, WINDOW, lateness), [lateness]);
  const view = useMemo(() => {
    const steps = result.steps.slice(0, si + 1);
    const wm = si >= 0 ? result.steps[si].watermark : -Infinity;
    const firedStarts = new Set<number>(steps.flatMap((s) => s.fired));
    const lateSoFar = new Set(steps.filter((s) => s.late).map((s) => s.id));
    const arrived = new Set(EVENTS.slice(0, si + 1).map((e) => e.id));
    return { wm, firedStarts, lateSoFar, arrived };
  }, [result, si]);

  const windowsByStart = useMemo(() => new Map(result.windows.map((w) => [w.start, w])), [result]);

  return (
    <div className="wm">
      <p className="wm-intro">
        A streaming engine sees events <strong>out of order</strong>. A <strong>watermark</strong> is its
        promise — "I've seen everything up to time W" — computed as <code>max event-time − allowed lateness</code>.
        A time <strong>window</strong> fires the instant the watermark passes its end; an event that shows up
        after that is <strong>late</strong> and dropped. Step the arrivals and watch it play out.
      </p>

      <div className="wm-controls">
        <div className="wm-arrivals">
          <span className="wm-clbl">arrivals →</span>
          {EVENTS.map((e, i) => (
            <button key={e.id} type="button" className={`wm-chip ${i <= si ? 'in' : ''} ${i === si ? 'cur' : ''} ${view.lateSoFar.has(e.id) ? 'late' : ''}`} onClick={() => setSi(i)}>
              {e.id}<i>@{e.time}</i>
            </button>
          ))}
        </div>
        <label className="wm-late">allowed lateness <input type="range" min={0} max={8} value={lateness} onChange={(e) => setLateness(+e.target.value)} /><b>{lateness}</b></label>
      </div>

      <div className="wm-timeline">
        <div className="wm-axis-lbl">event-time →</div>
        <div className="wm-track">
          {/* window bands */}
          {Array.from({ length: MAXT / WINDOW }, (_, k) => {
            const start = k * WINDOW;
            const w = windowsByStart.get(start);
            const fired = view.firedStarts.has(start);
            return (
              <div key={start} className={`wm-win ${fired ? 'fired' : ''}`} style={{ left: pct(start), width: pct(WINDOW) }}>
                <span className="wm-win-lbl">[{start},{start + WINDOW})</span>
                {fired && <span className="wm-win-fire">▸ fired ({w?.events.join(',') || '∅'})</span>}
              </div>
            );
          })}
          {/* events */}
          {EVENTS.map((e) => {
            const arrived = view.arrived.has(e.id);
            const late = view.lateSoFar.has(e.id);
            return (
              <div key={e.id} className={`wm-ev ${arrived ? 'on' : 'off'} ${late ? 'late' : ''}`} style={{ left: pct(e.time) }} title={`${e.id} @ event-time ${e.time}`}>
                <span className="wm-ev-dot" />
                <span className="wm-ev-id">{e.id}</span>
              </div>
            );
          })}
          {/* watermark line */}
          {view.wm > -Infinity && view.wm >= 0 && (
            <div className="wm-line" style={{ left: pct(Math.min(view.wm, MAXT)) }}>
              <span className="wm-line-lbl">watermark {view.wm}</span>
            </div>
          )}
        </div>
        <div className="wm-axis">{Array.from({ length: MAXT / WINDOW + 1 }, (_, k) => <span key={k} style={{ left: pct(k * WINDOW) }}>{k * WINDOW}</span>)}</div>
      </div>

      <div className="wm-tally">
        <div className="wm-stat ok"><span>windows fired</span><b>{view.firedStarts.size}</b></div>
        <div className="wm-stat bad"><span>late / dropped</span><b>{view.lateSoFar.size}</b></div>
        <div className="wm-stat"><span>watermark</span><b>{view.wm > -Infinity ? view.wm : '—'}</b></div>
      </div>

      <p className="wm-foot">
        This is the <strong>event-time vs processing-time</strong> distinction at the heart of correct
        streaming. Lateness is a dial: <strong>more</strong> lateness waits longer so stragglers still count
        (higher latency, fewer drops); <strong>zero</strong> fires eagerly and drops anything tardy. Production
        engines add <strong>allowed-lateness with late firings</strong> (re-emit an updated result when a late
        event arrives), route drops to a <strong>side output</strong> instead of discarding, and derive the
        watermark per-partition (e.g. bounded-out-of-orderness, or the min across Kafka partitions). Windows
        here are <strong>tumbling</strong>; sliding and session windows reuse the same watermark machinery.
        (Akidau et al., the Dataflow Model, VLDB 2015; Apache Flink.)
      </p>
    </div>
  );
}
