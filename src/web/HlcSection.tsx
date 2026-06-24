// HLC, made visible. A timeline of events on one node, each stamped with its hybrid
// timestamp (l.c); watch l track the physical clock, the counter c absorb ties and a
// backward clock jump, and a received message pull the clock forward. Real HLC rules in
// hlc.ts (tested against a hand-worked trace).
import { useMemo } from 'react';
import { run, fmt, type Event } from './hlc';

const EVENTS: Event[] = [
  { kind: 'local', pt: 10, label: 'write A' },
  { kind: 'local', pt: 10, label: 'write B (clock hasn’t ticked)' },
  { kind: 'local', pt: 9, label: 'write C (clock skewed backward!)' },
  { kind: 'send', pt: 11, label: 'send to node 2' },
  { kind: 'recv', pt: 12, msg: { l: 15, c: 0 }, label: 'recv (msg stamped 15.0, ahead of us)' },
  { kind: 'local', pt: 16, label: 'write D' },
  { kind: 'local', pt: 16, label: 'write E' },
];

const KIND_ICON = { local: '•', send: '→', recv: '←' } as const;

export function HlcSection() {
  const stamped = useMemo(() => run(EVENTS), []);
  const maxL = Math.max(...stamped.map((s) => s.hlc.l));

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Hybrid Logical Clocks — real time that still orders events</h2></div>
        <p className="jsec-sub">
          A Lamport clock orders causally-related events but can drift far from the wall clock; a physical clock is real but can’t order
          events when machines’ clocks disagree or jump. An <strong>HLC</strong> is both: a pair <code>l.c</code> where <strong>l</strong>
          tracks the largest physical time seen and <strong>c</strong> is a tiny counter that breaks ties and absorbs backward clock
          jumps — so timestamps stay near real time <em>and</em> respect happens-before.
        </p>

        <div className="hlc-table">
          <div className="hlc-hrow head"><span>event</span><span>physical pt</span><span>HLC (l.c)</span><span>drift (l−pt)</span></div>
          {stamped.map((s, i) => (
            <div key={i} className={`hlc-hrow ${s.event.kind}`}>
              <span className="hlc-ev"><i>{KIND_ICON[s.event.kind]}</i> {s.event.label}</span>
              <span className="hlc-pt">{s.event.pt}</span>
              <span className="hlc-stamp">{fmt(s.hlc)}</span>
              <span className={`hlc-skew ${s.skew > 0 ? 'pos' : ''}`}>{s.skew > 0 ? `+${s.skew}` : '0'}</span>
            </div>
          ))}
        </div>

        <div className="hlc-bars">
          {stamped.map((s, i) => (
            <div key={i} className="hlc-barwrap" title={`${s.event.label}: ${fmt(s.hlc)}`}>
              <div className="hlc-bar" style={{ height: `${(s.hlc.l / maxL) * 100}%` }}>
                {s.hlc.c > 0 && <span className="hlc-cdot" style={{ bottom: `calc(100% - 2px)` }}>+{s.hlc.c}</span>}
              </div>
            </div>
          ))}
        </div>

        <p className="hlc-foot">
          Read the trace: writes A and B share <code>10.0 → 10.1</code> because the clock didn’t tick; C at physical time 9 would go
          <em> backward</em>, so the HLC stays at l=10 and bumps the counter to <code>10.2</code> — it never regresses. The received
          message stamped <code>15.0</code> drags the clock forward to <code>15.1</code> (strictly after the sender), then the next local
          write jumps to <code>16.0</code> as the physical clock catches up. The counter stays tiny and bounded, so an HLC fits in 64
          bits and is a near-drop-in for a physical timestamp — which is why CockroachDB and MongoDB use it to order writes across nodes
          without a global clock (and why Google’s Spanner instead spends real hardware on TrueTime to bound the uncertainty directly).
        </p>
      </section>
    </div>
  );
}
