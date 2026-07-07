// IDS/IPS — signature vs anomaly detection, and the tradeoff. A fixed stream of traffic (normal, known attacks,
// novel attacks) is scanned by the chosen detector; each event shows caught / missed / false-alarm, with a running
// tally. Auto-plays a scan head down the stream; toggle the detector and the anomaly threshold. Model in ids.ts.
import { useEffect, useState } from 'react';
import { signatureFlags, anomalyFlags, isAttack, outcome, type Event, type Outcome } from './ids';

const EVENTS: Event[] = [
  { id: 'e1', kind: 'normal', desc: 'user loads the dashboard', anomaly: 0.08 },
  { id: 'e2', kind: 'known', desc: "SQL injection — ' OR 1=1 -- in the login form", anomaly: 0.82 },
  { id: 'e3', kind: 'normal', desc: 'nightly backup — a big, unusual transfer', anomaly: 0.71 },
  { id: 'e4', kind: 'novel', desc: 'zero-day RCE — a payload no signature has seen', anomaly: 0.9 },
  { id: 'e5', kind: 'known', desc: 'EternalBlue SMB exploit (a known CVE)', anomaly: 0.86 },
  { id: 'e6', kind: 'normal', desc: 'the CEO logs in from abroad on a new device', anomaly: 0.76 },
  { id: 'e7', kind: 'novel', desc: 'custom C2 beacon — low and slow, stays quiet', anomaly: 0.5 },
  { id: 'e8', kind: 'normal', desc: 'load-balancer health check', anomaly: 0.04 },
];
type Mode = 'signature' | 'anomaly' | 'both';
const OUT_LABEL: Record<Outcome, string> = { 'true-positive': 'caught', 'false-negative': 'MISSED', 'false-positive': 'false alarm', 'true-negative': 'clean' };
const KIND_ICON: Record<string, string> = { normal: '🟢', known: '🔴', novel: '🟣' };

function flagged(e: Event, mode: Mode, thr: number) {
  const sig = mode !== 'anomaly' && signatureFlags(e);
  const ano = mode !== 'signature' && anomalyFlags(e, thr);
  return sig || ano;
}

export function IdsSection() {
  const [mode, setMode] = useState<Mode>('signature');
  const [thr, setThr] = useState(0.7);
  const [scan, setScan] = useState(0);
  const [playing, setPlaying] = useState(true);
  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => setScan((s) => (s + 1) % (EVENTS.length + 2)), 600);
    return () => clearTimeout(t);
  }, [playing, scan]);

  const rows = EVENTS.map((e) => {
    const f = flagged(e, mode, thr);
    return { e, out: outcome(f, isAttack(e)) };
  });
  const attacks = EVENTS.filter(isAttack).length;
  const caught = rows.filter((r) => r.out === 'true-positive').length;
  const missed = rows.filter((r) => r.out === 'false-negative').length;
  const falseAlarms = rows.filter((r) => r.out === 'false-positive').length;

  return (
    <div className="ids">
      <p className="ids-intro">
        An intrusion detector watches traffic and raises alarms. There are two ways to do it, and they fail in opposite
        directions. A <strong>signature</strong> detector matches each packet against a database of known-attack patterns —
        precise, but blind to anything new. An <strong>anomaly</strong> detector learns what “normal” looks like and flags
        deviations — it can catch a brand-new attack, but it cries wolf at unusual-but-innocent traffic. Switch detectors and
        watch the same stream get judged differently. (An <strong>IPS</strong> is this same detection sitting inline, blocking
        instead of just alerting.)
      </p>

      <div className="ids-controls">
        <span className="ids-seg">detector
          {(['signature', 'anomaly', 'both'] as Mode[]).map((m) => (
            <button key={m} type="button" className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>{m}</button>
          ))}
        </span>
        <label className={`ids-thr ${mode === 'signature' ? 'off' : ''}`}>anomaly threshold {thr.toFixed(2)}
          <input type="range" min={0.3} max={0.95} step={0.01} value={thr} disabled={mode === 'signature'} onChange={(e) => setThr(+e.target.value)} />
        </label>
        <button type="button" className={`ids-play ${playing ? 'on' : ''}`} onClick={() => setPlaying((p) => !p)}>{playing ? '❚❚' : '▶'}</button>
      </div>

      <div className="ids-stream">
        {rows.map(({ e, out }, i) => (
          <div key={e.id} className={`ids-row ${out} ${i === scan ? 'scanning' : ''}`}>
            <span className="ids-kind">{KIND_ICON[e.kind]}</span>
            <span className="ids-desc">{e.desc}</span>
            <span className="ids-bar" title={`anomaly ${e.anomaly.toFixed(2)}`}><span className="ids-bar-fill" style={{ width: `${e.anomaly * 100}%` }} /></span>
            <span className={`ids-verdict ${out}`}>{OUT_LABEL[out]}</span>
          </div>
        ))}
      </div>

      <div className="ids-tally">
        <span className="ids-t caught">caught <b>{caught}/{attacks}</b> attacks</span>
        <span className="ids-t missed">missed <b>{missed}</b></span>
        <span className="ids-t fa">false alarms <b>{falseAlarms}</b></span>
      </div>

      <p className="ids-foot">
        There’s the whole tension. <strong>Signature</strong> catches the known SQLi and EternalBlue exactly and never
        false-alarms — but the zero-day and the custom C2 sail straight through, because no signature exists for them yet.
        <strong> Anomaly</strong> flags the zero-day on its strangeness, but also lights up the nightly backup and the CEO’s
        foreign login (rare ≠ malicious), and if you raise the threshold to silence those, the low-and-slow beacon slips
        under it. Real systems run <strong>both</strong>, tune the threshold against the analysts’ alert budget, and increasingly
        add ML-based behavioral baselines — but nothing escapes the precision-vs-recall tradeoff. (Snort/Suricata signatures;
        anomaly-based IDS.)
      </p>
    </div>
  );
}
