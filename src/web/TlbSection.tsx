// The TLB, made visible. A loop repeatedly touches a working set of pages; step through the accesses and
// watch the TLB hit (green, ~1 cycle) or miss (red, a page-table walk). Drag the working-set size past
// the TLB size and watch the hit rate fall off a cliff — every access evicts the entry it's about to
// need again (thrashing). The cost panel shows the speedup a high hit rate buys. Real LRU sim from tlb.ts.
import { useMemo, useState } from 'react';
import { simulate, cost, loopAccesses, MISS_CYCLES } from './tlb';

const TLB_SIZE = 4, ITERS = 4;

export function TlbSection() {
  const [ws, setWs] = useState(3);
  const [step, setStep] = useState(0);

  const accesses = useMemo(() => loopAccesses(ws, ITERS), [ws]);
  const r = useMemo(() => simulate(accesses, TLB_SIZE), [accesses]);
  const c = cost(r, accesses.length);
  const cur = step > 0 ? r.steps[step - 1] : null;
  const tlb = cur ? cur.tlbAfter : [];

  // the cliff: hit rate as the working set grows, for this TLB size
  const cliff = useMemo(() => Array.from({ length: 8 }, (_, i) => simulate(loopAccesses(i + 1, ITERS), TLB_SIZE).hitRate), []);

  return (
    <div className="tlb">
      <div className="tlb-controls">
        <label>working-set pages <input type="range" min={1} max={8} value={ws} onChange={(e) => { setWs(+e.target.value); setStep(0); }} /><b>{ws}</b></label>
        <span className="tlb-fixed">TLB size {TLB_SIZE} entries · miss = {MISS_CYCLES}-cycle page walk</span>
        {ws > TLB_SIZE && <span className="tlb-warn">working set &gt; TLB → thrashing</span>}
      </div>

      <div className="tlb-stream">
        {r.steps.map((s, i) => (
          <button key={i} type="button" className={`tlb-acc ${s.hit ? 'hit' : 'miss'} ${i === step - 1 ? 'cur' : ''} ${i >= step ? 'dim' : ''}`} onClick={() => setStep(i + 1)} title={`page ${s.vpn}: ${s.hit ? 'HIT' : 'MISS'}`}>{s.vpn}</button>
        ))}
      </div>

      <div className="tlb-state">
        <span className="tlb-label">TLB (LRU → )</span>
        <div className="tlb-entries">
          {Array.from({ length: TLB_SIZE }, (_, i) => {
            const v = tlb[i];
            return <span key={i} className={`tlb-entry ${v === undefined ? 'empty' : ''} ${cur && i === 0 ? 'mru' : ''}`}>{v === undefined ? '·' : `p${v}`}</span>;
          })}
        </div>
        {cur && <span className={`tlb-verdict ${cur.hit ? 'hit' : 'miss'}`}>page {cur.vpn}: {cur.hit ? '✓ HIT (1 cycle)' : `✗ MISS — walk page table${cur.evicted !== null ? `, evict p${cur.evicted}` : ''}`}</span>}
      </div>

      <div className="tlb-steps">
        <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>◀</button>
        <button type="button" className="primary" onClick={() => setStep((s) => Math.min(accesses.length, s + 1))} disabled={step >= accesses.length}>step ▶</button>
        <button type="button" onClick={() => setStep(accesses.length)} disabled={step >= accesses.length}>all</button>
        <button type="button" onClick={() => setStep(0)} disabled={step === 0}>reset</button>
      </div>

      <div className="tlb-bottom">
        <div className="tlb-stats">
          <div className="tlb-stat"><span>hit rate</span><b className={r.hitRate > 0.5 ? 'g' : 'b'}>{(r.hitRate * 100).toFixed(0)}%</b></div>
          <div className="tlb-stat"><span>avg cycles / access</span><b>{c.withTlb.toFixed(1)}</b></div>
          <div className="tlb-stat"><span>vs no TLB</span><b>{c.withoutTlb}</b></div>
          <div className="tlb-stat"><span>speedup</span><b className="g">{c.speedup.toFixed(0)}×</b></div>
        </div>
        <div className="tlb-cliff">
          <div className="tlb-cliff-h">hit rate vs working-set size (TLB = {TLB_SIZE})</div>
          <div className="tlb-bars">
            {cliff.map((hr, i) => (
              <div key={i} className="tlb-cbar-wrap">
                <div className={`tlb-cbar ${i + 1 === ws ? 'cur' : ''} ${i + 1 > TLB_SIZE ? 'over' : ''}`} style={{ height: `${Math.max(2, hr * 100)}%` }} title={`${i + 1} pages: ${(hr * 100).toFixed(0)}%`} />
                <span className="tlb-cx">{i + 1}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="tlb-foot">
        The whole point of virtual memory rests on this cache: without it, every load and store would chase a multi-level page table and run
        an order of magnitude slower. Because real code has <strong>locality</strong>, a handful of entries cover the vast majority of accesses,
        so hit rates above 99% are normal and the page walk almost never runs. The danger is a working set that <strong>overflows the TLB</strong> —
        a big random scan, or pointer-chasing over a huge structure — where the hit rate craters and you feel the walk on every access. Mitigations:
        <em> huge pages</em> (one TLB entry covers 2 MB or 1 GB instead of 4 KB, so a given footprint needs far fewer entries), multi-level TLBs,
        and laying data out for locality. On a context switch the TLB is flushed (or tagged with an address-space id) since translations are
        per-process. (Hennessy &amp; Patterson; OSTEP.)
      </p>
    </div>
  );
}
