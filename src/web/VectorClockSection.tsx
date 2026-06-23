// Vector clocks, made visible. Three processes exchange messages; each event is
// stamped with its vector clock. Click two events and the tool tells you whether one
// happened-before the other or they're CONCURRENT — the thing wall-clock time can't
// tell you in a distributed system. Real causal-order math (see vectorclock.ts).
import { useMemo, useState } from 'react';
import { emptyClock, localEvent, send, receive, compare, clockString, type Clock } from './vectorclock';

const PROCS = ['A', 'B', 'C'];
type Kind = 'local' | 'send' | 'recv';
interface ScriptEv { id: string; proc: string; kind: Kind; col: number; msg?: string }
// A fixed causal scenario: A sends m1 to B; B later sends m2 to C; C and the others
// also do independent local events.
const SCRIPT: ScriptEv[] = [
  { id: 'a1', proc: 'A', kind: 'local', col: 0 },
  { id: 'a2', proc: 'A', kind: 'send', col: 1, msg: 'm1' },
  { id: 'b1', proc: 'B', kind: 'local', col: 0 },
  { id: 'b2', proc: 'B', kind: 'recv', col: 2, msg: 'm1' },
  { id: 'c1', proc: 'C', kind: 'local', col: 1 },
  { id: 'b3', proc: 'B', kind: 'local', col: 3 },
  { id: 'b4', proc: 'B', kind: 'send', col: 4, msg: 'm2' },
  { id: 'c2', proc: 'C', kind: 'recv', col: 5, msg: 'm2' },
  { id: 'a3', proc: 'A', kind: 'local', col: 5 },
  { id: 'c3', proc: 'C', kind: 'local', col: 6 },
];
interface Ev extends ScriptEv { clock: Clock }

function simulate(): Ev[] {
  const clk: Record<string, Clock> = Object.fromEntries(PROCS.map((p) => [p, emptyClock(PROCS)]));
  const msgs: Record<string, Clock> = {};
  const out: Ev[] = [];
  for (const e of SCRIPT) {
    if (e.kind === 'local') clk[e.proc] = localEvent(clk[e.proc], e.proc);
    else if (e.kind === 'send') { clk[e.proc] = send(clk[e.proc], e.proc); msgs[e.msg!] = clk[e.proc]; }
    else { clk[e.proc] = receive(clk[e.proc], msgs[e.msg!], e.proc); }
    out.push({ ...e, clock: clk[e.proc] });
  }
  return out;
}

const COLW = 92, ROWH = 72, LEFT = 44, TOP = 30, MAXCOL = 6;
const W = LEFT + (MAXCOL + 1) * COLW, H = TOP + PROCS.length * ROWH + 20;
const xOf = (col: number) => LEFT + col * COLW + 30;
const yOf = (proc: string) => TOP + PROCS.indexOf(proc) * ROWH + 24;

export function VectorClockSection() {
  const events = useMemo(() => simulate(), []);
  const [sel, setSel] = useState<string[]>([]);

  const pick = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id].slice(-2)));
  const [e1, e2] = sel.map((id) => events.find((e) => e.id === id)!);
  const rel = e1 && e2 ? compare(e1.clock, e2.clock) : null;
  const messages = SCRIPT.filter((e) => e.kind === 'send').map((s) => ({ from: events.find((e) => e.id === s.id)!, to: events.find((e) => e.kind === 'recv' && e.msg === s.msg)! }));

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Vector clocks — ordering events without a shared clock</h2></div>
        <p className="jsec-sub">
          In a distributed system there is no single clock, and wall-clock time lies (drift, skew). Vector clocks track
          causality instead: each process counts its own events and learns about others through messages. Comparing two
          stamps tells you if one <strong>caused</strong> the other — or if they’re <strong>concurrent</strong> and could
          have happened in either order. Click any two events.
        </p>

        <svg className="vc-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="process timelines">
          {PROCS.map((p) => (
            <g key={p}>
              <line x1={LEFT} y1={yOf(p)} x2={W - 10} y2={yOf(p)} className="vc-line" />
              <text x={LEFT - 28} y={yOf(p) + 4} className="vc-proc">{p}</text>
            </g>
          ))}
          {messages.map((m, i) => (
            <line key={i} x1={xOf(m.from.col)} y1={yOf(m.from.proc)} x2={xOf(m.to.col)} y2={yOf(m.to.proc)} className="vc-msg" markerEnd="url(#vc-arrow)" />
          ))}
          <defs><marker id="vc-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="hsl(28 70% 50%)" /></marker></defs>
          {events.map((e) => {
            const selected = sel.includes(e.id);
            const related = rel && (selected || false);
            return (
              <g key={e.id} className="vc-ev" onClick={() => pick(e.id)} style={{ cursor: 'pointer' }}>
                <circle cx={xOf(e.col)} cy={yOf(e.proc)} r={9} className={`vc-dot ${e.kind} ${selected ? 'sel' : ''}`} />
                <text x={xOf(e.col)} y={yOf(e.proc) - 14} className="vc-clk" textAnchor="middle">{PROCS.map((p) => e.clock[p]).join(',')}</text>
                <text x={xOf(e.col)} y={yOf(e.proc) + 22} className="vc-id" textAnchor="middle">{e.id}</text>
                {related && <circle cx={xOf(e.col)} cy={yOf(e.proc)} r={13} className="vc-ring" />}
              </g>
            );
          })}
        </svg>

        <div className="vc-readout">
          {!e1 ? <span>Click an event to select it (then a second to compare).</span>
            : !e2 ? <span>Selected <strong>{e1.id}</strong> {clockString(e1.clock, PROCS)} — pick a second event.</span>
              : (
                <div className={`vc-rel ${rel}`}>
                  <div className="vc-rel-head">
                    <code>{e1.id} {clockString(e1.clock, PROCS)}</code> vs <code>{e2.id} {clockString(e2.clock, PROCS)}</code>
                  </div>
                  <div className="vc-verdict">
                    {rel === 'before' && <><strong>{e1.id} happened-before {e2.id}</strong> — every counter of {e1.id} ≤ {e2.id}, and at least one is strictly less. {e1.id} is in {e2.id}’s causal past.</>}
                    {rel === 'after' && <><strong>{e1.id} happened-after {e2.id}</strong> — {e2.id} is in {e1.id}’s causal past.</>}
                    {rel === 'concurrent' && <><strong>{e1.id} and {e2.id} are CONCURRENT</strong> — each is ahead of the other in some process’s count, so neither could have caused the other. Their real-time order is undefined.</>}
                    {rel === 'equal' && <>The same event.</>}
                  </div>
                </div>
              )}
        </div>
        <p className="enc-note">This is why systems like Dynamo/Riak store vector clocks with each value: on a conflicting write they can tell a
          stale overwrite (happened-before) from a genuine concurrent edit (a conflict to resolve or keep as siblings). Lamport timestamps are the
          scalar cousin — a single counter that gives a total order but, unlike vectors, can’t <em>detect</em> concurrency.</p>
      </section>
    </div>
  );
}
