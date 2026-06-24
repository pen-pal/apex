// Page replacement, made visible. Pick a policy and a number of frames, then watch a reference
// string play out as a grid: each column is one memory access, each row a physical frame, and the
// status row marks every page fault. Flip FIFO to 3 vs 4 frames and watch Belady's anomaly — more
// memory, MORE faults. All counts come from pagereplace.ts (tested against textbook values).
import { useMemo, useState } from 'react';
import { simulate, BELADY_STRING, type Algo } from './pagereplace';

const ALGOS: { id: Algo; label: string; blurb: string }[] = [
  { id: 'FIFO', label: 'FIFO', blurb: 'evict the oldest-loaded page' },
  { id: 'LRU', label: 'LRU', blurb: 'evict the least-recently-used page' },
  { id: 'CLOCK', label: 'Clock', blurb: 'second-chance — a cheap LRU approximation' },
  { id: 'OPT', label: 'Optimal', blurb: 'evict the page used farthest in the future (unrealizable)' },
];
const PRESETS: { label: string; refs: number[] }[] = [
  { label: "Belady's string", refs: BELADY_STRING },
  { label: 'locality', refs: [1, 1, 2, 1, 3, 1, 2, 4, 1, 2, 5, 2] },
  { label: 'cyclic > frames', refs: [1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4] },
];

export function PageReplaceSection() {
  const [algo, setAlgo] = useState<Algo>('FIFO');
  const [frames, setFrames] = useState(3);
  const [refs, setRefs] = useState<number[]>(BELADY_STRING);
  const [raw, setRaw] = useState(BELADY_STRING.join(' '));

  const sim = useMemo(() => simulate(algo, refs, frames), [algo, refs, frames]);
  const sweep = useMemo(() => [1, 2, 3, 4, 5].map((n) => simulate(algo, refs, n).faults), [algo, refs]);
  const anomaly = sweep.some((f, i) => i > 0 && f > sweep[i - 1]); // faults went UP with more frames

  const applyRaw = (s: string) => {
    setRaw(s);
    const nums = s.split(/[\s,]+/).map((x) => parseInt(x, 10)).filter((x) => !isNaN(x));
    if (nums.length) setRefs(nums);
  };

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Page replacement — which page do you evict?</h2></div>
        <p className="jsec-sub">
          When physical memory is full and a new page is needed, the OS (and a database buffer pool) must evict a resident page. The choice
          decides how many slow <strong>page faults</strong> you pay. Each policy below answers “evict <em>which</em>?” differently — and
          one of them has a famous flaw: under <strong>FIFO</strong>, giving a process <strong>more</strong> frames can cause <strong>more</strong>
          faults (Belady’s anomaly). Optimal is the unbeatable lower bound, but needs to see the future.
        </p>

        <div className="pgr-algos">
          {ALGOS.map((a) => (
            <button key={a.id} className={`pgr-algo ${algo === a.id ? 'on' : ''}`} onClick={() => setAlgo(a.id)} title={a.blurb}>{a.label}</button>
          ))}
          <span className="pgr-blurb">{ALGOS.find((a) => a.id === algo)!.blurb}</span>
        </div>

        <div className="pgr-controls">
          <label>frames <input type="range" min={1} max={5} value={frames} onChange={(e) => setFrames(+e.target.value)} /><b>{frames}</b></label>
          <label className="pgr-refinput">reference string <input value={raw} onChange={(e) => applyRaw(e.target.value)} spellCheck={false} /></label>
          <div className="pgr-presets">{PRESETS.map((p) => <button key={p.label} onClick={() => { setRefs(p.refs); setRaw(p.refs.join(' ')); }}>{p.label}</button>)}</div>
        </div>

        <div className="pgr-gridwrap">
          <table className="pgr-grid">
            <thead>
              <tr><th className="pgr-rowlbl">access</th>{sim.steps.map((s, i) => <th key={i} className="pgr-page">{s.page}</th>)}</tr>
            </thead>
            <tbody>
              {Array.from({ length: frames }).map((_, f) => (
                <tr key={f}>
                  <td className="pgr-rowlbl">frame {f}</td>
                  {sim.steps.map((s, i) => {
                    const v = s.frames[f];
                    const justLoaded = !s.hit && v === s.page; // this frame received the new page
                    return <td key={i} className={`pgr-cell ${v === null ? 'empty' : ''} ${justLoaded ? 'loaded' : ''}`}>{v ?? ''}</td>;
                  })}
                </tr>
              ))}
              <tr className="pgr-statusrow">
                <td className="pgr-rowlbl">fault?</td>
                {sim.steps.map((s, i) => <td key={i} className={`pgr-status ${s.hit ? 'hit' : 'fault'}`}>{s.hit ? '·' : '✗'}</td>)}
              </tr>
            </tbody>
          </table>
        </div>

        <div className="pgr-stats">
          <div className="pgr-stat fault"><span className="pgr-num">{sim.faults}</span><span>page faults</span></div>
          <div className="pgr-stat hit"><span className="pgr-num">{sim.hits}</span><span>hits</span></div>
          <div className="pgr-stat"><span className="pgr-num">{((sim.faults / refs.length) * 100).toFixed(0)}%</span><span>fault rate</span></div>
        </div>

        <div className={`pgr-sweep ${anomaly ? 'anom' : ''}`}>
          <span className="pgr-sweeplbl">faults vs frames ({algo}):</span>
          {sweep.map((f, i) => {
            const worse = i > 0 && f > sweep[i - 1];
            return (
              <span key={i} className={`pgr-sweepcell ${i + 1 === frames ? 'cur' : ''} ${worse ? 'worse' : ''}`}>
                <b>{f}</b><span>{i + 1}f{worse ? ' ↑' : ''}</span>
              </span>
            );
          })}
          {anomaly && <span className="pgr-anomtag">⚠ Belady’s anomaly — more frames, more faults</span>}
        </div>

        <p className="pgr-foot">
          LRU is the practical winner — it’s a <em>stack algorithm</em>, so adding frames can never increase faults (no anomaly) — but tracking
          true recency on every access is expensive, so real kernels use <strong>Clock</strong> (second-chance) and its variants as a cheap
          approximation. Linux uses a two-list active/inactive LRU; databases like PostgreSQL use clock-sweep on the buffer pool. Optimal
          can’t be built (it needs the future), but it sets the bar every real policy is measured against.
        </p>
      </section>
    </div>
  );
}
