// Feature flags, made visible. A population of users, one flag. Drag the rollout slider and watch users
// flip ON in a stable order (never back off — that's the monotonic, sticky-bucket property); add a
// targeting rule to force a cohort on regardless of the percentage; hit the kill switch and everyone
// goes off instantly, no redeploy. Click a user to see exactly why they got their answer. Real
// evaluation from featureflags.ts.
import { useMemo, useState } from 'react';
import { evaluate, type Flag, type User } from './featureflags';

const COUNTRIES = ['US', 'CA', 'UK'];
const USERS: User[] = Array.from({ length: 24 }, (_, i) => ({ id: `user-${i}`, country: COUNTRIES[i % 3], plan: i % 5 === 0 ? 'beta' : 'free' }));

export function FeatureFlagSection() {
  const [enabled, setEnabled] = useState(true);
  const [rollout, setRollout] = useState(25);
  const [targetBeta, setTargetBeta] = useState(false);
  const [sel, setSel] = useState<string>('user-0');

  const flag: Flag = useMemo(() => ({
    key: 'new-checkout', enabled, rolloutPercent: rollout,
    rules: targetBeta ? [{ attribute: 'plan', value: 'beta', result: true }] : [],
  }), [enabled, rollout, targetBeta]);

  const evals = useMemo(() => USERS.map((u) => ({ u, e: evaluate(flag, u) })), [flag]);
  const onCount = evals.filter((x) => x.e.on).length;
  const selUser = USERS.find((u) => u.id === sel)!;
  const selEval = evaluate(flag, selUser);

  return (
    <div className="flg">
      <div className="flg-controls">
        <label className="flg-kill"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> flag enabled <span className="flg-killnote">(uncheck = kill switch)</span></label>
        <label className="flg-roll">rollout <input type="range" min={0} max={100} value={rollout} disabled={!enabled} onChange={(e) => setRollout(+e.target.value)} /><b>{rollout}%</b></label>
        <label className="flg-target"><input type="checkbox" checked={targetBeta} onChange={(e) => setTargetBeta(e.target.checked)} /> targeting rule: plan = beta → on</label>
      </div>

      <div className="flg-pop">
        {evals.map(({ u, e }) => (
          <button key={u.id} type="button" className={`flg-user ${e.on ? 'on' : 'off'} ${sel === u.id ? 'sel' : ''}`} onClick={() => setSel(u.id)} title={`${u.id} · ${u.country} · ${u.plan} · bucket ${e.bucket}`}>
            <span className="flg-uid">{u.id.replace('user-', 'u')}</span>
            <span className="flg-ub">{e.bucket}</span>
          </button>
        ))}
      </div>

      <div className="flg-stat"><b>{onCount}/{USERS.length}</b> users see the feature ({Math.round((onCount / USERS.length) * 100)}%)</div>

      <div className="flg-detail">
        <div className="flg-detail-h">{selUser.id} · country {selUser.country} · plan {selUser.plan} · bucket {selEval.bucket}</div>
        <div className={`flg-verdict ${selEval.on ? 'on' : 'off'}`}>{selEval.on ? '✓ feature ON' : '✗ feature OFF'} — {selEval.reason}</div>
      </div>

      <p className="flg-foot">
        Because the deploy already shipped the code, turning a feature on or off is a config change that takes effect in seconds — no build, no
        release, no rollback. That enables <strong>progressive delivery</strong> (ramp 1% → 5% → 100% while watching your SLOs), <strong>targeted
        betas</strong> (rules by plan, region, or account), <strong>A/B experiments</strong> (bucket users into variants), and an instant
        <strong> kill switch</strong> when something breaks. The bucket is a stable hash of (flag, user), so a user’s experience doesn’t flicker
        between requests and raising the percentage only ever adds users. The cost is discipline: every flag is a branch in production, so they
        need owners and a cleanup process or they rot into a combinatorial mess. (LaunchDarkly / Unleash / Flagger; Humble &amp; Farley.)
      </p>
    </div>
  );
}
