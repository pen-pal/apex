// Two-phase commit, made visible. A coordinator drives several participants to
// commit a transaction atomically. Set each participant's vote, send PREPARE (phase
// 1), then decide (phase 2) — unanimous YES commits, any NO aborts. Or crash the
// coordinator right after they prepare and watch them get stuck IN-DOUBT, holding
// locks: 2PC's blocking flaw. Real 2PC semantics (see twopc.ts).
import { useState } from 'react';
import { init2pc, prepare, decide, applyDecision, crashCoordinator, outcome, type TwoPC, type PState } from './twopc';

const STATE_LABEL: Record<PState, string> = { working: 'working', prepared: 'prepared 🔒', committed: 'committed', aborted: 'aborted', 'in-doubt': 'IN-DOUBT 🔒' };

export function TwoPcSection() {
  const [s, setS] = useState<TwoPC>(() => init2pc(['yes', 'yes', 'yes']));
  const result = outcome(s);

  const toggleVote = (i: number) => {
    if (s.phase !== 'idle') return;
    setS({ ...s, participants: s.participants.map((p) => (p.id === i ? { ...p, vote: p.vote === 'yes' ? 'no' : 'yes' } : p)) });
  };
  const reset = () => setS(init2pc(['yes', 'yes', 'yes']));

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Two-phase commit — all-or-nothing across databases</h2></div>
        <p className="jsec-sub">
          A transaction that spans several databases must commit <em>everywhere or nowhere</em>. A coordinator runs two
          rounds: it asks everyone to <strong>PREPARE</strong> (vote yes = ready &amp; holding locks, or no), then — if all
          said yes — tells them to <strong>COMMIT</strong>, else ABORT. Set the votes, run the phases, or crash the
          coordinator mid-protocol to expose 2PC’s blocking flaw.
        </p>

        <div className="tpc-coord">
          <div className={`tpc-coord-box ${s.coordinatorAlive ? '' : 'dead'}`}>
            <div className="tpc-c-name">Coordinator {s.coordinatorAlive ? '' : '💥 crashed'}</div>
            <div className="tpc-c-phase">phase: <strong>{s.phase}</strong>{s.decision && ` · decision: ${s.decision.toUpperCase()}`}</div>
          </div>
        </div>

        <div className="tpc-parts">
          {s.participants.map((p) => (
            <div key={p.id} className={`tpc-part ${p.state}`}>
              <div className="tpc-p-name">Participant {p.id}</div>
              <button className={`tpc-vote ${p.vote}`} disabled={s.phase !== 'idle'} onClick={() => toggleVote(p.id)}>vote: {p.vote.toUpperCase()}</button>
              <div className="tpc-p-state">{STATE_LABEL[p.state]}</div>
            </div>
          ))}
        </div>

        <div className="tpc-controls">
          {s.phase === 'idle' && <button className="ghost small" onClick={() => setS(prepare(s))}>① send PREPARE →</button>}
          {s.phase === 'preparing' && <>
            <button className="ghost small" onClick={() => setS(decide(s))}>② decide &amp; broadcast →</button>
            <button className="ghost small tpc-crash" onClick={() => setS(crashCoordinator(s))}>💥 crash coordinator now</button>
          </>}
          {(s.phase === 'committing' || s.phase === 'aborting') && <button className="ghost small" onClick={() => setS(applyDecision(s))}>deliver {s.decision} →</button>}
          <button className="ghost small" onClick={reset}>↺ reset</button>
        </div>

        <div className={`tpc-outcome ${result}`}>
          {result === 'pending' && 'Run the phases to reach a decision.'}
          {result === 'committed' && '✓ COMMITTED everywhere — atomic success. Every participant applied the change and released its locks.'}
          {result === 'aborted' && '✗ ABORTED everywhere — atomic rollback. One NO (or a prepare failure) rolls back the whole transaction.'}
          {result === 'blocked' && <><strong>⛔ BLOCKED (in-doubt).</strong> The coordinator crashed after participants prepared but before the decision. They voted yes, so they can’t abort; they never heard “commit”, so they can’t commit — they sit holding locks until the coordinator recovers. This is why 2PC is called a <em>blocking</em> protocol.</>}
        </div>
        <p className="enc-note">2PC gives atomicity but trades availability: a coordinator failure can freeze participants indefinitely (and they hold
          locks the whole time, blocking other transactions). That’s why systems prefer consensus (Raft/Paxos, in this group) for the commit decision,
          or avoid distributed transactions entirely with sagas — a sequence of local commits plus compensating undo steps.</p>
      </section>
    </div>
  );
}
