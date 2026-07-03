// Guided story: nested paging (Intel EPT / AMD NPT) — the "2-D page walk" that virtualizes memory. A guest OS has its
// own 4-level page tables (guest-virtual → guest-physical), but guest-physical isn't real RAM: the hypervisor keeps a
// SECOND 4-level table (EPT) mapping guest-physical → host-physical. So every guest page-table pointer must ITSELF be
// translated through the EPT before it can be read — the linear walk becomes a grid. Verified in node: the nested walk's
// result equals composing the two translations, and one translation costs L·(L+2) = 24 memory accesses for L=4 (20 EPT
// reads + 4 guest PTE reads) vs 4 unvirtualized — which is why the TLB matters so much. Complements [[pagewalk]] (single
// level). Sandboxed/CONCEPTUAL.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const GUEST = ['gPML4', 'gPDPT', 'gPD', 'gPT', 'page']; // 5 guest stages (4 table levels + the data page)
const EPT = ['nPML4', 'nPDPT', 'nPD', 'nPT'];           // 4 EPT levels per translation
// ordered access list: for each guest stage, walk the EPT (4), then (if a table level) read the guest PTE
type Acc = { col: number; row: number; guest: boolean };
const ORDER: Acc[] = (() => { const o: Acc[] = []; for (let c = 0; c < GUEST.length; c++) { for (let r = 0; r < EPT.length; r++) o.push({ col: c, row: r, guest: false }); if (c < GUEST.length - 1) o.push({ col: c, row: -1, guest: true }); } return o; })();
const TOTAL = ORDER.length; // 5*4 + 4 = 24

const GX = 80, CW = 128, GY = 74, EY = 108, CH = 34;
type Phase = 'guest' | 'hyper' | 'twod' | 'count' | 'tlb' | 'run';

export function NestedPagingSection() {
  const [step, setStep] = useState(TOTAL);
  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string, st: number): StoryScene =>
    ({ key, title, caption, render: () => <Walk phase={key} step={st} /> });

  const scenes: StoryScene[] = [
    scene('guest', 'The guest thinks it owns memory', 'Inside a virtual machine, the guest OS runs its own page tables, translating a guest-virtual address down four levels (PML4 → PDPT → PD → PT) to a guest-physical address — exactly as on bare metal. But that “physical” address is a fiction: it’s not a real RAM location, just the guest’s private view.', 4),
    scene('hyper', 'The hypervisor remaps it again', 'The host keeps a SECOND set of page tables — Intel calls them EPT (Extended Page Tables), AMD calls them NPT — mapping each guest-physical address to a real host-physical one. So the guest’s page tables live at guest-physical addresses that the hardware must translate through the EPT before it can even read them.', TOTAL),
    scene('twod', 'The walk becomes a grid', 'Here’s the twist. Every pointer in the guest’s 4-level walk is a guest-physical address, and to dereference it the CPU must first run the full 4-level EPT walk to find where it really lives. The single linear walk turns two-dimensional: guest levels across, an EPT sub-walk down at each one.', TOTAL),
    scene('count', '24 memory accesses for one address', 'Count them: four guest table levels plus the final page each need a four-level EPT walk — 5 × 4 = 20 EPT reads — plus the 4 guest PTE reads themselves = 24 memory accesses to translate ONE address, against 4 without virtualization. (Verified: the count is L·(L+2) = 24 for four-level tables, and the nested result equals doing the two translations in sequence.)', TOTAL),
    scene('tlb', 'Why the TLB earns its keep', '24 dependent memory accesses per translation would be crippling, so the TLB — caching the finished guest-virtual → host-physical mapping — and the paging-structure caches do enormous work; a hit skips the whole grid. This cost is exactly why hardware nested paging only overtook the older software “shadow page tables” once these caches were good enough.', TOTAL),
    { key: 'run', title: 'Walk the 2-D translation', caption: 'Step through translating one guest-virtual address. Each column is a stage of the guest’s page-table walk; the cells beneath it are the EPT sub-walk that finds where that guest-physical pointer really lives in host RAM. The counter climbs to 24 — the full cost of a single TLB miss under virtualization, and why the TLB matters.', render: () => <Walk phase="run" step={step} onStep={setStep} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>Inside a VM, the guest OS translates a guest-virtual address through its own 4-level page tables to a <strong>guest-physical</strong> address — but that isn’t real RAM. The hypervisor keeps a second 4-level table (<strong>EPT</strong>/NPT) mapping guest-physical → <strong>host-physical</strong>, and because the guest’s page tables themselves sit at guest-physical addresses, every pointer in the guest walk must first be translated through the EPT. The one linear walk becomes a <strong>2-D grid</strong>, costing 24 memory accesses instead of 4 — which is why the TLB matters so much.</>,
        takeaway: <>Virtualizing memory needs two levels of address translation. The guest OS maps <strong>guest-virtual → guest-physical</strong> with its own 4-level page tables, and the hypervisor maps <strong>guest-physical → host-physical</strong> with a second 4-level structure — Intel’s <strong>Extended Page Tables (EPT)</strong> or AMD’s <strong>Nested Page Tables (NPT)</strong>. The subtlety is that the guest’s page tables are stored at guest-physical addresses, so to read each guest PTE the CPU must first translate <em>that</em> address through the EPT. The walk becomes <strong>two-dimensional</strong>: the guest’s four levels run along one axis, and at each one a full EPT walk runs down the other. Counting the memory accesses for a complete miss: the 4 guest table levels and the final data page each require a 4-level EPT walk (5 × 4 = 20 EPT reads), plus the 4 guest PTE reads themselves, for <strong>L·(L+2) = 24</strong> accesses when L = 4 (verified here, along with the nested walk yielding the same host-physical address as composing the two translations) — versus 4 on bare metal. Because those 24 accesses are serially dependent, they are murderous on a miss, so the hardware leans hard on the <strong>TLB</strong> (which caches the final guest-virtual → host-physical mapping) and on paging-structure caches that memoize partial walks. This is why <strong>hardware nested paging</strong> only displaced the earlier software approach — <strong>shadow page tables</strong>, where the hypervisor maintained a single merged table and trapped every guest page-table edit — once these caches made the 2-D walk cheaper than the trap-and-emulate overhead. The same doubling appears in <strong>IOMMU</strong> translation for device DMA and, conceptually, in any nested address space.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="np-ctl">
          <button type="button" className="np-btn" onClick={() => setStep((v) => Math.max(0, v - 1))}>‹ back</button>
          <button type="button" className="np-btn" onClick={() => setStep((v) => Math.min(TOTAL, v + 1))}>access ›</button>
          <button type="button" className="np-btn" onClick={() => setStep(TOTAL)}>all 24</button>
          <span className="np-read">memory access {Math.min(step, TOTAL)}/{TOTAL}{step >= TOTAL ? ' · host-physical resolved ✓' : ''}</span>
        </div>
      )}
    />
  );
}

function Walk({ phase, step, onStep }: { phase: Phase; step: number; onStep?: (n: number) => void }) {
  const on = (p: Phase) => phase === p; void onStep;
  const st = Math.min(step, TOTAL);
  const idxOf = (col: number, row: number, guest: boolean) => ORDER.findIndex((a) => a.col === col && a.row === row && a.guest === guest);
  const done = (col: number, row: number, guest: boolean) => { const i = idxOf(col, row, guest); return i >= 0 && i < st; };
  const isCur = (col: number, row: number, guest: boolean) => idxOf(col, row, guest) === st - 1;
  const cx = (c: number) => GX + c * CW;
  return (
    <svg viewBox="0 0 760 300" className="story-svg">
      <text x="56" y="22" className="np-col">nested paging (EPT) · guest-virtual → guest-physical → host-physical · {st}/{TOTAL} accesses</text>

      {/* guest walk header row */}
      <text x={40} y={GY + 16} className="np-axis" textAnchor="end">guest</text>
      {GUEST.map((g, c) => <g key={c}>
        <rect x={cx(c)} y={GY} width={CW - 14} height={26} rx="4" className={`np-guest ${c === GUEST.length - 1 ? 'data' : ''}`} />
        <text x={cx(c) + (CW - 14) / 2} y={GY + 17} className="np-gt" textAnchor="middle">{g}</text>
        {/* guest PTE read marker (between stages) */}
        {c < GUEST.length - 1 && <g><rect x={cx(c) + CW - 14} y={GY} width={14} height={26} className={`np-gread ${done(c, -1, true) ? 'on' : ''} ${isCur(c, -1, true) ? 'cur' : ''}`} /></g>}
      </g>)}

      {/* EPT sub-walk under each guest stage */}
      <text x={40} y={EY + 40} className="np-axis" textAnchor="end">EPT</text>
      {GUEST.map((_g, c) => EPT.map((e, r) => <g key={c + '-' + r}>
        <rect x={cx(c)} y={EY + r * CH} width={CW - 14} height={CH - 5} rx="3" className={`np-ept ${done(c, r, false) ? 'on' : ''} ${isCur(c, r, false) ? 'cur' : ''}`} />
        <text x={cx(c) + 8} y={EY + r * CH + 17} className="np-et">{e}</text>
      </g>))}

      {/* host-physical result */}
      {st >= TOTAL && <text x={cx(GUEST.length - 1) + (CW - 14) / 2} y={EY + EPT.length * CH + 14} className="np-hpa" textAnchor="middle">→ host-physical ✓</text>}

      <text x="380" y="292" className="np-foot" textAnchor="middle">
        {on('guest') ? 'guest walks its 4-level table to a guest-physical address'
          : on('hyper') ? 'but guest-physical must be remapped by the EPT to host-physical'
          : on('twod') ? 'each guest pointer needs a full EPT walk → the walk goes 2-D'
          : on('count') ? '5 EPT walks (20) + 4 guest PTE reads = 24 accesses (vs 4 bare-metal)'
          : on('tlb') ? '24 dependent accesses per miss → the TLB caches the final mapping'
          : st >= TOTAL ? `resolved in ${TOTAL} accesses — this is one TLB miss under virtualization` : `access ${st}: ${st && ORDER[st - 1].guest ? 'read a guest PTE' : 'EPT sub-walk step'}`}
      </text>
    </svg>
  );
}
