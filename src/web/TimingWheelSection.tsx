// Timing wheel, made visible. A clock-face of buckets with a hand that advances one bucket per tick. Schedule a
// timer for "d ticks from now" and it drops straight into bucket (current + d) mod N — no sorting. Tick the hand
// around and watch timers fire when it reaches their bucket; timers more than one lap away carry a "rounds"
// counter that ticks down each pass. Real model from timingwheel.ts.
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { TimingWheel } from './timingwheel';

const N = 12;
const seed = (w: TimingWheel) => { w.add('A', 3); w.add('B', 7); w.add('C', 5); w.add('D', 16); };

export function TimingWheelSection() {
  const wheel = useMemo(() => { const w = new TimingWheel(N); seed(w); return w; }, []);
  const [, force] = useReducer((x) => x + 1, 0);
  const [delay, setDelay] = useState(5);
  const [log, setLog] = useState<{ id: string; at: number }[]>([]);
  const [playing, setPlaying] = useState(false);
  const nextId = useRef(0);

  const doTick = () => {
    const fired = wheel.tick();
    if (fired.length) setLog((l) => [...fired.map((f) => ({ id: f.id, at: wheel.time })), ...l].slice(0, 10));
    force();
  };
  const doAdd = () => { wheel.add('T' + (nextId.current++ % 100), delay); force(); };
  const reset = () => { for (const b of wheel.slots) b.length = 0; wheel.current = 0; wheel.time = 0; seed(wheel); setLog([]); setPlaying(false); force(); };

  useEffect(() => {
    if (!playing) return;
    const iv = setTimeout(doTick, 650);
    return () => clearTimeout(iv);
  }, [playing, wheel.time]);

  // circular geometry
  const cx = 150, cy = 150, R = 112;
  const pt = (i: number, r = R) => { const a = (-90 + (360 * i) / N) * (Math.PI / 180); return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
  const [hx, hy] = pt(wheel.current, R - 18);
  const pending = wheel.pending().filter((b) => b.timers.length);

  return (
    <div className="twl">
      <p className="twl-intro">
        A circular array of buckets and a hand that advances one bucket per tick. To schedule a timer for
        <strong> d ticks from now</strong>, you don't sort anything — you drop it into bucket
        <code> (current + d) mod {N}</code>. Every tick the hand moves on and fires that bucket's due timers.
        Insert, cancel, and expiry are all <strong>O(1)</strong>. Schedule some and tick the hand:
      </p>

      <div className="twl-main">
        <svg viewBox="0 0 300 300" className="twl-svg">
          <circle cx={cx} cy={cy} r={R} className="twl-ring" />
          <line x1={cx} y1={cy} x2={hx} y2={hy} className="twl-hand" />
          <circle cx={cx} cy={cy} r={4} className="twl-hub" />
          <text x={cx} y={cy + 44} className="twl-time" textAnchor="middle">t = {wheel.time}</text>
          {Array.from({ length: N }, (_, i) => {
            const [x, y] = pt(i);
            const [lx, ly] = pt(i, R + 20);
            const count = wheel.slots[i].length;
            const isCur = i === wheel.current;
            return (
              <g key={i}>
                <circle cx={x} cy={y} r={isCur ? 13 : 10} className={`twl-bucket ${isCur ? 'cur' : ''} ${count ? 'full' : ''}`} />
                {count > 0 && <text x={x} y={y + 3.5} className="twl-bcount" textAnchor="middle">{count}</text>}
                <text x={lx} y={ly + 3} className="twl-blabel" textAnchor="middle">{i}</text>
              </g>
            );
          })}
        </svg>

        <div className="twl-side">
          <div className="twl-controls">
            <label className="twl-df">fire in<input type="number" min={1} max={40} value={delay} onChange={(e) => setDelay(+e.target.value)} />ticks</label>
            <button type="button" className="twl-add" onClick={doAdd}>+ schedule</button>
          </div>
          <div className="twl-tickrow">
            <button type="button" className="twl-tick" onClick={() => { setPlaying(false); doTick(); }}>tick ▸</button>
            <button type="button" className="twl-play" onClick={() => setPlaying((p) => !p)}>{playing ? '⏸ pause' : '▶ play'}</button>
            <button type="button" className="twl-reset" onClick={reset}>reset</button>
          </div>
          <div className="twl-pending">
            <div className="twl-plabel">pending ({pending.reduce((a, b) => a + b.timers.length, 0)})</div>
            <div className="twl-plist">
              {pending.map((b) => b.timers.map((t) => (
                <span key={t.id} className={`twl-timer ${t.rounds > 0 ? 'rounds' : ''}`} title={`fires at t=${t.fireAt}`}>
                  {t.id}<i>b{b.bucket}{t.rounds > 0 ? ` · ${t.rounds}↻` : ''}</i>
                </span>
              )))}
              {!pending.length && <span className="twl-empty">none — schedule one</span>}
            </div>
          </div>
          <div className="twl-log">
            <div className="twl-plabel">fired</div>
            {log.length ? log.map((e, i) => <span key={i} className="twl-fired">🔔 {e.id} @ t={e.at}</span>) : <span className="twl-empty">nothing yet</span>}
          </div>
        </div>
      </div>

      <p className="twl-foot">
        The win over a heap is that the per-tick cost doesn't depend on how many timers you're holding — a bucket
        is just a list, so dropping a timer in, pulling it out, or cancelling it is a pointer operation, not a
        O(log n) sift. That's exactly the profile of network servers, which arm a timeout for every one of
        millions of in-flight requests and disarm most of them before they ever fire. The single-wheel design
        here trades space for range: to cover delays up to D ticks at tick resolution you either need D buckets
        or the <strong>rounds</strong> trick shown here (fewer buckets, but a bucket may hold not-yet-due timers
        the hand keeps skipping). <strong>Hierarchical</strong> timing wheels remove that skipping by cascading
        into coarser wheels — a seconds wheel, a minutes wheel, an hours wheel — and when the minutes hand ticks,
        it re-inserts that minute's timers down into the seconds wheel, exactly like gears in a clock. Kafka's
        delay queues, Netty's HashedWheelTimer, and the kernel's timer subsystem all use variants of this. The
        trade-off vs a heap: O(1) operations and great cache behaviour, but coarser resolution and wasted work if
        timers cluster. (Varghese &amp; Lauck, 1987.)
      </p>
    </div>
  );
}
