// Mix networks — why anonymity systems add DELAY that Tor won't. A mix batches messages, peels a layer off each,
// and releases them shuffled, so an observer watching the mix can't tell which output was which input better than
// 1-in-N. Drag the batch size and watch the anonymity set — and the observer's link odds — move. Reveal the true
// wiring to see what the eavesdropper can't. Real model + property tests in mixnet.ts. (Chaum 1981.)
import { useEffect, useMemo, useState } from 'react';
import { makeMsg, mixBatch, linkProbability } from './mixnet';

const LAYERS = 3;

export function MixnetSection() {
  const [n, setN] = useState(6);
  const [reveal, setReveal] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [cycle, setCycle] = useState(0);

  // Auto-reshuffle on a gentle loop (cinematic) — a fresh batch flushes with a new permutation each tick.
  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => setCycle((c) => c + 1), 2600);
    return () => clearTimeout(t);
  }, [playing, cycle, n]);

  const inputs = useMemo(() => Array.from({ length: n }, (_, i) => makeMsg(i, LAYERS)), [n]);
  const { outputs, perm } = useMemo(() => mixBatch(inputs, cycle * 101 + n), [inputs, cycle, n]);
  const p = linkProbability(n);
  const y = (i: number) => ((i + 0.5) / n) * 100;

  return (
    <div className="mx">
      <div className="mx-controls">
        <label className="mx-slider">
          <span>batch size&nbsp;<b>N = {n}</b></span>
          <input type="range" min={1} max={10} value={n} onChange={(e) => setN(+e.target.value)} />
        </label>
        <button type="button" className={`mx-toggle ${reveal ? 'on' : ''}`} onClick={() => setReveal((r) => !r)}>
          {reveal ? '● showing true wiring' : '○ reveal true wiring'}
        </button>
        <button type="button" className="mx-play" onClick={() => setPlaying((x) => !x)}>{playing ? '❚❚ pause' : '▶ play'}</button>
      </div>

      <div className="mx-stage">
        <div className="mx-heads"><span>arriving</span><span>hold, peel, shuffle</span><span>released, shuffled</span></div>
        <div className="mx-rows">
          <div className="mx-col mx-in">
            {inputs.map((m) => (
              <div key={m.id} className="mx-msg" style={{ '--hue': `${(m.id * 47) % 360}` } as React.CSSProperties}>
                <span className="mx-msg-dot" /><code>{m.wire}</code>
              </div>
            ))}
          </div>

          <svg className="mx-wires" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {outputs.map((_, k) => {
              const src = perm[k];
              return <line key={k} x1="0" y1={y(src)} x2="100" y2={y(k)}
                className={`mx-wire ${reveal ? 'shown' : ''}`} style={{ stroke: `hsl(${(inputs[src].id * 47) % 360} 60% 55%)` }} />;
            })}
          </svg>

          <div className="mx-col mx-out">
            {outputs.map((m, k) => (
              <div key={k} className="mx-msg" style={{ '--hue': `${reveal ? (m.id * 47) % 360 : 220}` } as React.CSSProperties}>
                <code>{m.wire}</code><span className="mx-msg-dot" />
              </div>
            ))}
          </div>

          <div className="mx-mixbox"><span>MIX</span><small>hold {n} · shuffle</small></div>
        </div>
      </div>

      <div className={`mx-metric ${n === 1 ? 'broken' : ''}`}>
        <div className="mx-metric-big">{n === 1 ? '100%' : `1 / ${n} = ${(p * 100).toFixed(n > 3 ? 1 : 0)}%`}</div>
        <div className="mx-metric-txt">
          {n === 1 ? (
            <><strong>N = 1 is no anonymity.</strong> One message in, one out — the observer links it with certainty.
            That's effectively immediate forwarding, the case a low-latency onion hop can't escape under timing analysis.</>
          ) : (
            <>An eavesdropper watching this mix links any given message to its sender with probability <strong>1/{n}</strong>.
            The bytes changed (each layer re-encrypts, so content can't be followed) and the order was scrambled — only
            <em> batching</em> hides the timing. Bigger batches hide better; they just cost more waiting.</>
          )}
        </div>
      </div>

      <p className="mx-foot">
        This is the classic trade-off. <strong>Tor</strong> optimises for latency and forwards immediately, which is
        why a global adversary who sees both ends can correlate flows. A <strong>mix network</strong> optimises for
        unlinkability by adding <strong>delay + reordering</strong> (and usually <strong>cover traffic</strong> so even
        the counts leak nothing), at the price of latency — fine for email-like messaging, not for a live web page.
        Chain several mixes and no single one knows both ends. (Chaum 1981; Mixminion, Sphinx, and Loopix are the
        modern lineage.)
      </p>
    </div>
  );
}
