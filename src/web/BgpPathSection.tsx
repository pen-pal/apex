// BGP best-path selection — make the opaque decision visible. Several routes reach
// the same prefix; BGP walks a fixed ladder of tie-breakers, eliminating routes one
// rung at a time until a single best path survives. Edit the candidates, then step
// down the ladder and watch losers drop out. Decision logic is real (see bgp.ts).
import { useMemo, useState } from 'react';
import { selectBestPath, LADDER, type Route, type Origin } from './bgp';

const DEFAULTS: Route[] = [
  { id: 'via AS65010', nextHop: '10.0.0.1', weight: 0, localPref: 100, asPath: [65010, 65020, 65030], origin: 'IGP', med: 0, fromEbgp: true, igpMetric: 10, routerId: 5 },
  { id: 'via AS65040', nextHop: '10.0.0.2', weight: 0, localPref: 100, asPath: [65040, 65050], origin: 'IGP', med: 0, fromEbgp: true, igpMetric: 20, routerId: 8 },
  { id: 'via AS65060', nextHop: '10.0.0.3', weight: 0, localPref: 100, asPath: [65060, 65070], origin: 'IGP', med: 0, fromEbgp: true, igpMetric: 10, routerId: 3 },
];
const clone = (rs: Route[]) => rs.map((r) => ({ ...r, asPath: [...r.asPath] }));

export function BgpPathSection() {
  const [routes, setRoutes] = useState<Route[]>(clone(DEFAULTS));
  const [step, setStep] = useState(0);
  const decision = useMemo(() => selectBestPath(routes), [routes]);
  const steps = decision.steps;

  const eliminated = new Set<string>();
  for (let i = 0; i < step; i++) steps[i].eliminated.forEach((id) => eliminated.add(id));
  const current = step > 0 ? steps[step - 1] : null;
  const done = step >= steps.length;

  const edit = (i: number, patch: Partial<Route>) => {
    setRoutes((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    setStep(0);
  };
  const reset = () => { setRoutes(clone(DEFAULTS)); setStep(0); };

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>BGP best-path selection — why it picked THAT route</h2></div>
        <p className="jsec-sub">
          When several routes reach the same prefix, BGP runs a fixed ladder of tie-breakers and stops at the first
          one that separates them. Edit the candidates below, then <strong>step down the ladder</strong> and watch
          routes get eliminated until one best path remains.
        </p>

        <div className="bgp-controls">
          <button className="ghost small" onClick={() => setStep(0)}>⏮ reset steps</button>
          <button className="ghost small" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>‹ back</button>
          <button className="ghost small" disabled={done} onClick={() => setStep((s) => Math.min(steps.length, s + 1))}>step ›</button>
          <button className="ghost small" onClick={() => setStep(steps.length)}>run to end ⤓</button>
          <button className="ghost small" onClick={reset}>↺ defaults</button>
          <span className="bgp-prog">rung {step}/{steps.length}</span>
        </div>

        <div className="bgp-table-wrap">
          <table className="bgp-table">
            <thead>
              <tr>
                <th>route</th><th>weight</th><th>local-pref</th><th>AS_PATH</th><th>origin</th><th>MED</th><th>eBGP</th><th>IGP</th><th>RID</th>
              </tr>
            </thead>
            <tbody>
              {routes.map((r, i) => {
                const out = eliminated.has(r.id);
                const win = done && decision.winner?.id === r.id;
                return (
                  <tr key={r.id} className={`${out ? 'out' : ''} ${win ? 'win' : ''}`}>
                    <td className="bgp-rid">{win && '👑 '}{r.id}</td>
                    <td><NumIn v={r.weight} on={(v) => edit(i, { weight: v })} /></td>
                    <td><NumIn v={r.localPref} on={(v) => edit(i, { localPref: v })} /></td>
                    <td><input className="bgp-aspath" value={r.asPath.join(' ')} onChange={(e) => edit(i, { asPath: e.target.value.split(/[\s,]+/).filter(Boolean).map(Number) })} /></td>
                    <td>
                      <select value={r.origin} onChange={(e) => edit(i, { origin: e.target.value as Origin })}>
                        <option value="IGP">IGP (i)</option><option value="EGP">EGP (e)</option><option value="INCOMPLETE">?</option>
                      </select>
                    </td>
                    <td><NumIn v={r.med} on={(v) => edit(i, { med: v })} /></td>
                    <td><input type="checkbox" checked={r.fromEbgp} onChange={(e) => edit(i, { fromEbgp: e.target.checked })} /></td>
                    <td><NumIn v={r.igpMetric} on={(v) => edit(i, { igpMetric: v })} /></td>
                    <td><NumIn v={r.routerId} on={(v) => edit(i, { routerId: v })} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="bgp-ladder">
          {LADDER.map((rung) => {
            const sIdx = steps.findIndex((s) => s.rung.key === rung.key);
            const evaluated = sIdx >= 0 && sIdx < step;
            const isCurrent = current?.rung.key === rung.key;
            const s = sIdx >= 0 ? steps[sIdx] : null;
            const notReached = sIdx < 0; // decision ended before this rung
            return (
              <div key={rung.key} className={`bgp-rung ${evaluated ? 'done' : ''} ${isCurrent ? 'cur' : ''} ${notReached ? 'skip' : ''} ${s?.decisive && evaluated ? 'decisive' : ''}`}>
                <span className="br-num">{LADDER.indexOf(rung) + 1}</span>
                <div className="br-body">
                  <div className="br-title">{rung.label} <em>({rung.better} wins)</em></div>
                  {isCurrent && <div className="br-explain">{rung.explain}</div>}
                  {evaluated && s && s.eliminated.length > 0 && <div className="br-elim">✕ eliminated: {s.eliminated.join(', ')}</div>}
                  {evaluated && s && s.eliminated.length === 0 && <div className="br-tie">— tie, all advance</div>}
                </div>
              </div>
            );
          })}
        </div>

        <div className="bgp-status">
          {current
            ? <span>At <strong>{current.rung.label}</strong>: {current.eliminated.length ? `${current.eliminated.join(', ')} dropped out.` : 'all candidates tie — move to the next rung.'}</span>
            : <span>Press <strong>step ›</strong> to begin walking the ladder.</span>}
          {done && decision.winner && (
            <span className="bgp-winner"> 👑 Best path: <strong>{decision.winner.id}</strong> — decided at <strong>{LADDER.find((r) => r.key === decision.decidedAt)?.label ?? 'first comparison'}</strong>.</span>
          )}
        </div>
      </section>
    </div>
  );
}

function NumIn({ v, on }: { v: number; on: (v: number) => void }) {
  return <input className="bgp-num" type="number" value={v} onChange={(e) => on(parseInt(e.target.value) || 0)} />;
}
