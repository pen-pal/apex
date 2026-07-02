// Guided story: how a Kalman filter tracks a moving thing from noisy measurements — fuse a prediction (from a motion
// model) with a measurement, weighted by their uncertainties (the Kalman gain), to beat either alone. Real 1D
// constant-velocity Kalman (verified in node: RMSE 2.23 measurements → 1.29 estimate). Deterministic noise so the plot
// is stable; the R/Q sliders change how the filter trusts sensor vs model. Pairs with GPS (which uses a Kalman to
// smooth position). Sandboxed/CONCEPTUAL; the optimal linear estimator under Gaussian noise.
import { useMemo, useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const N = 48;
const truePos = (t: number) => (t < 24 ? 1.4 * t : 1.4 * 24 + 0.35 * (t - 24)); // moves, then a gentle maneuver
const noise = (t: number) => { let s = Math.sin(t * 12.9898) * 43758.5453; s -= Math.floor(s); return (s - 0.5) * 9; }; // deterministic ±4.5
const MEAS = Array.from({ length: N + 1 }, (_, t) => truePos(t) + noise(t));

type Step = { pred: number; est: number; P: number; K: number };
function kalman(R: number, Q: number): { steps: Step[]; rmseMeas: number; rmseEst: number } {
  let p = 0, v = 0, P00 = 20, P01 = 0, P10 = 0, P11 = 20; const steps: Step[] = [];
  let sM = 0, sE = 0;
  for (let t = 1; t <= N; t++) {
    // predict (F = [[1,1],[0,1]])
    p = p + v; const a = P00 + P01 + P10 + P11 + Q, b = P01 + P11, c = P10 + P11, d = P11 + Q;
    P00 = a; P01 = b; P10 = c; P11 = d; const pred = p;
    // update with measurement (H = [1,0])
    const S = P00 + R, K0 = P00 / S, K1 = P10 / S, y = MEAS[t] - p;
    p += K0 * y; v += K1 * y;
    const n00 = (1 - K0) * P00, n01 = (1 - K0) * P01, n10 = P10 - K1 * P00, n11 = P11 - K1 * P01;
    P00 = n00; P01 = n01; P10 = n10; P11 = n11;
    steps.push({ pred, est: p, P: P00, K: K0 });
    const tp = truePos(t); sM += (MEAS[t] - tp) ** 2; sE += (p - tp) ** 2;
  }
  return { steps, rmseMeas: Math.sqrt(sM / N), rmseEst: Math.sqrt(sE / N) };
}

const OX = 70, OW = 770, OY = 350, OH = 290, PMIN = -6, PMAX = 46;
const tx = (t: number) => OX + (t / N) * OW;
const py = (p: number) => OY - (Math.max(PMIN, Math.min(PMAX, p)) - PMIN) / (PMAX - PMIN) * OH;

type Phase = 'fuse' | 'predict' | 'correct' | 'gain' | 'beat' | 'run';

export function KalmanSection() {
  const [R, setR] = useState(16);
  const [Q, setQ] = useState(0.05);
  const model = useMemo(() => kalman(R, Q), [R, Q]);
  const still = useMemo(() => kalman(16, 0.05), []);

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <KF phase={key} m={still} /> });

  const scenes: StoryScene[] = [
    scene('fuse', 'Two unreliable sources, one good answer', 'You’re tracking something — a plane on radar, your GPS dot, a finger on a touchscreen. You have a sensor that is noisy, and a physics model that says the thing keeps moving but drifts over time. Neither alone is trustworthy. A Kalman filter fuses them, step by step, into an estimate better than either.'),
    scene('predict', 'Predict from the motion model', 'Between measurements, predict where the thing should be from its current position and velocity. Your model isn’t perfect, so with every prediction your uncertainty about the true position grows — the shaded band around the estimate widens.'),
    scene('correct', 'Correct with the measurement', 'A new, noisy measurement arrives (grey dot). It disagrees with your prediction by some amount — the residual. You don’t jump to the measurement and you don’t ignore it; you move the estimate a fraction of the way toward it, and that fraction is the Kalman gain.'),
    scene('gain', 'The gain weighs the uncertainties', 'The gain is set by comparing the two uncertainties: K = prediction-uncertainty ÷ (prediction-uncertainty + sensor-noise). A noisy sensor gives a small gain — trust the model, move slowly. A shaky model gives a large gain — trust the sensor, react fast. Either way, fusing them shrinks the uncertainty below both.'),
    scene('beat', 'The estimate beats the raw sensor', 'Run it and the smooth estimate (line) hugs the true path while the raw measurements (dots) scatter around it — here the estimate’s error is roughly half the sensor’s. Under Gaussian noise this is provably the optimal linear estimate, which is why it flew on Apollo and now smooths your GPS, stabilises drones, and fuses your phone’s accelerometer and gyro.'),
    { key: 'run', title: 'Trust the sensor or the model?', caption: 'Turn up the sensor noise (R) and the filter leans on its motion model — smoother, but it lags a change. Turn up the process noise (Q) and it leans on the sensor — twitchier, but it reacts fast. Watch the Kalman gain and the estimate respond, and the estimate’s error stay below the raw sensor’s.', render: () => <KF phase="run" m={model} R={R} Q={Q} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>You’re tracking something — a plane on radar, your GPS position, a finger on a touchscreen — with two unreliable sources: a sensor that’s noisy, and a physics model that says the thing keeps moving but drifts over time. A Kalman filter fuses them every step: predict where the thing should be from its motion, then correct that prediction with the new measurement, weighting the two by how much you trust each. The result is more accurate than the sensor and smoother than the raw data.</>,
        takeaway: <>Each step is <strong>predict</strong> then <strong>update</strong>. Predict: advance the state by its velocity and let the uncertainty grow by the process noise. Update: the new measurement disagrees with the prediction by a residual, and you move the estimate a fraction of the way toward it — that fraction is the <strong>Kalman gain</strong>, K = prediction-uncertainty ÷ (prediction-uncertainty + sensor-noise). A noisy sensor (large R) gives a small gain, so you trust the model and move slowly; a shaky model (large Q) gives a large gain, so you trust the sensor and react fast. Fusing the two always shrinks the uncertainty below either one alone, and under Gaussian noise this is provably the <em>optimal</em> linear estimate — which is why it’s everywhere: it flew Apollo to the Moon, and today it smooths GPS, stabilises drones, and fuses the accelerometer and gyro in every phone.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <>
          <label className="klm-ctl">sensor noise R<input type="range" min={2} max={60} value={R} onChange={(e) => setR(+e.target.value)} /><b>{R}</b></label>
          <label className="klm-ctl">process noise Q<input type="range" min={0.01} max={2} step={0.01} value={Q} onChange={(e) => setQ(+e.target.value)} /><b>{Q.toFixed(2)}</b></label>
          <span className="klm-live">gain {model.steps[N - 1].K.toFixed(2)} · error {model.rmseEst.toFixed(1)} vs sensor {model.rmseMeas.toFixed(1)}</span>
        </>
      )}
    />
  );
}

function KF({ phase, m, R, Q }: { phase: Phase; m: ReturnType<typeof kalman>; R?: number; Q?: number }) {
  const on = (p: Phase) => phase === p;
  void R; void Q;
  const focus = 15; // the step whose predict/correct we call out
  const truePts = Array.from({ length: N + 1 }, (_, t) => `${tx(t).toFixed(1)},${py(truePos(t)).toFixed(1)}`);
  const estPts = m.steps.map((s, i) => `${tx(i + 1).toFixed(1)},${py(s.est).toFixed(1)}`);
  const bandUp = m.steps.map((s, i) => `${tx(i + 1).toFixed(1)},${py(s.est + 1.5 * Math.sqrt(s.P)).toFixed(1)}`);
  const bandDn = m.steps.map((s, i) => `${tx(i + 1).toFixed(1)},${py(s.est - 1.5 * Math.sqrt(s.P)).toFixed(1)}`).reverse();
  const showBand = on('predict') || on('gain') || on('beat') || on('run');
  const showEst = !on('fuse');
  const showFocus = on('predict') || on('correct') || on('gain');
  const fs = m.steps[focus - 1];
  return (
    <svg viewBox="0 0 900 480" className="story-svg">
      <text x="60" y="34" className="klm-col">position over time — sensor (dots), truth (green), Kalman estimate (amber)</text>
      <line x1={OX} y1={OY} x2={OX + OW} y2={OY} className="klm-axis" />
      <text x={OX} y={OY + 18} className="klm-tick">t=0</text><text x={OX + OW} y={OY + 18} className="klm-tick" textAnchor="end">time →</text>

      {/* uncertainty band */}
      {showBand && <polygon points={[...bandUp, ...bandDn].join(' ')} className="klm-band" />}
      {/* truth */}
      <polyline points={truePts.join(' ')} className="klm-true" fill="none" />
      {/* measurements */}
      {MEAS.map((z, t) => t >= 1 ? <circle key={t} cx={tx(t)} cy={py(z)} r="2.6" className="klm-meas" /> : null)}
      {/* estimate */}
      {showEst && <polyline points={estPts.join(' ')} className="klm-est" fill="none" />}

      {/* one predict/correct callout */}
      {showFocus && fs && (
        <g>
          <circle cx={tx(focus)} cy={py(fs.pred)} r="6" className="klm-pred" />
          <circle cx={tx(focus)} cy={py(MEAS[focus])} r="5" className="klm-mfocus" />
          <circle cx={tx(focus)} cy={py(fs.est)} r="5" className="klm-efocus" />
          {on('predict') && <text x={tx(focus) + 12} y={py(fs.pred) - 4} className="klm-lbl">prediction</text>}
          {on('correct') && <><line x1={tx(focus)} y1={py(fs.pred)} x2={tx(focus)} y2={py(MEAS[focus])} className="klm-resid" /><text x={tx(focus) + 12} y={py(MEAS[focus]) + 4} className="klm-lbl">measurement</text><text x={tx(focus) + 12} y={py(fs.est)} className="klm-lbl est">→ estimate</text></>}
          {on('gain') && <text x={tx(focus) + 12} y={py(fs.est)} className="klm-lbl est">K = {fs.K.toFixed(2)}</text>}
        </g>
      )}

      <text x="450" y="452" className="klm-foot" textAnchor="middle">
        {on('fuse') ? 'noisy sensor + a drifting model → fuse them into something better than both'
          : on('predict') ? 'each prediction widens the uncertainty band (grows by the process noise Q)'
          : on('correct') ? 'move a fraction of the way from prediction to measurement — the Kalman gain'
          : on('gain') ? 'K = P / (P + R): small when the sensor is noisy, large when the model is shaky'
          : on('beat') ? `estimate error ${m.rmseEst.toFixed(1)} vs raw sensor ${m.rmseMeas.toFixed(1)} — the optimal linear estimate`
          : `gain ${m.steps[N - 1].K.toFixed(2)} · estimate error ${m.rmseEst.toFixed(1)} vs sensor ${m.rmseMeas.toFixed(1)}`}
      </text>
    </svg>
  );
}
