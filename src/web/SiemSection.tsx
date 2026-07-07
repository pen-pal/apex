// SIEM log correlation — you tune the detection rule. A stream of login events from several sources scrolls across
// a set of swimlanes; hidden in the benign noise is a brute-force burst from one IP. Slide the threshold K and the
// window W and watch the correlation rule fire: too tight and it misses the attack, too loose and ordinary typo
// bursts trip false alarms. The sweet spot catches the attacker and nothing else. Real windowed model in siem.ts.
import { useMemo, useState } from 'react';
import { correlate, score, type Event } from './siem';

const MAXT = 260;
const fail = (t: number, src: string, attack = false): Event => ({ t, src, kind: 'fail', attack });
const ok = (t: number, src: string): Event => ({ t, src, kind: 'ok' });

// One real brute-force burst (203.0.113.9, 8 fails then a success) hidden among benign users, two of whom have small
// typo bursts (bob ×3, carol ×4) that bait a too-low threshold.
const EVENTS: Event[] = [
  ok(5, 'alice'), ok(20, 'dave'), fail(35, 'alice'), ok(37, 'alice'),
  fail(50, 'bob'), fail(51, 'bob'), fail(52, 'bob'), ok(53, 'bob'),
  ok(90, 'alice'), ok(110, 'dave'),
  fail(120, '203.0.113.9', true), fail(122, '203.0.113.9', true), fail(124, '203.0.113.9', true), fail(126, '203.0.113.9', true),
  fail(128, '203.0.113.9', true), fail(130, '203.0.113.9', true), fail(132, '203.0.113.9', true), fail(134, '203.0.113.9', true),
  ok(136, '203.0.113.9'),
  ok(160, 'dave'), ok(180, 'alice'),
  fail(200, 'carol'), fail(201, 'carol'), fail(202, 'carol'), fail(203, 'carol'), ok(204, 'carol'),
  ok(230, 'dave'), ok(250, 'alice'),
];
const SOURCES = ['alice', 'bob', 'carol', 'dave', '203.0.113.9'];

export function SiemSection() {
  const [k, setK] = useState(3);
  const [w, setW] = useState(20);

  const alerts = useMemo(() => correlate(EVENTS, { k, window: w }), [k, w]);
  const s = useMemo(() => score(EVENTS, { k, window: w }), [k, w]);
  const alertBySrc = useMemo(() => new Map(alerts.map((a) => [a.src, a])), [alerts]);
  const attackSrcs = useMemo(() => new Set(EVENTS.filter((e) => e.attack).map((e) => e.src)), []);
  const clean = s.detected && s.falsePos === 0;
  const x = (t: number) => `${(t / MAXT) * 100}%`;

  return (
    <div className="siem">
      <div className="siem-controls">
        <label className="siem-slider"><span>threshold&nbsp;<b>K = {k}</b> failures</span>
          <input type="range" min={2} max={10} value={k} onChange={(e) => setK(+e.target.value)} /></label>
        <label className="siem-slider"><span>window&nbsp;<b>W = {w}s</b></span>
          <input type="range" min={5} max={120} step={5} value={w} onChange={(e) => setW(+e.target.value)} /></label>
        <span className="siem-rule">rule: ≥ K failed logins from one source within W seconds → alert</span>
      </div>

      <div className="siem-lanes">
        {SOURCES.map((src) => {
          const evs = EVENTS.filter((e) => e.src === src);
          const alert = alertBySrc.get(src);
          const isAttack = attackSrcs.has(src);
          const state = alert ? (isAttack ? 'siem-caught' : 'siem-falsepos') : (isAttack ? 'siem-missed' : '');
          return (
            <div key={src} className={`siem-lane ${state}`}>
              <div className="siem-lane-lbl">
                <code>{src}</code>
                {alert && <span className={`siem-flag ${isAttack ? 'siem-caught' : 'siem-falsepos'}`}>⚠ {alert.compromised ? 'compromised' : 'brute-force'}</span>}
                {!alert && isAttack && <span className="siem-flag siem-missed">missed</span>}
              </div>
              <div className="siem-track">
                {evs.map((e, i) => (
                  <span key={i} className={`siem-ev siem-${e.kind}`} style={{ left: x(e.t) }} title={`${e.kind} @ ${e.t}s`} />
                ))}
              </div>
            </div>
          );
        })}
        <div className="siem-axis"><span>0s</span><span>time →</span><span>{MAXT}s</span></div>
      </div>

      <div className={`siem-verdict ${clean ? 'siem-clean' : s.detected ? 'siem-noisy' : 'siem-blind'}`}>
        <div className="siem-scores">
          <span className={s.detected ? 'siem-good' : 'siem-bad'}>attacker: {s.detected ? 'caught' : 'MISSED'}</span>
          <span className={s.falsePos ? 'siem-bad' : 'siem-good'}>false alarms: {s.falsePos}</span>
        </div>
        <p className="siem-verdict-txt">
          {clean
            ? 'Tuned right — the brute-force burst is flagged and no benign user is. K high enough to clear the typo bursts, W wide enough to span the attack.'
            : !s.detected
              ? 'Too tight. The attacker made 8 attempts over 14s; with K/W this strict, the burst never fills the window and the compromise slips through — a false negative, the dangerous kind.'
              : `Detected, but ${s.falsePos} benign ${s.falsePos === 1 ? 'user is' : 'users are'} flagged too. A too-low K treats ordinary password typos as an attack; every false alarm is analyst time burned and a real alert more likely ignored. Raise K.`}
        </p>
      </div>

      <div className="siem-legend"><span><i className="siem-ev siem-fail" /> failed login</span><span><i className="siem-ev siem-ok" /> success</span><span>one lane per source</span></div>

      <p className="siem-foot">
        A single failed login means nothing; <strong>correlated</strong> across a window it's an attack. This is what a
        <strong> SIEM</strong> does — ingest logs from every host and run rules like this over a sliding window (the same
        shape detects port scans, data exfiltration, and impossible-travel logins). The hard part isn't the rule, it's the
        <strong> tuning</strong>: too sensitive drowns analysts in false positives until they mute the alert; too strict
        misses the breach. Real deployments add <strong>allowlists</strong>, per-source baselines, and rate-based scoring to
        widen that gap. (MITRE ATT&CK: Credential Access · T1110 Brute Force.)
      </p>
    </div>
  );
}
