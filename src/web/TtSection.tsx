// TrueTime & commit-wait, made visible. Drag the clock uncertainty ε and watch a transaction's commit
// timestamp (the latest possible "now") sit ahead of true time, and the 2ε commit-wait the transaction
// serves before releasing its locks so that timestamp is safely in the past. Toggle commit-wait off to
// see external consistency break: a later transaction grabs an equal timestamp. Logic from truetime.ts.
import { useState } from 'react';
import { now, commitWait, externalConsistency } from './truetime';

const T1 = 100; // true commit instant of T1 (arbitrary units = ms)
const SPAN = 160; // timeline window
const X = (t: number) => ((t - 60) / SPAN) * 100; // map time→% across the track (window [60,220])

export function TtSection() {
  const [eps, setEps] = useState(8);
  const [useCW, setUseCW] = useState(true);
  const iv = now(T1, eps);
  const c = commitWait(T1, eps);
  const ec = externalConsistency(T1, T1, eps, useCW);

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>TrueTime &amp; commit-wait — ordering transactions with real clocks</h2></div>
        <p className="jsec-sub">
          Google Spanner gives globally-distributed transactions one consistent order without a central sequencer — by embracing clock
          uncertainty instead of hiding it. <strong>TT.now()</strong> returns an interval <code>[t−ε, t+ε]</code>; the true instant is somewhere
          inside, with ε kept to a few ms by GPS + atomic clocks. A commit picks <strong>s = t+ε</strong> (the latest it could be) and then
          <strong> commit-waits 2ε</strong> until <code>now().earliest &gt; s</code> — guaranteeing s is in the past everywhere before anyone sees the commit.
        </p>

        <div className="tt-ctrl">
          <label>clock uncertainty ε <input type="range" min={2} max={24} value={eps} onChange={(e) => setEps(+e.target.value)} /><b>±{eps} ms</b></label>
          <span className="tt-cost">commit-wait = <b>2ε = {2 * eps} ms</b> of added commit latency</span>
        </div>

        <div className="tt-track">
          <div className="tt-uncert" style={{ left: `${X(iv.earliest)}%`, width: `${X(iv.latest) - X(iv.earliest)}%` }}><span>TT.now() = [{iv.earliest}, {iv.latest}]</span></div>
          <div className="tt-wait" style={{ left: `${X(T1)}%`, width: `${X(c.visibleAt) - X(T1)}%` }}><span>commit-wait 2ε</span></div>
          <div className="tt-mark truet" style={{ left: `${X(T1)}%` }}><i /><label>true commit · t={T1}</label></div>
          <div className="tt-mark commit" style={{ left: `${X(c.commitTs)}%` }}><i /><label>commit ts s = t+ε = {c.commitTs}</label></div>
          <div className="tt-mark visible" style={{ left: `${X(c.visibleAt)}%` }}><i /><label>locks release · t+2ε = {c.visibleAt}</label></div>
        </div>

        <div className="tt-ec">
          <div className="tt-echdr">
            <h3>External consistency: T1 then T2 (both at t={T1})</h3>
            <label className="tt-toggle"><input type="checkbox" checked={useCW} onChange={(e) => setUseCW(e.target.checked)} /> commit-wait</label>
          </div>
          <div className="tt-ecrows">
            <div className="tt-ecrow"><span>T1 commit timestamp</span><b>{ec.ts1}</b></div>
            <div className="tt-ecrow"><span>T1 visible (locks released) at</span><b>{ec.t1VisibleAt}</b></div>
            <div className="tt-ecrow"><span>T2 starts after T1, picks timestamp</span><b>{ec.ts2}</b></div>
          </div>
          <div className={`tt-verdict ${ec.ordered ? 'ok' : 'bad'}`}>
            {ec.ordered
              ? `✓ ts(T1)=${ec.ts1} < ts(T2)=${ec.ts2} — external consistency holds. T1 commit-waited 2ε, so T2 couldn't even start until T1's timestamp was safely past.`
              : `✗ ts(T1)=${ec.ts1} ≥ ts(T2)=${ec.ts2} — VIOLATED. Without commit-wait, T1 released its locks before its timestamp was past, so a happens-after T2 grabbed an equal one. A reader could now see T2 but not T1.`}
          </div>
        </div>

        <p className="tt-foot">
          The elegance is paying for correctness in a currency you can shrink: tighter clocks (smaller ε) mean shorter commit-waits, so Spanner
          invests in GPS and atomic clocks to push ε down to a few milliseconds. It’s the inverse of logical clocks (Lamport/vector) which track
          causality with no wall-clock meaning — TrueTime spends real time to give timestamps real, comparable meaning across continents. The same
          “bounded uncertainty + wait it out” idea reappears in hybrid logical clocks and in any system that needs a global order from imperfect clocks.
        </p>
      </section>
    </div>
  );
}
