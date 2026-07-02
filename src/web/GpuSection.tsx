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
  const takesIf = div.pred.filter(Boolean).length;
  // build the passes robustly (each pass = the group of lanes that stay active), correct for any predicate
  const passInfo: { label: string; cls: 'a' | 'b'; isActive: (i: number) => boolean }[] = [];
  if (takesIf > 0) passInfo.push({ label: 'if-path', cls: 'a', isActive: (i) => div.pred[i] });
  if (takesIf < WARP) passInfo.push({ label: 'else-path', cls: 'b', isActive: (i) => !div.pred[i] });
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
        {passInfo.map((p, pass) => (
          <div key={pass} className="gpu-pass">
            <span className="gpu-pl">pass {pass + 1} · {p.label} · {div.pred.filter((_, i) => p.isActive(i)).length}/{WARP} active</span>
            <div className="gpu-lanes">
              {div.pred.map((_, i) => <span key={i} className={`gpu-lane ${p.isActive(i) ? p.cls : 'idle'}`} />)}
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
        Both hazards trace to one fact: 32 threads move as one. A stray thread on the other side of a branch costs
        a whole extra pass, so GPU code keeps a warp on a single path (sort so neighbors agree, or replace the
        branch with predication). And since a load pulls a full 128-byte line no matter how few bytes you use,
        thread <code>i</code> should read element <code>i</code> (structure-of-arrays, not array-of-structures), so
        a warp's 32 reads land in one line. Get layout and divergence right and the GPU hits its rated teraflops;
        get them wrong and it crawls, which is why GPU tuning is mostly memory layout, not arithmetic. The same
        lockstep hides latency: when a warp stalls on memory the scheduler swaps in a ready one, so thousands of
        threads in flight keep the ALUs busy. A GPU trades single-thread speed for occupancy. (NVIDIA CUDA guide;
        Hennessy &amp; Patterson ch. 4.)
      </p>
    </div>
  );
}
