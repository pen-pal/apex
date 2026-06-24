// Lamport clocks, made visible. A space-time diagram of three processes: each event is
// a dot carrying its Lamport timestamp, messages are arrows that bump the receiver's
// clock to max(local, sent)+1. A second panel shows the consistent total order, and we
// call out a concurrent pair whose timestamps are ordered even though neither event
// causes the other — the limitation that motivates vector clocks. Real logic: lamport.ts.
import { useMemo, useState } from 'react';
import { lamport, totalOrder, messageArrows, type InputEvent } from './lamport';

const PROCS = ['A', 'B', 'C'];

// the default scenario (matches the test's hand-worked diagram)
const DEFAULT: InputEvent[] = [
  { proc: 0, kind: 'local', label: 'a1' },
  { proc: 0, kind: 'send', msg: 'm1', label: 'a2' },
  { proc: 1, kind: 'local', label: 'b1' },
  { proc: 1, kind: 'recv', msg: 'm1', label: 'b2' },
  { proc: 1, kind: 'send', msg: 'm2', label: 'b3' },
  { proc: 2, kind: 'recv', msg: 'm2', label: 'c1' },
];

const COL_W = 92;   // px between event slots
const ROW_H = 76;   // px between process lines
const PAD = 40;

export function LamportSection() {
  const [events] = useState<InputEvent[]>(DEFAULT);
  const stamped = useMemo(() => lamport(events), [events]);
  const arrows = useMemo(() => messageArrows(stamped), [stamped]);
  const order = useMemo(() => totalOrder(stamped), [stamped]);

  // x position = order of the event within the whole sequence (its idx)
  const x = (idx: number) => PAD + idx * COL_W;
  const yOf = (proc: number) => PAD + proc * ROW_H;
  const width = PAD * 2 + (events.length - 1) * COL_W;
  const height = PAD * 2 + (PROCS.length - 1) * ROW_H;

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Lamport clocks — ordering events without a clock</h2></div>
        <p className="jsec-sub">
          Distributed machines have no shared “now.” Lamport’s trick: each process keeps a counter, bumps it before every event,
          stamps outgoing messages with it, and on receipt jumps to <code>max(local, received) + 1</code>. That single rule guarantees
          that if one event <em>causes</em> another, its number is smaller. Each dot below shows its Lamport timestamp.
        </p>

        <div className="lam-diagram">
          <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
            {PROCS.map((p, i) => (
              <g key={p}>
                <line x1={PAD - 24} y1={yOf(i)} x2={width - PAD + 20} y2={yOf(i)} className="lam-axis" />
                <text x={PAD - 30} y={yOf(i) + 4} className="lam-proc" textAnchor="end">{p}</text>
              </g>
            ))}
            {arrows.map((a, i) => (
              <line key={i} x1={x(a.from.idx)} y1={yOf(a.from.proc)} x2={x(a.to.idx)} y2={yOf(a.to.proc)}
                className="lam-msg" markerEnd="url(#lam-arrow)" />
            ))}
            <defs>
              <marker id="lam-arrow" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto">
                <path d="M0,0 L7,3 L0,6 Z" className="lam-arrowhead" />
              </marker>
            </defs>
            {stamped.map((e) => (
              <g key={e.idx}>
                <circle cx={x(e.idx)} cy={yOf(e.proc)} r={15} className={`lam-dot ${e.kind}`} />
                <text x={x(e.idx)} y={yOf(e.proc) + 5} className="lam-ts" textAnchor="middle">{e.ts}</text>
                <text x={x(e.idx)} y={yOf(e.proc) - 22} className="lam-lbl" textAnchor="middle">{e.label}</text>
              </g>
            ))}
          </svg>
        </div>

        <div className="lam-legend">
          <span><i className="lam-dot local" /> local event</span>
          <span><i className="lam-dot send" /> send</span>
          <span><i className="lam-dot recv" /> receive</span>
          <span><i className="lam-msgkey" /> message</span>
        </div>

        <div className="lam-order">
          <h3>Consistent total order — sort by (timestamp, process)</h3>
          <div className="lam-chips">
            {order.map((e) => (
              <span key={e.idx} className="lam-chip"><b>{e.label}</b><i>{e.ts}·{PROCS[e.proc]}</i></span>
            ))}
          </div>
        </div>

        <div className="lam-caveat">
          <strong>The catch.</strong> Notice <b>b1</b> (ts 1) and <b>a2</b> (ts 2): b1’s number is smaller, yet b1 doesn’t cause a2 —
          they’re <em>concurrent</em>. Lamport timestamps preserve causality (cause ⟹ smaller) but can’t prove its absence: a smaller
          number doesn’t mean “happened before.” Telling concurrency apart from causality is exactly what vector clocks add.
        </div>
      </section>
    </div>
  );
}
