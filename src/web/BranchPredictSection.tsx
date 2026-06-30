// Branch prediction, made visible. Pick a branch-outcome pattern and step a 2-bit saturating counter
// through it: watch the state move strong-NT ↔ weak-NT ↔ weak-T ↔ strong-T while predictions land or
// miss, and compare the misprediction count against a 1-bit predictor on the same sequence. The
// loop-exit pattern is the payoff — the 2 bits of hysteresis halve the mispredictions. Real model from branchpredict.ts.
import { useMemo, useState } from 'react';
import { simulate, loopPattern } from './branchpredict';

const PATTERNS: Record<string, boolean[]> = {
  'loop (3× then exit)': loopPattern(3, 4),
  'alternating': [true, false, true, false, true, false, true, false],
  'mostly taken': [true, true, false, true, true, true, false, true, true, true],
};
const STATE_LABEL = ['strong NT', 'weak NT', 'weak T', 'strong T'];

export function BranchPredictSection() {
  const [pat, setPat] = useState('loop (3× then exit)');
  const [step, setStep] = useState(0);
  const seq = PATTERNS[pat];

  const two = useMemo(() => simulate(seq, '2bit', 2), [seq]);
  const one = useMemo(() => simulate(seq, '1bit', 1), [seq]);
  const curState = step === 0 ? 2 : two.steps[step - 1].stateAfter;

  const pick = (p: string) => { setPat(p); setStep(0); };

  return (
    <div className="bp">
      <div className="bp-patterns">
        {Object.keys(PATTERNS).map((p) => <button key={p} type="button" className={`bp-pat ${pat === p ? 'on' : ''}`} onClick={() => pick(p)}>{p}</button>)}
      </div>

      <div className="bp-seq">
        {two.steps.map((s, i) => (
          <button key={i} type="button" className={`bp-cell ${s.actual ? 'taken' : 'nt'} ${i === step - 1 ? 'cur' : ''} ${i < step && !s.correct ? 'miss' : ''}`} onClick={() => setStep(i + 1)} title={`predicted ${s.predicted ? 'T' : 'N'}, actual ${s.actual ? 'T' : 'N'}`}>
            {s.actual ? 'T' : 'N'}
          </button>
        ))}
      </div>

      <div className="bp-fsm">
        {[0, 1, 2, 3].map((st) => (
          <div key={st} className={`bp-state ${curState === st ? 'on' : ''} ${st >= 2 ? 'tk' : 'ntk'}`}>
            <span className="bp-st-bits">{st.toString(2).padStart(2, '0')}</span>
            <span className="bp-st-lbl">{STATE_LABEL[st]}</span>
            <span className="bp-st-pred">predict {st >= 2 ? 'TAKEN' : 'not taken'}</span>
          </div>
        ))}
      </div>
      <div className="bp-steps">
        <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>◀</button>
        <button type="button" className="primary" onClick={() => setStep((s) => Math.min(seq.length, s + 1))} disabled={step >= seq.length}>step ▶</button>
        <button type="button" onClick={() => setStep(seq.length)} disabled={step >= seq.length}>all</button>
        <button type="button" onClick={() => setStep(0)} disabled={step === 0}>reset</button>
      </div>

      <div className="bp-compare">
        {([['2-bit counter', two, true], ['1-bit predictor', one, false]] as const).map(([title, r, good]) => (
          <div key={title} className={`bp-card ${good ? 'good' : ''}`}>
            <div className="bp-card-h">{title}</div>
            <div className="bp-card-n"><b>{r.mispredictions}</b> mispredictions</div>
            <div className="bp-card-acc">{(r.accuracy * 100).toFixed(0)}% accurate</div>
          </div>
        ))}
      </div>

      <p className="bp-foot">
        On the loop pattern the 2-bit predictor mispredicts only the <em>exit</em> (once per loop); the 1-bit predictor mispredicts the exit AND
        the next iteration’s re-entry, because a single fall-through flips it. That hysteresis is the whole idea. Real cores go far beyond per-branch
        counters: a <strong>two-level predictor</strong> indexes the counters by recent global history (a branch’s direction often correlates with
        the branches before it), and <strong>TAGE</strong>-style predictors blend many history lengths to top 99% accuracy. It matters because a
        misprediction throws away ~15-20 cycles of pipelined work — and mispredicted speculative execution is exactly the door Spectre walked
        through. (Smith 1981; Hennessy &amp; Patterson.)
      </p>
    </div>
  );
}
