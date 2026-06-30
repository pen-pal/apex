// SWIM failure detection, made clickable. A detector probes one target: flip the direct link down and
// the target ISN'T declared dead — the detector asks helper nodes to ping it (ping-req), and any success
// keeps it alive. Cut every link and it goes SUSPECT, then DEAD on the timer — unless the target refutes
// with a higher incarnation number, which instantly clears it. Real state machine from swim.ts.
import { useState } from 'react';
import { initMember, probe, suspicionExpire, refute, applySuspect, type Member } from './swim';

const HELPERS = ['H1', 'H2', 'H3'];
const STATUS_HUE: Record<string, number> = { alive: 150, suspect: 35, dead: 0 };

export function SwimSection() {
  const [target, setTarget] = useState<Member>(initMember('T'));
  const [direct, setDirect] = useState(true);
  const [helpers, setHelpers] = useState([true, true, true]);
  const [log, setLog] = useState<string[]>([]);

  const push = (s: string) => setLog((l) => [s, ...l].slice(0, 8));
  const runProbe = () => {
    const o = probe(target, direct, helpers);
    setTarget(o.member);
    push(`probe → ${o.member.status}${o.via ? ` (${o.via} ack)` : ''}: ${o.note}`);
  };
  const expire = () => { const m = suspicionExpire(target); setTarget(m); push(m.status === 'dead' ? 'suspicion timer expired → DEAD' : 'no suspect to expire'); };
  const doRefute = () => {
    if (target.status !== 'suspect') { push('nothing to refute'); return; }
    const inc = target.incarnation + 1;
    setTarget(refute(target, inc));
    push(`target refutes with incarnation ${inc} → ALIVE`);
  };
  const staleSuspect = () => { const m = applySuspect(target, target.incarnation - 1); setTarget(m); push(`a stale suspicion (incarnation ${target.incarnation - 1}) arrives → ${m.status === target.status ? 'IGNORED (older than last refute)' : m.status}`); };
  const reset = () => { setTarget(initMember('T')); setDirect(true); setHelpers([true, true, true]); setLog([]); };

  const hue = STATUS_HUE[target.status];

  return (
    <div className="swm">
      <div className="swm-stage">
        <div className="swm-node detector">D<span>detector</span></div>
        <div className="swm-links">
          <label className={`swm-link ${direct ? 'up' : 'down'}`}><input type="checkbox" checked={direct} onChange={(e) => setDirect(e.target.checked)} />direct ping {direct ? '↑' : '✕'}</label>
          <div className="swm-helpers">
            {HELPERS.map((h, i) => (
              <label key={h} className={`swm-link sm ${helpers[i] ? 'up' : 'down'}`}>
                <input type="checkbox" checked={helpers[i]} onChange={(e) => setHelpers((hs) => hs.map((v, k) => (k === i ? e.target.checked : v)))} />
                {h}→T {helpers[i] ? '↑' : '✕'}
              </label>
            ))}
          </div>
        </div>
        <div className="swm-target" style={{ borderColor: `hsl(${hue} 55% 55%)`, background: `hsl(${hue} 55% 96%)` }}>
          <span className="swm-tstatus" style={{ color: `hsl(${hue} 55% 32%)` }}>{target.status.toUpperCase()}</span>
          <span className="swm-tname">target T</span>
          <span className="swm-tinc">incarnation {target.incarnation}</span>
        </div>
      </div>

      <div className="swm-controls">
        <button type="button" className="primary" onClick={runProbe} disabled={target.status === 'dead'}>run probe period ▶</button>
        <button type="button" onClick={expire} disabled={target.status !== 'suspect'}>suspicion timer expires</button>
        <button type="button" onClick={doRefute} disabled={target.status !== 'suspect'}>target refutes (incarnation+1)</button>
        <button type="button" onClick={staleSuspect}>inject stale suspicion</button>
        <button type="button" onClick={reset}>reset</button>
      </div>

      <div className="swm-log">
        <div className="swm-log-h">event log</div>
        {log.length === 0 ? <div className="swm-empty">Cut the direct link but leave a helper up, then run a probe — the target stays alive. Then cut all links → suspect → expire → dead. Reset, suspect it, and refute.</div>
          : <ul>{log.map((l, i) => <li key={log.length - i}>{l}</li>)}</ul>}
      </div>

      <p className="swm-foot">
        The two ideas that make SWIM both accurate and cheap: <strong>indirect probing</strong> (a failed direct ping triggers k ping-reqs through
        other members, so one congested link can’t falsely condemn a node) and the <strong>suspect → confirm</strong> path with
        <strong> incarnation numbers</strong> (a node proves it’s alive by refuting with a strictly higher incarnation, and stale gossip is
        discarded). Crucially the failure detector is decoupled from <em>dissemination</em>: membership changes ride along on the ordinary probe
        traffic (infection-style), so per-node load is constant no matter how large the cluster grows — unlike all-to-all heartbeating. It’s the
        backbone of Serf/Consul, Hashicorp memberlist, and many service meshes. (Das et al., SWIM, DSN 2002.)
      </p>
    </div>
  );
}
