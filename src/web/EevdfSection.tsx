// Guided story: EEVDF (Earliest Eligible Virtual Deadline First) — the Linux 6.6 CPU scheduler that replaced CFS. Each
// task has a weight (from its nice value) and a virtual runtime v that advances slower the higher its weight. The
// weighted-average vruntime V is the fair frontier; a task's LAG = V − v (how much CPU it's owed). A task is ELIGIBLE
// only when lag ≥ 0 (it hasn't run ahead of its share); among eligible tasks the scheduler runs the one with the
// earliest VIRTUAL DEADLINE v + slice/weight — which bounds latency. Verified in node: the dispatched task is always
// eligible with the minimum deadline, Σ w·lag = 0 (conservation), and long-run CPU shares equal the weight fractions
// (1:2:4 → 14.3/28.6/57.1%). Complements [[cfs]] (CFS picks min-vruntime; EEVDF adds eligibility + deadlines). Sandboxed.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const WEIGHTS = [1, 2, 4]; const SLICE = 1;
type Snap = { V: number; v: number[]; svc: number[]; pick: number; step: number };
function build(steps: number): Snap[] {
  const n = WEIGHTS.length, W = WEIGHTS.reduce((a, b) => a + b, 0); const v = Array(n).fill(0), svc = Array(n).fill(0); const snaps: Snap[] = [];
  for (let s = 0; s < steps; s++) {
    const V = WEIGHTS.reduce((a, w, i) => a + w * v[i], 0) / W;
    const elig = [...Array(n).keys()].filter((i) => v[i] <= V + 1e-9); const pool = elig.length ? elig : [...Array(n).keys()];
    let pick = pool[0]; for (const i of pool) if (v[i] + SLICE / WEIGHTS[i] < v[pick] + SLICE / WEIGHTS[pick]) pick = i;
    snaps.push({ V, v: [...v], svc: [...svc], pick, step: s });
    v[pick] += SLICE / WEIGHTS[pick]; svc[pick] += SLICE;
  }
  return snaps;
}
const SNAPS = build(30);
const W = WEIGHTS.reduce((a, b) => a + b, 0);
const IDEAL = WEIGHTS.map((w) => w / W);
const HUE = [205, 150, 40];

type Phase = 'fair' | 'lag' | 'eligible' | 'deadline' | 'shares' | 'run';

export function EevdfSection() {
  const [step, setStep] = useState(SNAPS.length - 1);
  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string, st: number): StoryScene =>
    ({ key, title, caption, render: () => <Sched phase={key} step={st} /> });

  const scenes: StoryScene[] = [
    scene('fair', 'Share the CPU by weight', 'A scheduler must divide the CPU among runnable tasks in proportion to their weights — a task’s weight comes from its nice value, so a “heavier” task earns a bigger slice. Three tasks weighted 1 : 2 : 4 should end up with 1/7, 2/7, and 4/7 of the CPU. The question is how to hand out slices, moment to moment, so that ratio holds and no task waits too long.', 6),
    scene('lag', 'Virtual runtime and lag', 'Give each task a virtual runtime v that ticks up when it runs — but slower the heavier the task (v += slice / weight), so a weight-4 task’s clock crawls and it runs four times as often as a weight-1 task. The weighted-average v across all tasks is the fair frontier V. A task’s lag = V − v is how much CPU it’s owed: positive means behind (owed time), negative means it ran ahead. The weighted lags always sum to zero.', 8),
    scene('eligible', 'Eligible = not ahead of fair', 'EEVDF’s first rule: a task may run only if it is eligible — its lag ≥ 0, meaning its virtual runtime hasn’t passed the fair frontier V. A task that sprinted ahead of its share (negative lag, red) is benched until V catches up to it. That keeps any one task from monopolizing the CPU between fairness checks.', 8),
    scene('deadline', 'Earliest virtual deadline first', 'Among the eligible tasks, which runs? The one with the earliest virtual deadline: v + slice / weight, the virtual time by which it should have received its next slice. Picking the nearest deadline bounds how long any task waits — that’s the latency guarantee CFS lacked. (Verified: the dispatched task is always eligible AND has the minimum deadline.)', 8),
    scene('shares', 'Fair shares, low latency', 'Run it, its virtual runtime jumps forward (by slice/weight, so heavy tasks barely move), lag rebalances, and the next eligible-earliest-deadline task goes. Over time the CPU shares converge exactly to the weight fractions — 14.3% : 28.6% : 57.1% for 1 : 2 : 4 — while the deadline rule keeps every task’s wait short. This is the scheduler Linux has run since 6.6.', SNAPS.length - 1),
    { key: 'run', title: 'Step the scheduler', caption: 'Step through the scheduling decisions. The lag bars show who’s owed CPU (green, eligible) versus who ran ahead (red, benched); the gold task is the eligible one with the earliest virtual deadline, and it runs next. Watch the cumulative shares at the bottom lock onto 1 : 2 : 4 as the lags oscillate around zero.', render: () => <Sched phase="run" step={step} onStep={setStep} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <><strong>EEVDF</strong> (Earliest Eligible Virtual Deadline First) is the Linux CPU scheduler since 6.6. Each task has a <strong>virtual runtime</strong> that ticks up slower the higher its weight, so heavy tasks run more; the weighted-average vruntime <strong>V</strong> is the fair frontier, and a task’s <strong>lag</strong> = V − v is how much CPU it’s owed. A task is <strong>eligible</strong> only when its lag ≥ 0 (it hasn’t run past its share), and among eligible tasks the scheduler runs the one with the earliest <strong>virtual deadline</strong> — giving both proportional fairness and a latency bound.</>,
        takeaway: <><strong>EEVDF</strong> replaced CFS in Linux 6.6. As in CFS, each task has a weight w (derived from its nice value) and a <strong>virtual runtime</strong> v that advances by δ·(w₀/w) when it runs for real time δ — so a task with twice the weight accumulates vruntime half as fast and thus runs twice as much. The weighted-average vruntime <strong>V = (Σ wᵢvᵢ)/(Σ wᵢ)</strong> is the “fair” position, and a task’s <strong>lag</strong> is lagᵢ = V − vᵢ: positive means it is behind and owed CPU, negative means it got ahead. By construction Σ wᵢ·lagᵢ = 0 (conservation — the CPU handed out is exactly the CPU accounted for). EEVDF adds two rules CFS lacked. <strong>Eligibility:</strong> a task may be dispatched only if lagᵢ ≥ 0, i.e. it has not run past the fair frontier — this bounds how far ahead any task can get. <strong>Earliest virtual deadline:</strong> among eligible tasks, run the one whose virtual deadline vᵢ + slice/wᵢ is smallest — the virtual time by which it ought to have received its next slice; choosing the nearest deadline bounds latency, so a task that wants small, frequent slices (a request size it declares) gets low wakeup latency without sacrificing fairness. The result is provably proportional over the long run — CPU share → wᵢ/Σw (verified here: 1:2:4 converges to 14.3% / 28.6% / 57.1%, the dispatched task is always eligible with the minimum deadline, and Σ w·lag stays zero). Compared with CFS, which simply always ran the minimum-vruntime task, EEVDF’s explicit deadlines give a cleaner latency story and let tasks request different slice sizes, which is why the kernel switched. It’s a descendant of the 1995 EEVDF fair-queuing algorithm from networking, reused for CPU time.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="ee-ctl">
          <button type="button" className="ee-btn" onClick={() => setStep((v) => Math.max(0, v - 1))}>‹ back</button>
          <button type="button" className="ee-btn" onClick={() => setStep((v) => Math.min(SNAPS.length - 1, v + 1))}>schedule ›</button>
          <span className="ee-read">step {step + 1}/{SNAPS.length} · ran T{SNAPS[step].pick + 1}</span>
        </div>
      )}
    />
  );
}

function Sched({ phase, step, onStep }: { phase: Phase; step: number; onStep?: (n: number) => void }) {
  const on = (p: Phase) => phase === p;
  void onStep;
  const S = SNAPS[Math.min(step, SNAPS.length - 1)];
  const n = WEIGHTS.length;
  const totalSvc = S.svc.reduce((a, b) => a + b, 0) || 1;
  const CX = 300, rowY = (i: number) => 78 + i * 52, SC = 220; // lag scale
  const maxLag = Math.max(0.2, ...S.v.map((vi) => Math.abs(S.V - vi)));
  const showElig = on('eligible') || on('deadline') || on('run');
  const eligible = (i: number) => S.v[i] <= S.V + 1e-9;
  return (
    <svg viewBox="0 0 760 320" className="story-svg">
      <text x="56" y="22" className="ee-col">EEVDF · weights {WEIGHTS.join(':')} · fair frontier V={S.V.toFixed(2)} · ran T{S.pick + 1}</text>

      {/* zero line (fair frontier) */}
      <line x1={CX} y1={58} x2={CX} y2={rowY(n - 1) + 18} className="ee-zero" />
      <text x={CX} y={52} className="ee-lbl" textAnchor="middle">V (fair)</text>

      {WEIGHTS.map((w, i) => { const lag = S.V - S.v[i]; const bw = (lag / maxLag) * SC; const elig = eligible(i); const isPick = i === S.pick;
        const vd = S.v[i] + SLICE / w;
        return <g key={i}>
          <text x={64} y={rowY(i) + 5} className="ee-tn" style={{ fill: `hsl(${HUE[i]} 65% 62%)` }}>T{i + 1}</text>
          <text x={96} y={rowY(i) + 5} className="ee-w">w{w}</text>
          {/* lag bar: right = owed (eligible), left = ran ahead */}
          <rect x={lag >= 0 ? CX : CX + bw} y={rowY(i) - 11} width={Math.abs(bw)} height={22} rx="3" className={`ee-lag ${lag >= 0 ? 'owed' : 'ahead'} ${isPick && showElig ? 'pick' : ''}`} />
          <text x={lag >= 0 ? CX + bw + 6 : CX + bw - 6} y={rowY(i) + 5} className="ee-lagv" textAnchor={lag >= 0 ? 'start' : 'end'}>lag {lag >= 0 ? '+' : ''}{lag.toFixed(2)}</text>
          {(on('deadline') || on('run')) && <text x={CX + SC + 70} y={rowY(i) + 5} className={`ee-vd ${isPick ? 'pick' : ''} ${!elig ? 'inelig' : ''}`}>vd {vd.toFixed(2)}{isPick ? ' ◄' : ''}</text>}
          {showElig && !elig && <text x={CX - SC - 8} y={rowY(i) + 5} className="ee-bench" textAnchor="end">benched</text>}
        </g>; })}
      {(on('deadline') || on('run')) && <text x={CX + SC + 70} y={58} className="ee-lbl">deadline v+slice/w</text>}

      {/* cumulative shares vs ideal */}
      <text x={64} y={252} className="ee-lbl">CPU share (→ weight fraction)</text>
      {WEIGHTS.map((_w, i) => { const sh = S.svc[i] / totalSvc; const y = 262; const x = 64 + i * 210;
        return <g key={i}>
          <rect x={x} y={y} width={180} height={16} className="ee-sharebg" />
          <rect x={x} y={y} width={180 * sh} height={16} style={{ fill: `hsl(${HUE[i]} 55% 50%)` }} />
          <line x1={x + 180 * IDEAL[i]} y1={y - 2} x2={x + 180 * IDEAL[i]} y2={y + 18} className="ee-ideal" />
          <text x={x + 4} y={y + 12} className="ee-sharel">T{i + 1} {(sh * 100).toFixed(0)}% / {(IDEAL[i] * 100).toFixed(0)}%</text>
        </g>; })}

      <text x="380" y="306" className="ee-foot" textAnchor="middle">
        {on('fair') ? 'weights 1:2:4 → target CPU shares 1/7, 2/7, 4/7'
          : on('lag') ? 'lag = V − v: + owed (behind), − ran ahead; Σ w·lag = 0'
          : on('eligible') ? 'eligible only if lag ≥ 0 — tasks that ran ahead are benched'
          : on('deadline') ? 'among eligible, run the earliest virtual deadline (gold ◄)'
          : on('shares') ? 'shares converge to 14% : 29% : 57% with bounded latency'
          : `ran T${S.pick + 1} · shares ${S.svc.map((s) => Math.round(s / totalSvc * 100)).join(':')}% → target ${WEIGHTS.map((w) => Math.round(w / W * 100)).join(':')}%`}
      </text>
    </svg>
  );
}
