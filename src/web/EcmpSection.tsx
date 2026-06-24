// ECMP, made visible. A router spreads flows across equal-cost next-hops by hashing each flow's
// 5-tuple — watch many flows scatter across the paths while every packet of one flow stays put. Then
// the polarization demo: two cascaded routers using the SAME hash seed light up only the diagonal
// links (cross paths starve); give each router its own seed and the full mesh fills. Logic from ecmp.ts.
import { useMemo, useState } from 'react';
import { distribute, twoStageLinks, makeFlows } from './ecmp';

const FLOWS = makeFlows(800);

export function EcmpSection() {
  const [n, setN] = useState(4);
  const [sameSeed, setSameSeed] = useState(true);
  const counts = useMemo(() => distribute(FLOWS, n, 7), [n]);
  const two = useMemo(() => twoStageLinks(FLOWS, n, 7, sameSeed ? 7 : 99), [n, sameSeed]);
  const maxC = Math.max(...counts, 1);

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>ECMP — spreading flows across equal-cost paths</h2></div>
        <p className="jsec-sub">
          When a router has several equally-good next-hops, it loads them all — but it can’t round-robin <em>packets</em>, or one TCP flow’s
          packets would arrive out of order. So it hashes each packet’s <strong>flow 5-tuple</strong> (src/dst IP, src/dst port, protocol) and
          sends the whole flow down one path. Different flows scatter; each flow stays in order.
        </p>

        <label className="ecmp-nslider">equal-cost paths <input type="range" min={2} max={8} value={n} onChange={(e) => setN(+e.target.value)} /><b>{n}</b></label>
        <div className="ecmp-dist">
          {counts.map((c, i) => (
            <div key={i} className="ecmp-path">
              <div className="ecmp-bar"><div style={{ height: `${(c / maxC) * 100}%` }} /></div>
              <div className="ecmp-plbl">path {i}</div>
              <div className="ecmp-pcount">{c}</div>
            </div>
          ))}
        </div>
        <p className="ecmp-note">{FLOWS.length} flows spread across {n} paths — roughly even, and deterministic: the same flow always picks the same path (no reordering).</p>

        <h3 className="ecmp-h3">Polarization — the multi-tier trap</h3>
        <label className="ecmp-toggle"><input type="checkbox" checked={sameSeed} onChange={(e) => setSameSeed(e.target.checked)} /> both router tiers use the SAME hash seed</label>
        <div className="ecmp-grid" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
          {two.matrix.flatMap((row, i) => row.map((c, j) => (
            <div key={`${i}-${j}`} className={`ecmp-cell ${c > 0 ? 'used' : 'idle'}`} title={`tier1 path ${i} → tier2 path ${j}: ${c} flows`}>{c > 0 ? c : ''}</div>
          )))}
        </div>
        <div className={`ecmp-verdict ${sameSeed ? 'bad' : 'good'}`}>
          {sameSeed
            ? `⚠ POLARIZED — only ${two.used} of the ${two.total} tier-2 links carry traffic (the diagonal). A flow that hashes to path k at tier 1 hashes to path k again at tier 2, so the cross paths sit idle and the used ones overload.`
            : `✓ FULL MESH — ${two.used} of ${two.total} links in use. A per-router seed decorrelates the two hashes, so flows spread independently at each tier.`}
        </div>

        <p className="ecmp-foot">
          The hash input is a real design lever: 5-tuple hashing keeps flows in order but can’t split one huge “elephant” flow, so high-throughput
          fabrics add flowlet switching (split a flow only across large idle gaps where reordering is harmless) or move entropy into an outer
          header (a VXLAN/MPLS source port computed from the inner flow). And the seed lesson is real: vendors default to per-device hash seeds
          precisely so a Clos fabric doesn’t polarize. LACP link bonding hashes the same way for the same in-order reason.
        </p>
      </section>
    </div>
  );
}
