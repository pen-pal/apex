// Honeypot — why a decoy beats a volume alarm. A little network of real services plus one decoy; benign users hit
// the real services (the backup job is chatty), and an attacker scans everything. Two detectors run side by side: a
// threshold IDS that flags any source making enough connections, and the honeypot that flags any source touching the
// decoy. The honeypot has zero false positives (nothing legit touches a decoy) — but only catches the attacker if the
// decoy is convincing enough to be probed. Tune realism vs the attacker's skill. Real model + tests in honeypot.ts.
import { useMemo, useState } from 'react';
import { honeypotDetect, idsDetect, confusion, attackerProbesDecoy, type Conn } from './honeypot';

const DECOY = 'decoy';
const HOSTS = ['web', 'db', 'backup'];
const BASE: Conn[] = [
  { src: 'alice', dst: 'web' }, { src: 'alice', dst: 'web' },
  { src: 'backup-job', dst: 'db' }, { src: 'backup-job', dst: 'db' }, { src: 'backup-job', dst: 'db' }, { src: 'backup-job', dst: 'db' },
  { src: 'attacker', dst: 'web', attack: true }, { src: 'attacker', dst: 'db', attack: true }, { src: 'attacker', dst: 'backup', attack: true },
];
const SRC_CLASS: Record<string, string> = { alice: 'hpot-user', 'backup-job': 'hpot-job', attacker: 'hpot-atk' };
const REALISM = ['low', 'medium', 'high'];

export function HoneypotSection() {
  const [deployed, setDeployed] = useState(true);
  const [realism, setRealism] = useState(1); // index into REALISM (1 = medium)
  const [skill, setSkill] = useState(2);     // attacker fingerprinting skill 1..3 (here shown 1-indexed)
  const [t, setT] = useState(4);

  const probes = attackerProbesDecoy(realism + 1, skill);
  const conns = useMemo(
    () => (deployed && probes ? [...BASE, { src: 'attacker', dst: DECOY, attack: true } as Conn] : BASE),
    [deployed, probes],
  );
  const hpAlerts = deployed ? honeypotDetect(conns, DECOY) : [];
  const idsAlerts = idsDetect(conns, t);
  const hp = confusion(conns, hpAlerts);
  const ids = confusion(conns, idsAlerts);
  const nodes = deployed ? [...HOSTS, DECOY] : HOSTS;

  return (
    <div className="hpot">
      <div className="hpot-controls">
        <button type="button" className={`hpot-deploy ${deployed ? 'on' : ''}`} onClick={() => setDeployed((d) => !d)}>
          {deployed ? '✓ honeypot deployed' : 'deploy a honeypot'}
        </button>
        <label className="hpot-slider"><span>decoy realism&nbsp;<b>{REALISM[realism]}</b></span>
          <input type="range" min={0} max={2} value={realism} onChange={(e) => setRealism(+e.target.value)} disabled={!deployed} /></label>
        <label className="hpot-slider"><span>attacker skill&nbsp;<b>{skill}</b></span>
          <input type="range" min={1} max={3} value={skill} onChange={(e) => setSkill(+e.target.value)} /></label>
        <label className="hpot-slider"><span>IDS threshold&nbsp;<b>T = {t}</b></span>
          <input type="range" min={2} max={6} value={t} onChange={(e) => setT(+e.target.value)} /></label>
      </div>

      <div className="hpot-net">
        {nodes.map((h) => {
          const isDecoy = h === DECOY;
          const hits = conns.filter((c) => c.dst === h);
          const tripped = isDecoy && hits.length > 0;
          return (
            <div key={h} className={`hpot-host ${isDecoy ? 'hpot-decoy' : ''} ${tripped ? 'hpot-tripped' : ''}`}>
              <div className="hpot-host-top"><span className="hpot-ico">{isDecoy ? '🍯' : '🖥'}</span><code>{h}</code></div>
              {isDecoy && <span className="hpot-tag">decoy · no real users</span>}
              <div className="hpot-dots">
                {hits.map((c, i) => <span key={i} className={`hpot-dot ${SRC_CLASS[c.src] ?? ''}`} title={c.src} />)}
              </div>
              {tripped && <span className="hpot-trip">⚠ tripped by attacker</span>}
            </div>
          );
        })}
      </div>
      <div className="hpot-legend">
        <span><i className="hpot-dot hpot-user" /> alice (user)</span>
        <span><i className="hpot-dot hpot-job" /> backup-job (benign, chatty)</span>
        <span><i className="hpot-dot hpot-atk" /> attacker (scanning)</span>
      </div>

      <div className="hpot-scores">
        <div className={`hpot-score ${deployed && hp.tp && !hp.fp ? 'hpot-good' : deployed && hp.fn ? 'hpot-warn' : ''}`}>
          <div className="hpot-score-h">🍯 honeypot</div>
          <div className="hpot-score-row"><span>caught attacker</span><b className={hp.tp ? 'hpot-y' : 'hpot-n'}>{hp.tp ? 'yes' : 'no'}</b></div>
          <div className="hpot-score-row"><span>false alarms</span><b className={hp.fp ? 'hpot-n' : 'hpot-y'}>{deployed ? hp.fp : '—'}</b></div>
          <p className="hpot-score-note">{!deployed ? 'not deployed.' : probes ? 'By construction it can’t false-alarm — nothing legitimate touches a decoy.' : 'Too fake: the attacker fingerprinted it and skipped. Zero false alarms, but it caught nothing — raise realism.'}</p>
        </div>
        <div className={`hpot-score ${ids.fp ? 'hpot-warn' : ids.tp ? 'hpot-good' : ''}`}>
          <div className="hpot-score-h">📈 threshold IDS (T = {t})</div>
          <div className="hpot-score-row"><span>caught attacker</span><b className={ids.tp ? 'hpot-y' : 'hpot-n'}>{ids.tp ? 'yes' : 'no'}</b></div>
          <div className="hpot-score-row"><span>false alarms</span><b className={ids.fp ? 'hpot-n' : 'hpot-y'}>{ids.fp}</b></div>
          <p className="hpot-score-note">{ids.fp ? `Flags the chatty backup job too — ${ids.fp} false alarm${ids.fp > 1 ? 's' : ''}. Raise T and you start missing the attacker.` : ids.tp ? 'Caught it here — but only because T happens to sit between the backup job and the scan.' : 'Threshold too high — the scan slips under it.'}</p>
        </div>
      </div>

      <p className="hpot-foot">
        A honeypot's power is <strong>precision</strong>: since no legitimate user has any reason to connect to a decoy,
        every hit is a real signal — no tuning, no false-positive fatigue. Its limit is <strong>recall</strong>: a decoy
        that answers with the wrong banners or too little interaction gets fingerprinted and avoided, so high-interaction
        honeypots (and scattered <strong>honeytokens</strong> — a fake AWS key, a decoy row in a database) exist to be
        convincing. The move in practice is to run <em>both</em>: broad detectors for coverage, honeypots for the
        high-confidence alert you actually page someone about. (Honeypots / canary tokens.)
      </p>
    </div>
  );
}
