// GPU SIMT, made visible. Pick a branch pattern for a 32-thread warp and watch divergence serialize the two
// paths (idle lanes greyed each pass); pick a memory access pattern and watch contiguous loads fuse into one
// transaction while scattered ones explode into 32. Real logic from gpu.ts.
import { useState } from 'react';
import { divergence, coalesce, patterns, WARP } from './gpu';

const DIV: { name: string; pred: boolean[] }[] = [
  { name: 'all same branch', pred: Array(WARP).fill(true) },
  { name: 'split 16 / 16', pred: Array.from({ length: WARP }, (_, i) => i < 16) },
  { name: 'checkerboard', pred: Array.from({ length: WARP }, (_, i) => i % 2 === 0) },
  { name: 'one stray thread', pred: Array.from({ length: WARP }, (_, i) => i !== 7) },
];
const ACCESS: { name: string; addrs: number[] }[] = [
  { name: 'contiguous', addrs: patterns.contiguous(WARP) },
  { name: 'stride 2', addrs: patterns.strided(WARP, 2) },
  { name: 'stride 32', addrs: patterns.strided(WARP, 32) },
  { name: 'scattered', addrs: patterns.scattered(WARP) },
];
const HUES = [212, 150, 28, 280, 340, 90, 190, 50, 0, 120, 260, 320];

export function GpuSection() {
  const [div, setDiv] = useState(DIV[1]);
  const [acc, setAcc] = useState(ACCESS[0]);
  const d = divergence(div.pred);
  const c = coalesce(acc.addrs);
  const lineOf = (a: number) => Math.floor(a / 128);
  const lines = [...new Set(acc.addrs.map(lineOf))];

  return (
    <div className="gpu">
      <p className="gpu-intro">
        A GPU runs threads in lockstep groups called <strong>warps</strong> (32 threads). Every thread in a warp
        executes the <strong>same instruction</strong> each cycle — great for data-parallel work, but it means two
        things can wreck performance: a branch that splits the warp, and memory accesses that scatter.
      </p>

      <div className="gpu-panel">
        <div className="gpu-ph">Branch divergence — a warp hits an <code>if</code></div>
        <div className="gpu-tabs">{DIV.map((p) => <button key={p.name} type="button" className={`gpu-tab ${div.name === p.name ? 'on' : ''}`} onClick={() => setDiv(p)}>{p.name}</button>)}</div>
        {d.activePerPass.map((active, pass) => (
          <div key={pass} className="gpu-pass">
            <span className="gpu-pl">pass {pass + 1} · {pass === 0 ? 'if-path' : 'else-path'} · {active}/{WARP} active</span>
            <div className="gpu-lanes">
              {div.pred.map((takesIf, i) => {
                const activeThisPass = pass === 0 ? takesIf : !takesIf;
                return <span key={i} className={`gpu-lane ${activeThisPass ? (pass === 0 ? 'a' : 'b') : 'idle'}`} />;
              })}
            </div>
          </div>
        ))}
        <div className={`gpu-verdict ${d.diverged ? 'bad' : 'ok'}`}>
          {d.passes} pass{d.passes > 1 ? 'es (paths serialized)' : ' — no divergence'} · SIMT efficiency <b>{(d.efficiency * 100).toFixed(0)}%</b>{d.diverged && ' — idle lanes waste the warp'}
        </div>
      </div>

      <div className="gpu-panel">
        <div className="gpu-ph">Memory coalescing — 32 threads issue loads together</div>
        <div className="gpu-tabs">{ACCESS.map((p) => <button key={p.name} type="button" className={`gpu-tab ${acc.name === p.name ? 'on' : ''}`} onClick={() => setAcc(p)}>{p.name}</button>)}</div>
        <div className="gpu-lanes">
          {acc.addrs.map((a, i) => {
            const li = lines.indexOf(lineOf(a));
            return <span key={i} className="gpu-lane mem" style={{ background: `hsl(${HUES[li % HUES.length]} 55% 50%)` }} title={`thread ${i} → byte ${a} (line ${lineOf(a)})`} />;
          })}
        </div>
        <div className={`gpu-verdict ${c.transactions <= 2 ? 'ok' : 'bad'}`}>
          <b>{c.transactions}</b> memory transaction{c.transactions > 1 ? 's' : ''} (distinct 128-byte lines) · bandwidth used <b>{(c.efficiency * 100).toFixed(0)}%</b> ({c.bytesUsed} B needed, {c.bytesFetched} B fetched)
        </div>
      </div>

      <p className="gpu-foot">
        Both hazards come from the same source — 32 threads forced to move as one. A single stray thread taking the
        other side of a branch costs a whole extra pass, so GPU code is written to keep an entire warp on one path
        (sort data so neighbors agree, replace branches with arithmetic/predication, or restructure so divergence
        happens between warps, not within one). And because a load pulls a full 128-byte line whether you use 4
        bytes or all 128, the layout that flies is thread <code>i</code> reads element <code>i</code> — structure-
        of-arrays, not array-of-structures — so a warp's 32 reads land in one line. Get these two right and a GPU
        delivers its terabytes-per-second and teraflops; get them wrong and it crawls despite the raw specs, which
        is why GPU tuning is mostly about memory layout and divergence, not arithmetic. The same SIMT lockstep also
        hides latency: when one warp stalls on memory, the scheduler instantly swaps in another that's ready, so
        thousands of threads in flight keep the arithmetic units busy — a GPU trades single-thread speed for sheer
        occupancy. (NVIDIA CUDA C Programming Guide; Hennessy &amp; Patterson ch. 4.)
      </p>
    </div>
  );
}
