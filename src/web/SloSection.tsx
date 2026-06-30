// SLOs & error budgets, made visible. Pick an availability target and see the error budget it implies
// (how much downtime per month you're ALLOWED). Spend it with the slider and watch the release policy
// flip from "ship features" to "freeze" when it's gone. The burn-rate panel turns a current error rate
// into how fast you're spending and which multiwindow alerts fire. Real math from slo.ts.
import { useMemo, useState } from 'react';
import { budget, burnRate, timeToExhaust, burnAlerts, releasePolicy } from './slo';

const WINDOW = 43200; // minutes in 30 days
const TARGETS = [0.99, 0.999, 0.9995, 0.9999];
const fmtMin = (m: number) => (m >= 60 ? `${(m / 60).toFixed(1)} h` : `${m.toFixed(1)} min`);

export function SloSection() {
  const [slo, setSlo] = useState(0.999);
  const [usedPct, setUsedPct] = useState(40);   // % of the budget already spent
  const [errRate, setErrRate] = useState(0.5);  // current error rate, %

  const allowed = (1 - slo) * WINDOW;
  const used = (usedPct / 100) * allowed;
  const b = useMemo(() => budget(slo, WINDOW, used), [slo, used]);
  const rate = useMemo(() => burnRate(errRate / 100, slo), [errRate, slo]);
  const tte = useMemo(() => timeToExhaust(b, rate, WINDOW), [b, rate]);
  const alerts = useMemo(() => burnAlerts(rate), [rate]);

  return (
    <div className="slo">
      <div className="slo-targets">
        <span className="slo-tlabel">SLO target</span>
        {TARGETS.map((t) => (
          <button key={t} type="button" className={`slo-target ${slo === t ? 'on' : ''}`} onClick={() => setSlo(t)}>{(t * 100).toFixed(t >= 0.9999 ? 2 : t >= 0.999 ? 2 : 0)}%</button>
        ))}
        <span className="slo-budget-info">→ error budget <b>{fmtMin(allowed)}</b> / 30 days</span>
      </div>

      <div className="slo-panel">
        <div className="slo-panel-h">error budget — permission to take risk</div>
        <div className="slo-bar">
          <div className="slo-used" style={{ width: `${Math.min(100, usedPct)}%` }} />
          <div className="slo-remain-lbl">{b.remainingPct.toFixed(0)}% left</div>
        </div>
        <label className="slo-slider">downtime spent this month <input type="range" min={0} max={120} value={usedPct} onChange={(e) => setUsedPct(+e.target.value)} /><b>{fmtMin(used)}</b></label>
        <div className={`slo-policy ${b.exhausted ? 'freeze' : 'ship'}`}>{releasePolicy(b)}</div>
      </div>

      <div className="slo-panel">
        <div className="slo-panel-h">burn rate — how fast you’re spending it</div>
        <label className="slo-slider">current error rate <input type="range" min={0} max={5} step={0.1} value={errRate} onChange={(e) => setErrRate(+e.target.value)} /><b>{errRate.toFixed(1)}%</b></label>
        <div className="slo-burn">
          <div className="slo-burn-big"><b className={rate > 6 ? 'bad' : rate > 1 ? 'warn' : 'ok'}>{rate.toFixed(1)}×</b> burn rate</div>
          <div className="slo-tte">budget gone in <b>{tte === Infinity ? '∞' : fmtMin(tte)}</b> at this rate</div>
        </div>
        <div className="slo-alerts">
          {alerts.map((a) => (
            <div key={a.label} className={`slo-alert ${a.firing ? 'firing' : ''}`}>
              <span className="slo-adot" />{a.label} (≥{a.threshold}× / {a.window}) — <span className="slo-asev">{a.severity}</span>{a.firing ? ' · FIRING' : ' · ok'}
            </div>
          ))}
        </div>
      </div>

      <p className="slo-foot">
        100% is the wrong target — it’s impossible, and chasing it means never shipping. An SLO instead names a number users won’t notice the
        difference below, and the <strong>error budget</strong> (1 − SLO) is the slack you get to spend on velocity: releases, migrations,
        experiments. While budget remains, ship freely; when it’s gone, the <strong>policy</strong> says stop feature work and pay down
        reliability. The <strong>burn rate</strong> makes alerting principled — page on a fast burn (an acute outage chewing the month’s budget in
        hours), open a ticket on a slow burn (a steady leak), and ignore noise that isn’t actually threatening the SLO. This is the contract that
        lets product and SRE share one number instead of arguing about “stability vs features.” (Google SRE Workbook.)
      </p>
    </div>
  );
}
