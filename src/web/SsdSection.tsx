// How an SSD works, made visible. Write logical pages and watch the flash translation layer place each one on a
// fresh physical page (out-of-place), stale the old copy, and — when free pages run low — garbage-collect a block
// (relocate its valid pages, then erase it). The grid colors pages free/valid/stale; the stats show write
// amplification and the erase spread that is wear leveling. Real logic from ssd.ts.
import { useRef, useState } from 'react';
import { Ssd } from './ssd';

const NB = 6, PPB = 6;

export function SsdSection() {
  const ssd = useRef(new Ssd(NB, PPB));
  const seed = useRef(1);
  const [, force] = useState(0);
  const rnd = (n: number) => { seed.current = (Math.imul(seed.current, 1103515245) + 12345) & 0x7fffffff; return seed.current % n; };
  const rerender = () => force((x) => x + 1);

  const writeRandom = () => { for (let i = 0; i < 6; i++) ssd.current.write(rnd(18)); rerender(); };
  const hammer = () => { for (let i = 0; i < 10; i++) ssd.current.write(3); rerender(); }; // overwrite one hot page
  const reset = () => { ssd.current = new Ssd(NB, PPB); seed.current = 1; rerender(); };

  const c = ssd.current.counts();
  const wa = ssd.current.writeAmplification();
  const totalErases = ssd.current.erases.reduce((a, b) => a + b, 0);
  const maxErase = Math.max(1, ...ssd.current.erases);

  return (
    <div className="ssd">
      <p className="ssd-intro">
        Flash reads and writes a <strong>page</strong> (a few KB) but can only erase a whole <strong>block</strong>
        (many pages), and a page can't be overwritten in place. So a "write" never overwrites — the
        <strong> flash translation layer</strong> programs a fresh page, repoints its map, and marks the old page
        <strong> stale</strong>. When pages run low, <strong>garbage collection</strong> relocates a block's valid
        pages and erases it. Write pages and watch:
      </p>

      <div className="ssd-controls">
        <button type="button" className="ssd-btn" onClick={writeRandom}>write 6 random pages</button>
        <button type="button" className="ssd-btn" onClick={hammer}>hammer one page ×10</button>
        <button type="button" className="ssd-btn ghost" onClick={reset}>reset</button>
      </div>

      <div className="ssd-grid">
        {ssd.current.blocks.map((block, b) => (
          <div key={b} className="ssd-block">
            <div className="ssd-pages">
              {block.map((p, i) => <span key={i} className={`ssd-pg ${p.state}`} title={p.state === 'valid' ? `logical page ${p.lpn}` : p.state} />)}
            </div>
            <div className="ssd-erase" title={`${ssd.current.erases[b]} erases`}>
              <div className="ssd-erasebar" style={{ width: `${(ssd.current.erases[b] / maxErase) * 100}%` }} />
              <span>{ssd.current.erases[b]}⟲</span>
            </div>
          </div>
        ))}
      </div>
      <div className="ssd-legend"><span className="ssd-lg free">free</span><span className="ssd-lg valid">valid</span><span className="ssd-lg stale">stale (awaiting erase)</span><span className="ssd-lg-e">⟲ block erases (wear)</span></div>

      <div className="ssd-stats">
        <div className="ssd-stat"><span>write amplification</span><b>{wa.toFixed(2)}×</b></div>
        <div className="ssd-stat"><span>logical / physical writes</span><b>{ssd.current.logicalWrites} / {ssd.current.physicalWrites}</b></div>
        <div className="ssd-stat"><span>total block erases</span><b>{totalErases}</b></div>
        <div className="ssd-stat"><span>free · valid · stale</span><b>{c.free} · {c.valid} · {c.stale}</b></div>
      </div>

      <p className="ssd-foot">
        Hammer one page and watch stale pages pile up, then a block erase reclaim them — that relocation is
        <strong> write amplification</strong>: the drive physically writes more than you asked, wearing the flash
        faster and eating into throughput. The FTL fights back on three fronts. It spreads erases across all blocks
        so no cell hits its program/erase limit first (<strong>wear leveling</strong> — the erase bars stay
        roughly even). It needs the OS to say which logical pages are dead, via <strong>TRIM</strong>, or it wastes
        effort relocating data the filesystem already deleted. And it keeps spare hidden capacity
        (<strong>over-provisioning</strong>, typically 7–28%) so garbage collection always has somewhere to copy to
        — which is why a nearly-full SSD slows down and wears faster. The cell itself trades endurance for density:
        SLC stores one bit and survives ~100k erase cycles; QLC packs four bits per cell for cheap capacity but
        lasts only ~1k, which is why consumer drives lean on a small SLC-mode write cache in front of QLC. It's a
        stack of lies the drive tells to make forgetful, wear-prone, erase-in-bulk flash look like a simple array
        of overwritable sectors. (Agrawal et al., 2008; flash datasheets.)
      </p>
    </div>
  );
}
