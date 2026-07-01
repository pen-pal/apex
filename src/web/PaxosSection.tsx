// Paxos, made visible. Step through two competing proposers on a row of acceptors. Each
// acceptor shows its promised ballot and its accepted (ballot, value). Walk the Prepare/
// Promise/Accept/Accepted phases and watch the safety property fire: once a value is
// chosen, the higher ballot is forced to re-propose it, not its own preference. Real
// protocol logic in paxos.ts (tested for the safety guarantees).
import { useMemo, useState } from 'react';
import { runPaxos, type Phase } from './paxos';

const SCENARIO = [
  { proposer: 'A', n: 1, preferred: 'X' },
  { proposer: 'B', n: 2, preferred: 'Y' },
];

const PHASE_LABEL: Record<Phase, string> = {
  prepare: 'Phase 1 · Prepare', promise: 'Phase 1 · Promise', accept: 'Phase 2 · Accept',
  accepted: 'Phase 2 · Accepted', decision: 'Decision', fail: 'Failed',
};

export function PaxosSection() {
  const run = useMemo(() => runPaxos(3, SCENARIO), []);
  const [i, setI] = useState(0); // start at the first step
  const step = run.steps[Math.min(i, run.steps.length - 1)];

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Paxos — agreeing on one value, safely</h2></div>
        <p className="jsec-sub">
          Three acceptors must agree on a single value even though two proposers compete. Proposer <strong>A</strong> wants “X”,
          proposer <strong>B</strong> wants “Y” with a higher ballot. Step through and watch the rule that makes Paxos safe: in Phase 2
          a proposer must adopt the highest value already accepted — so once “X” is chosen, B cannot replace it with “Y”.
        </p>

        <div className="pax-controls">
          <button onClick={() => setI(0)} disabled={i === 0}>⏮</button>
          <button onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0}>◀</button>
          <span className="pax-count">step {i + 1} / {run.steps.length}</span>
          <button onClick={() => setI(Math.min(run.steps.length - 1, i + 1))} disabled={i >= run.steps.length - 1}>▶</button>
          <button onClick={() => setI(run.steps.length - 1)} disabled={i >= run.steps.length - 1}>⏭</button>
        </div>

        <div className={`pax-now phase-${step.phase}`}>
          <span className="pax-badge">{PHASE_LABEL[step.phase]}</span>
          <span className="pax-prop">{step.proposer} · ballot {step.n}{step.value ? ` · "${step.value}"` : ''}</span>
          <div className="pax-text">{step.text}</div>
        </div>

        <div className="pax-acceptors">
          {step.acceptors.map((a) => {
            const responded = step.responders?.includes(a.id);
            return (
              <div key={a.id} className={`pax-acc ${responded ? 'resp' : ''} ${a.acceptedV ? 'has' : ''}`}>
                <div className="pax-acc-name">acceptor {a.id + 1}</div>
                <div className="pax-acc-row">promised ballot <b>{a.promised || '–'}</b></div>
                <div className="pax-acc-row">accepted {a.acceptedV ? <b>“{a.acceptedV}” @ {a.acceptedN}</b> : <span className="pax-none">nothing</span>}</div>
                {responded && <div className="pax-acc-tick">✓ responded</div>}
              </div>
            );
          })}
        </div>

        <div className={`pax-chosen ${step.chosen ? 'on' : ''}`}>
          {step.chosen ? <>✅ chosen value: <b>“{step.chosen}”</b> — final and immutable</> : 'no value chosen yet'}
        </div>

        <p className="pax-foot">
          Why it’s safe: a proposal needs a <em>majority</em> to promise and a <em>majority</em> to accept, and any two majorities of the
          same acceptors must overlap in at least one node. That overlapping acceptor remembers the chosen value and reports it in its
          promise, forcing every higher ballot to carry the same value forward. Multi-Paxos and Raft extend this one-value agreement into
          a replicated log; this section shows the single decree at its heart.
        </p>
      </section>
    </div>
  );
}
