// Chandy-Lamport global snapshot, made visible. Two bank accounts (P0, P1) move money over FIFO
// channels; a marker sweep records a *consistent* global state with no global clock. Step through
// and watch the snapshot capture not just the account balances but the money caught IN FLIGHT in a
// channel — without which the recorded total wouldn't balance. All state comes from chandy.ts (tested).
import { useEffect, useState } from 'react';
import { run, CLASSIC, type ChItem } from './chandy';

const R = run(CLASSIC);
const PROCS = CLASSIC.processes.map((p) => p.id);
const CHANS = CLASSIC.channels.map(([f, t]) => `${f}->${t}`);

function Chip({ item }: { item: ChItem }) {
  return item.kind === 'marker'
    ? <span className="cl-item marker" title="snapshot marker">◈ marker</span>
    : <span className="cl-item money" title="money in flight">${item.amount}</span>;
}

export function ChandySection() {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const step = R.steps[i];
  const last = R.steps.length - 1;

  useEffect(() => {
    if (!playing) return;
    if (i >= last) { setPlaying(false); return; }
    const id = setInterval(() => setI((x) => Math.min(last, x + 1)), 1100);
    return () => clearInterval(id);
  }, [playing, i, last]);

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Chandy-Lamport — photographing a distributed system</h2></div>
        <p className="jsec-sub">
          How do you record the global state of a distributed system with no shared clock, without stopping the world? You can’t read
          every process and every in-flight message at one instant. Chandy-Lamport (1985) gets a <strong>consistent</strong> cut — a state
          that <em>could</em> have happened — using <strong>marker</strong> messages over FIFO channels. We frame it as a bank: money moves
          between two accounts, and the snapshot must capture the money <strong>in flight</strong> in the channels, or the books won’t balance.
        </p>

        <div className="cl-procs">
          {PROCS.map((p) => (
            <div key={p} className={`cl-proc ${step.recorded[p] ? 'rec' : ''}`}>
              <div className="cl-pname">{p}</div>
              <div className="cl-bal">${step.balances[p]}</div>
              <div className="cl-recbadge">{step.recorded[p] ? `recorded $${step.recordedBalance[p]}` : 'not yet recorded'}</div>
            </div>
          ))}
        </div>

        <div className="cl-chans">
          {CHANS.map((c) => (
            <div key={c} className="cl-chan">
              <span className="cl-clabel">{c.replace('->', ' → ')}</span>
              <div className="cl-wire">
                {step.queues[c].length === 0
                  ? <span className="cl-empty">— empty —</span>
                  : step.queues[c].map((it, k) => <Chip key={k} item={it} />)}
              </div>
              <span className="cl-captured">{step.chMsgs[c].length ? `captured: ${step.chMsgs[c].map((m) => '$' + m).join(', ')}` : ''}</span>
            </div>
          ))}
        </div>

        <div className="cl-step">
          <div className="cl-stepdesc"><span className={`cl-tag ${step.tag}`}>{step.tag}</span> {step.desc}</div>
          <div className="cl-controls">
            <button onClick={() => { setPlaying(false); setI(0); }} disabled={i === 0}>⏮ reset</button>
            <button onClick={() => { setPlaying(false); setI((x) => Math.max(0, x - 1)); }} disabled={i === 0}>‹ prev</button>
            <button className="cl-play" onClick={() => { if (i >= last) setI(0); setPlaying((p) => !p); }}>{playing ? '⏸ pause' : '▶ play'}</button>
            <button onClick={() => { setPlaying(false); setI((x) => Math.min(last, x + 1)); }} disabled={i === last}>next ›</button>
            <span className="cl-count">step {i + 1} / {R.steps.length}</span>
          </div>
        </div>

        <div className={`cl-result ${i === last ? 'done' : 'pending'}`}>
          <h3>Recorded snapshot {i === last ? '(complete)' : '(in progress…)'}</h3>
          <div className="cl-ledger">
            {PROCS.map((p) => (
              <div key={p} className="cl-lrow"><span>{p} balance</span><b>{step.recorded[p] ? `$${step.recordedBalance[p]}` : '—'}</b></div>
            ))}
            {CHANS.map((c) => (
              <div key={c} className="cl-lrow"><span>channel {c.replace('->', ' → ')}</span><b>{step.chMsgs[c].length ? step.chMsgs[c].map((m) => '$' + m).join(' + ') : '$0'}</b></div>
            ))}
          </div>
          {i === last && (
            <div className="cl-totals">
              <div className="cl-tcol bad"><span className="cl-tnum">${R.naiveTotal}</span><span className="cl-tcap">balances only<br />(misses in-flight money)</span></div>
              <div className="cl-tcol good"><span className="cl-tnum">${R.snapshotTotal}</span><span className="cl-tcap">+ channel state<br />= full snapshot</span></div>
              <div className="cl-tcol"><span className="cl-tnum">${R.initialTotal}</span><span className="cl-tcap">true total<br />(conserved)</span></div>
              <div className={`cl-verdict ${R.conserved ? 'ok' : 'no'}`}>{R.conserved ? '✓ consistent cut — the books balance' : '✗ inconsistent'}</div>
            </div>
          )}
        </div>

        <p className="cl-foot">
          The magic: no process ever stops, no clock is shared, yet the recorded state is one the system <em>could</em> have passed through —
          and here the <strong>${R.initialTotal - R.naiveTotal}</strong> in flight on a channel is exactly what balances-only accounting would
          lose. Markers travel in the same FIFO order as data, so they cleanly separate “before the cut” from “after.” This is how real systems
          take consistent checkpoints (Apache Flink’s exactly-once snapshots use a direct descendant of this algorithm) and detect stable
          properties like deadlock or termination.
        </p>
      </section>
    </div>
  );
}
