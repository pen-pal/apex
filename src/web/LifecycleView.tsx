// Connection lifecycle view — a proper sequence diagram. Client and server lifelines,
// one animated directional arrow per segment with a packet box (live seq/ack/
// flags), a detail panel, and the state grid below. One Play steps the whole
// lifecycle, advancing the packets AND lighting the endpoints' states together.
// All of it derives from spec.conversation + spec.states + the real payload len.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ConversationSpec, ConversationStep, StateMachine } from '../core/types';
import { sequenceTrace } from './conversation';

/** A teaching colour per segment kind, in the app's light palette. */
function stepHue(s: ConversationStep): number {
  const t = `${s.label} ${s.flags ?? ''}`;
  if (/SYN/.test(t)) return 212; // blue — setup
  if (/FIN/.test(t)) return 28; // orange — teardown
  if (/PSH/.test(t)) return 190; // teal — data
  return 150; // green — bare ACK
}

export function LifecycleView({
  machine,
  conversation,
  payloadLength,
  name,
}: {
  machine: StateMachine | undefined;
  conversation: ConversationSpec | undefined;
  payloadLength: number;
  name: string;
}) {
  if (!conversation || !machine) {
    return <div className="jsec"><p className="jsec-sub">This protocol declares no conversation.</p></div>;
  }
  const steps = conversation.steps;
  const trace = useMemo(() => sequenceTrace(steps, payloadLength), [steps, payloadLength]);

  const [revealed, setRevealed] = useState(steps.length); // default: all shown; Play re-animates
  const [selected, setSelected] = useState<number | null>(null);
  const timer = useRef<number | null>(null);

  const stop = () => {
    if (timer.current != null) { clearInterval(timer.current); timer.current = null; }
  };
  useEffect(() => stop, []);

  const play = () => {
    stop();
    setSelected(null);
    setRevealed(0);
    timer.current = window.setInterval(() => {
      setRevealed((r) => {
        if (r >= steps.length) { stop(); return r; }
        return r + 1;
      });
    }, 850);
  };

  const activeIdx = selected != null ? selected : revealed - 1;
  const active = activeIdx >= 0 ? steps[activeIdx] : null;
  const clientState = active?.clientState ?? machine.initial;
  const serverState = active?.serverState ?? machine.initial;
  const seen = new Set<string>([machine.initial]);
  for (let i = 0; i <= activeIdx; i++) {
    if (steps[i].clientState) seen.add(steps[i].clientState!);
    if (steps[i].serverState) seen.add(steps[i].serverState!);
  }

  const [cli, srv] = conversation.participants;

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head">
          <h2>{name} connection lifecycle</h2>
          <div className="play-group">
            <button className="play" onClick={play}>▶ Play</button>
            <button className="ghost" onClick={() => { stop(); setSelected(null); setRevealed(steps.length); }}>Show all</button>
          </div>
        </div>
        <p className="jsec-sub">
          The whole {name} conversation — connection setup, your {payloadLength}-byte payload, and teardown
          ({steps.length} segments). seq/ack are relative to each side's ISN and update live with your
          message. Click a packet to inspect it.
        </p>

        <div className="lc-cols"><span className="lc-cli">{cli}</span><span className="lc-srv">{srv}</span></div>
        <div className="lc">
          <span className="lc-life" style={{ left: '16%' }} />
          <span className="lc-life" style={{ left: '84%' }} />
          {steps.map((s, i) => {
            const right = s.from === 'client';
            const hue = stepHue(s);
            const on = i < revealed;
            const isActive = i === activeIdx;
            const p = trace[i];
            return (
              <div className="lc-step" key={i}>
                <div className="lc-track">
                  <span
                    className={`lc-arrow ${right ? 'right' : 'left'} ${on ? 'in' : ''}`}
                    style={{ background: `hsl(${hue} 65% 52%)`, color: `hsl(${hue} 65% 52%)` }}
                  />
                  <button
                    className={`lc-pkt ${right ? 'l' : 'r'} ${on ? 'in' : ''} ${isActive ? 'active' : ''}`}
                    style={{ borderColor: `hsl(${hue} 55% 60%)` }}
                    onClick={() => setSelected(i)}
                  >
                    <span className="lc-pkt-label" style={{ color: `hsl(${hue} 60% 38%)` }}>{s.label}</span>
                    <span className="lc-pkt-meta">
                      seq {p.seq} · ack {p.ackValid ? p.ack : '—'}{p.payload ? ` · ${p.payload}B` : ''}
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {active && (
          <div className="lc-detail">
            <div className="lc-d-head">
              <span className="lc-d-label" style={{ color: `hsl(${stepHue(active)} 60% 38%)` }}>{active.label}</span>
              <span className="lc-d-dir">{active.from === 'client' ? `${cli} → ${srv}` : `${srv} → ${cli}`}</span>
            </div>
            <div className="lc-d-grid">
              <div><span className="k">flags</span><code>{active.flags ?? '—'}</code></div>
              <div><span className="k">seq</span><code>{trace[activeIdx].seq}</code></div>
              <div><span className="k">ack</span><code>{trace[activeIdx].ackValid ? trace[activeIdx].ack : '—'}</code></div>
              <div><span className="k">payload</span><code>{trace[activeIdx].payload}B</code></div>
              <div><span className="k">{cli}</span><code>{active.clientState}</code></div>
              <div><span className="k">{srv}</span><code>{active.serverState}</code></div>
            </div>
            {active.note && <p className="lc-d-note">{active.note}</p>}
          </div>
        )}
      </section>

      <section className="jsec">
        <h2>State machine</h2>
        <p className="jsec-sub">
          Both endpoints' positions in the {machine.states.length}-state {name} machine. <code className="sm-tag cli">{cli}</code> is at{' '}
          <strong>{clientState}</strong>; <code className="sm-tag srv">{srv}</code> is at <strong>{serverState}</strong>.
        </p>
        <div className="sm-grid">
          {machine.states.map((st) => {
            const isCli = st === clientState;
            const isSrv = st === serverState;
            const cls = isCli && isSrv ? 'both' : isCli ? 'cli' : isSrv ? 'srv' : seen.has(st) ? 'visited' : '';
            return <div key={st} className={`sm-node ${cls}`}>{st}</div>;
          })}
        </div>
      </section>
    </div>
  );
}
