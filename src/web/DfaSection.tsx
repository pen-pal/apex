// DFA, made visible. A state diagram (states in a ring, labeled transition arrows) and an
// input tape; step through the input and watch the single active state move per symbol,
// ending in accept (green) or reject. Switch machines — including the delightful "binary
// divisible by 3" where the states literally are the remainder. Real DFA in dfa.ts (tested).
import { useMemo, useState } from 'react';
import { run, divisibleBy, containsAB, type Dfa } from './dfa';

const MACHINES: { name: string; dfa: Dfa; sample: string; note: string }[] = [
  { name: 'divisible by 3', dfa: divisibleBy(3), sample: '110', note: 'binary value mod 3 — the state is the remainder' },
  { name: 'divisible by 5', dfa: divisibleBy(5), sample: '1010', note: 'binary value mod 5' },
  { name: 'contains "ab"', dfa: containsAB(), sample: 'aab', note: 'over the alphabet {a, b}' },
];

export function DfaSection() {
  const [mi, setMi] = useState(0);
  const { dfa, note } = MACHINES[mi];
  const [input, setInput] = useState(MACHINES[0].sample);
  const r = useMemo(() => run(dfa, input), [dfa, input]);
  const [step, setStep] = useState(1e9);

  const s = Math.min(step, r.path.length - 1);
  const active = r.path[s];
  const finished = s >= r.path.length - 1;

  // layout states in a circle
  const n = dfa.states.length, R = 80, CX = 110, CY = 110;
  const pos = (i: number) => ({ x: CX + R * Math.cos((i / n) * 2 * Math.PI - Math.PI / 2), y: CY + R * Math.sin((i / n) * 2 * Math.PI - Math.PI / 2) });
  const idx = (st: string) => dfa.states.indexOf(st);

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Finite automaton — the simplest computer</h2></div>
        <p className="jsec-sub">
          A DFA has just a current state and a rule: for each input symbol, jump to the next state. No memory, no counters — yet that’s
          enough to recognize the “regular” languages behind regexes, lexers, and protocol state machines. Feed it a string and watch the
          single active state walk the transitions; if it ends in an accepting state, the string is in the language.
        </p>

        <div className="dfa-machines">
          {MACHINES.map((m, k) => <button key={k} className={mi === k ? 'on' : ''} onClick={() => { setMi(k); setInput(m.sample); setStep(1e9); }}>{m.name}</button>)}
        </div>

        <input className="dfa-input" value={input} onChange={(e) => { const clean = [...e.target.value].filter((c) => dfa.alphabet.includes(c)).join(''); setInput(clean); setStep(1e9); }} spellCheck={false} placeholder={`over {${dfa.alphabet.join(', ')}}`} />
        <div className="dfa-note">{note}</div>

        <div className="dfa-stage">
          <svg viewBox="0 0 220 220" width={220} height={220} className="dfa-diagram">
            <defs><marker id="dfa-arr" markerWidth="9" markerHeight="9" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6 Z" className="dfa-arrhead" /></marker></defs>
            {dfa.states.flatMap((st) => Object.entries(dfa.delta[st] || {}).map(([sym, to]) => {
              const a = pos(idx(st)), b = pos(idx(to));
              if (st === to) return <text key={st + sym} x={a.x} y={a.y - 20} className="dfa-self" textAnchor="middle">↺{sym}</text>;
              const mx = (a.x + b.x) / 2 + (a.y - b.y) * 0.12, my = (a.y + b.y) / 2 + (b.x - a.x) * 0.12;
              return <g key={st + sym}><path d={`M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`} className="dfa-edge" markerEnd="url(#dfa-arr)" /><text x={mx} y={my} className="dfa-sym" textAnchor="middle">{sym}</text></g>;
            }))}
            {dfa.states.map((st, i) => {
              const p = pos(i);
              return (
                <g key={st}>
                  {dfa.accept.has(st) && <circle cx={p.x} cy={p.y} r={18} className="dfa-acceptring" />}
                  <circle cx={p.x} cy={p.y} r={15} className={`dfa-state ${st === active ? 'active' : ''} ${st === dfa.start ? 'start' : ''}`} />
                  <text x={p.x} y={p.y + 4} className="dfa-slabel" textAnchor="middle">{st.replace('r', '')}</text>
                </g>
              );
            })}
          </svg>

          <div className="dfa-side">
            <div className="dfa-tape">
              {[...input].map((ch, i) => <span key={i} className={`dfa-tc ${i < s ? 'read' : ''} ${i === s ? 'cur' : ''}`}>{ch}</span>)}
              {input === '' && <span className="dfa-empty">ε (empty)</span>}
            </div>
            <div className="dfa-controls">
              <button onClick={() => setStep(0)} disabled={s === 0}>⏮</button>
              <button onClick={() => setStep(Math.max(0, s - 1))} disabled={s === 0}>◀</button>
              <span className="dfa-pos">{s} / {r.path.length - 1}</span>
              <button onClick={() => setStep(s + 1)} disabled={finished}>▶</button>
            </div>
            <div className={`dfa-verdict ${finished ? (r.accepted ? 'ok' : 'bad') : 'mid'}`}>
              {!finished ? `in state ${active.replace('r', '')}…` : r.accepted ? '✓ ACCEPTED — string is in the language' : `✗ REJECTED${r.rejectedAt !== null ? ` (stuck at symbol ${r.rejectedAt})` : ` (ended in non-accepting state ${active.replace('r', '')})`}`}
            </div>
          </div>
        </div>

        <p className="dfa-foot">
          Every regex compiles to a finite automaton — first a nondeterministic NFA (Thompson’s construction), then a DFA via the subset
          construction, which is what makes matching linear-time. The Myhill-Nerode theorem says there’s a unique minimal DFA for each
          regular language. What a DFA <em>can’t</em> do is count unboundedly (balanced parentheses, aⁿbⁿ) — that needs a stack
          (push-down automaton) or more, the first rung of the Chomsky hierarchy.
        </p>
      </section>
    </div>
  );
}
