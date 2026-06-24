// Causal broadcast, made visible. Three people post to a channel; the network delivers their messages
// to a receiver OUT OF ORDER (a reply arrives before the message it answers). Step through and watch
// the receiver buffer anything that isn't causally ready and release it only once its dependencies
// have arrived — so the conversation never reads backwards. Delivery logic from causalbcast.ts (tested).
import { useMemo, useState } from 'react';
import { receive, type BMsg } from './causalbcast';

const TEXT: Record<string, { who: string; text: string }> = {
  m1: { who: 'Alice (P0)', text: 'the build is broken' },
  m2: { who: 'Bob (P1)', text: 'on it 👀' },
  m3: { who: 'Carol (P2)', text: 'thanks Bob!' },
};
// m1 → m2 (reply) → m3 (reaction); the network delivers them fully REVERSED
const ARRIVALS: BMsg[] = [
  { id: 'm3', from: 2, vc: [1, 1, 1] },
  { id: 'm2', from: 1, vc: [1, 1, 0] },
  { id: 'm1', from: 0, vc: [1, 0, 0] },
];

export function CbSection() {
  const run = useMemo(() => receive(3, ARRIVALS), []);
  const [i, setI] = useState(run.events.length - 1);
  const shown = run.events.slice(0, i + 1);

  // reconstruct state after the shown events
  const delivered = shown.filter((e) => e.action === 'delivered').map((e) => e.msgId);
  const released = new Set(shown.filter((e) => e.action === 'released').map((e) => e.msgId));
  const buffered = shown.filter((e) => e.action === 'buffered' && !released.has(e.msgId) && !delivered.includes(e.msgId)).map((e) => e.msgId);
  const vc = [...shown].reverse().find((e) => e.vc)?.vc ?? [0, 0, 0];
  const cur = shown[shown.length - 1];

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Causal broadcast — the conversation never reads backwards</h2></div>
        <p className="jsec-sub">
          When messages can overtake each other in the network, a naive receiver might show a <em>reply</em> before the message it answers.
          Causal broadcast forbids that: each message is tagged with its sender’s vector clock, and the receiver <strong>delivers</strong> a
          message only after everything it causally depends on — otherwise it <strong>buffers</strong> it and releases it once the gap is filled.
        </p>

        <div className="cb-arrivals">
          <span className="cb-albl">network delivers (reordered):</span>
          {ARRIVALS.map((m) => <span key={m.id} className="cb-pill">{m.id} <i>{TEXT[m.id].who.split(' ')[0]}</i></span>)}
        </div>

        <div className="cb-controls">
          <button onClick={() => setI(0)}>⏮</button>
          <button onClick={() => setI((x) => Math.max(0, x - 1))} disabled={i === 0}>‹</button>
          <button onClick={() => setI((x) => Math.min(run.events.length - 1, x + 1))} disabled={i >= run.events.length - 1}>step ›</button>
          <span className="cb-stepn">event {i + 1} / {run.events.length}</span>
        </div>

        {cur && (
          <div className={`cb-now ${cur.action}`}>
            <b>{cur.msgId}</b> ({TEXT[cur.msgId].who}: “{TEXT[cur.msgId].text}”) was <b>{cur.action}</b>
            {cur.action === 'buffered' ? ' — its cause hasn’t arrived yet.' : cur.action === 'released' ? ' — its dependencies are now satisfied.' : ` — receiver clock now [${cur.vc}].`}
          </div>
        )}

        <div className="cb-state">
          <div className="cb-panel">
            <div className="cb-phead">📥 buffer (held back)</div>
            {buffered.length === 0 ? <div className="cb-empty">empty</div> : buffered.map((id) => <div key={id} className="cb-bmsg">{id} · “{TEXT[id].text}”</div>)}
          </div>
          <div className="cb-panel">
            <div className="cb-phead">✅ delivered to the app (causal order)</div>
            {delivered.length === 0 ? <div className="cb-empty">nothing yet</div> : delivered.map((id, k) => (
              <div key={id} className="cb-dmsg"><span className="cb-dn">{k + 1}</span><b>{TEXT[id].who}</b>: {TEXT[id].text}</div>
            ))}
          </div>
        </div>
        <div className="cb-vc">receiver vector clock: <code>[{vc.join(', ')}]</code> — counts delivered messages from [Alice, Bob, Carol]</div>

        <p className="cb-foot">
          Causal (or “causal+”) consistency is the strongest model you can have while staying available during a partition — stronger than
          eventual consistency, weaker than total order, and exactly what chat, collaborative editors, and social feeds want: you may not see
          everyone’s messages at the same instant, but you’ll never see an effect before its cause. The cost is the buffer (bounded by how
          reordered the network gets) and carrying a vector clock per message; systems like COPS and Bayou are built on it.
        </p>
      </section>
    </div>
  );
}
