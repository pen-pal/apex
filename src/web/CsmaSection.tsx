// 802.11 CSMA/CA, made visible. Several stations want the same channel. Each picks
// a random backoff and counts down only while the air is idle; whoever hits 0 first
// transmits and gets an ACK. Two reaching 0 together collide — both double their
// contention window and try again. Watch the backoff counters tick, collisions flash,
// and the window grow under load. Real CSMA/CA, deterministic (see csma.ts).
import { useEffect, useMemo, useState } from 'react';
import { simulateCsma, CW_MIN } from './csma';

const SLOTS = 60;

export function CsmaSection() {
  const [n, setN] = useState(4);
  const [seed, setSeed] = useState(3);
  const [step, setStep] = useState(SLOTS);
  const [playing, setPlaying] = useState(false);

  const sim = useMemo(() => simulateCsma(n, SLOTS, seed), [n, seed]);
  useEffect(() => { setStep(SLOTS); }, [n, seed]);
  useEffect(() => {
    if (!playing) return;
    if (step >= SLOTS) { setPlaying(false); return; }
    const id = setTimeout(() => setStep((s) => Math.min(s + 1, SLOTS)), 280);
    return () => clearTimeout(id);
  }, [playing, step]);

  const cur = sim.timeline[Math.min(step, SLOTS) - 1] ?? sim.timeline[0];
  const shown = sim.timeline.slice(0, step);
  const txTotal = shown.filter((e) => e.kind === 'transmit').length;
  const colTotal = shown.filter((e) => e.kind === 'collision').length;

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>WiFi CSMA/CA — sharing the air without collisions</h2></div>
        <p className="jsec-sub">
          Wireless is half-duplex and has no collision <em>detection</em> — so 802.11 avoids them. A station with a frame
          waits for the channel to go idle, picks a random <strong>backoff</strong>, and counts down one slot at a time
          (freezing while someone else sends). The first to reach 0 transmits and gets an <strong>ACK</strong>. If two
          tie, they <strong>collide</strong>, double their contention window, and retry. Step through it.
        </p>

        <div className="csma-controls">
          <label>stations: {n}<input type="range" min={2} max={10} value={n} onChange={(e) => setN(+e.target.value)} /></label>
          <button className="ghost small" onClick={() => setSeed((s) => s + 1)}>🔀 reshuffle</button>
          <div className="csma-play">
            <button className="ghost small" onClick={() => { setStep(1); setPlaying(false); }}>⏮</button>
            <button className="ghost small" disabled={step >= SLOTS} onClick={() => { setStep((s) => Math.min(SLOTS, s + 1)); setPlaying(false); }}>slot →</button>
            <button className="ghost small" onClick={() => { if (step >= SLOTS) setStep(1); setPlaying((p) => !p); }}>{playing ? '⏸' : '▶'}</button>
            <button className="ghost small" onClick={() => { setStep(SLOTS); setPlaying(false); }}>all</button>
          </div>
        </div>

        <div className={`csma-channel ${cur.kind}`}>
          slot {Math.min(step, SLOTS)}: {cur.kind === 'idle' ? 'channel IDLE — everyone counts down' : cur.kind === 'transmit' ? `📡 station ${cur.station} transmitting → ACK ✓` : `💥 COLLISION: stations ${cur.stations.join(' & ')} → no ACK, double CW`}
        </div>

        <div className="csma-stations">
          {Array.from({ length: n }, (_, i) => {
            const bo = cur.backoffs[i];
            const cw = cur.cws[i];
            const tx = cur.kind === 'transmit' && cur.station === i;
            const col = cur.kind === 'collision' && cur.stations.includes(i);
            const st = sim.stations[i];
            return (
              <div key={i} className={`csma-st ${tx ? 'tx' : ''} ${col ? 'col' : ''}`}>
                <span className="csma-st-name">STA {i}</span>
                <span className="csma-backoff">{tx ? '▶ TX' : col ? '💥' : `backoff ${bo}`}</span>
                <span className="csma-cw">CW {cw}{cw > CW_MIN ? ' ↑' : ''}</span>
                <span className="csma-sent">{st.sent} sent · {st.collisions} coll</span>
              </div>
            );
          })}
        </div>

        <div className="csma-tl-label">channel timeline (each cell = one slot)</div>
        <div className="csma-timeline">
          {sim.timeline.map((e, i) => (
            <span key={i} className={`csma-slot ${e.kind} ${i < step ? 'on' : ''}`} title={`slot ${i + 1}: ${e.kind}`}>
              {i < step ? (e.kind === 'transmit' ? e.station : e.kind === 'collision' ? '✕' : '') : ''}
            </span>
          ))}
        </div>
        <div className="csma-stats">over {step} slots: <strong>{txTotal}</strong> successful frames · <strong>{colTotal}</strong> collisions{step > 0 && ` · ${Math.round((txTotal / step) * 100)}% channel efficiency`}</div>
        <p className="enc-note">Notice the trade-off: more stations → more ties → more collisions → bigger backoffs → idle slots wasted waiting. That’s why
          WiFi throughput collapses as a cell gets crowded, long before the “link speed” is the limit. RTS/CTS (a tiny reservation handshake) helps with
          hidden nodes that can’t hear each other but can both reach the AP.</p>
      </section>
    </div>
  );
}
