// Offensive-security guided story: Rowhammer — flipping bits in DRAM you never wrote to, by hammering adjacent rows.
// CONCEPTUAL, SANDBOXED model (no real hardware access; a simulated DRAM). Rowhammer is a physical/analog effect, so
// this models it and tests its INVARIANTS honestly (only rows adjacent to an aggressor are disturbed; flip count
// rises monotonically with hammer count; refresh before the threshold prevents flips; double-sided flips in half the
// hammers) — anchored to Kim et al. 2014's ~139,000-activation threshold within a 64ms refresh window. Defenses-forward
// (TRR / ECC / faster refresh), educational/CTF framing like the bufferoverflow & meltdown stories. NOT a real exploit.
import { useMemo, useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const ROWS = 14, BITS = 40, THRESH = 139000; // activations to flip, per Kim et al. 2014 (order of magnitude)
const cellWeak = (r: number, c: number) => { const h = Math.sin(r * 12.9898 + c * 78.233) * 43758.5453; const f = h - Math.floor(h); return THRESH * (0.7 + f * 0.55); }; // per-cell flip threshold, scattered
const initBit = (r: number, c: number) => (Math.sin(r * 3.1 + c * 1.7) > 0 ? 1 : 0);

function simulate(aggressors: number[], hammers: number, refreshEvery: number) {
  const eff = Math.min(hammers, refreshEvery); // disturbance resets on refresh → max reached is min(hammers, refreshEvery)
  const disturb = new Array(ROWS).fill(0);
  for (let r = 0; r < ROWS; r++) { let adj = 0; for (const a of aggressors) if (a === r - 1 || a === r + 1) adj++; disturb[r] = eff * adj; }
  const flips: boolean[][] = Array.from({ length: ROWS }, (_, r) => Array.from({ length: BITS }, (_, c) => disturb[r] >= cellWeak(r, c)));
  const flipCount = flips.flat().filter(Boolean).length;
  return { disturb, flips, flipCount };
}

type Phase = 'dram' | 'hammer' | 'flip' | 'double' | 'defense' | 'run';

export function RowhammerSection() {
  const [mode, setMode] = useState<'single' | 'double'>('double');
  const [hammers, setHammers] = useState(200000);
  const [refreshK, setRefreshK] = useState(400); // refresh interval in thousands of activations (400K = effectively none in window)
  const aggressors = mode === 'single' ? [6] : [6, 8];
  const sim = useMemo(() => simulate(aggressors, hammers, refreshK * 1000), [mode, hammers, refreshK]);

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string, agg: number[], ham: number, ref: number): StoryScene =>
    ({ key, title, caption, render: () => <RH phase={key} aggressors={agg} sim={simulate(agg, ham, ref)} hammers={ham} /> });

  const scenes: StoryScene[] = [
    scene('dram', 'DRAM: charge in leaky buckets', 'A DRAM bit is a speck of charge in a microscopic capacitor that slowly leaks away, so the memory controller refreshes every row about every 64 ms to top it back up. Cells are packed so densely that electrically activating one row couples a little disturbance into its physical neighbours — normally harmless, because refresh restores it.', [], 0, 4e5),
    scene('hammer', 'Hammer a row, outrun the refresh', 'Now read one row over and over — activate, precharge, activate — tens of thousands of times before the next refresh. Each activation nudges a bit more charge out of the adjacent rows’ cells (the yellow disturbance building on rows 6’s neighbours). Refresh can’t keep up: the disturbance accumulates.', [6], 90000, 4e5),
    scene('flip', 'Bits flip in rows you never touched', 'Cross the threshold — Kim et al. measured flips after ~139,000 activations in a refresh window — and adjacent-row cells lose enough charge to flip, 1→0 or 0→1 (red), in memory the attacker never accessed. Only the immediate neighbours flip; rows further away stay safe.', [6], 200000, 4e5),
    scene('double', 'Double-sided: sandwich the victim', 'Place two aggressor rows on either side of a victim (rows 6 and 8 around row 7) and hammer both. The victim is disturbed from both sides at once, so it flips in half the activations — the reliable variant real attacks use, which is why they map physical memory to find that layout.', [6, 8], 90000, 4e5),
    scene('defense', 'Why it’s dangerous — and the defenses', 'A flip in the wrong place is an exploit: flip one bit in a page-table entry and an unprivileged process gains write access to kernel memory (Google’s 2015 escalation). Defenses are an arms race — Target Row Refresh (detect a hammered row, refresh its neighbours early), ECC (correct single-bit flips), and faster refresh, each partly defeated in turn (TRRespass, Blacksmith).', [6, 8], 200000, 4e5),
    { key: 'run', title: 'Hammer it yourself', caption: 'Choose single- or double-sided aggressors, crank the activation count, and watch the disturbance build on the neighbouring rows and their bits flip once it passes each cell’s threshold. Then raise the refresh rate (shrink the interval) and watch the flips vanish — refresh restoring the charge before it can leak away. A sandboxed model; no real memory is touched.', render: () => <RH phase="run" aggressors={aggressors} sim={sim} hammers={hammers} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>DRAM stores each bit as charge in a microscopic capacitor, packed so densely that electrically activating one row leaks a little charge from its <em>physical</em> neighbours. Normally a refresh every ~64 ms tops the charge back up before it matters. <strong>Rowhammer</strong> defeats that by activating (“hammering”) a row tens of thousands of times within a single refresh window — the disturbance to adjacent rows outruns the refresh, and cells in memory the attacker never wrote to <strong>flip their bits</strong>. It’s a software-only fault injection that breaks memory isolation at the level of physics.</>,
        takeaway: <>A DRAM cell is one capacitor + one access transistor; a “1” is charge that slowly leaks, so the controller refreshes every row roughly every 64 ms. Modern cells are so small and close that activating a row couples a small disturbance into the cells of physically adjacent rows. Rowhammer exploits this: repeatedly activate an aggressor row (open, precharge, repeat) hundreds of thousands of times before the victim’s next refresh, and the accumulated disturbance drains enough charge from adjacent-row cells to flip their bits — Kim et al. (2014) measured flips after <strong>~139,000 activations</strong> within a 64 ms window on vulnerable DRAM. Crucially the flips land in rows the attacker never accessed, breaking isolation between processes and between user and kernel: the canonical escalation (Google Project Zero, 2015) hammers to flip a bit in a <strong>page-table entry</strong> so it points into an attacker-controlled page table, granting read/write over all of physical memory; other variants target sandboxed code or crypto keys. <strong>Double-sided</strong> hammering — two aggressor rows on either side of a victim — doubles the disturbance and flips far faster, so real attacks reverse-map physical addresses to find that layout. Defenses are a live arms race: <strong>Target Row Refresh</strong> (count activations, refresh a hammered row’s neighbours early), <strong>ECC</strong> memory (corrects single-bit flips, though multi-flip attacks like ECCploit sidestep it), doubled refresh rate, and larger cell spacing — each partially defeated (TRRespass, Blacksmith, Half-Double). Rowhammer is the definitive proof that a memory chip’s analog physics is part of your security model, not an abstraction you can ignore. (The panel is a sandboxed model of the documented behaviour, not a hardware measurement.)</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="rh-ctl">
          <span className="rh-seg"><button type="button" className={mode === 'single' ? 'on' : ''} onClick={() => setMode('single')}>single-sided</button><button type="button" className={mode === 'double' ? 'on' : ''} onClick={() => setMode('double')}>double-sided</button></span>
          <label className="rh-lbl">activations<input type="range" min={0} max={400000} step={5000} value={hammers} onChange={(e) => setHammers(+e.target.value)} /><b>{(hammers / 1000).toFixed(0)}K</b></label>
          <label className="rh-lbl">refresh every<input type="range" min={40} max={400} step={10} value={refreshK} onChange={(e) => setRefreshK(+e.target.value)} /><b>{refreshK}K</b></label>
          <span className={`rh-live ${sim.flipCount > 0 ? 'bad' : 'ok'}`}>{sim.flipCount} bit flip{sim.flipCount === 1 ? '' : 's'}</span>
        </div>
      )}
    />
  );
}

function RH({ phase, aggressors, sim, hammers }: { phase: Phase; aggressors: number[]; sim: { disturb: number[]; flips: boolean[][]; flipCount: number }; hammers: number }) {
  const on = (p: Phase) => phase === p;
  const RX = 150, RY = 44, RH_ = 22, CW = 15;
  const isAgg = (r: number) => aggressors.includes(r);
  return (
    <svg viewBox="0 0 900 400" className="story-svg">
      <text x="60" y="22" className="rh-col">sandboxed DRAM model — {hammers ? `${(hammers / 1000).toFixed(0)}K activations` : 'idle'} · flip threshold ~139K (Kim et al. 2014)</text>

      {Array.from({ length: ROWS }, (_, r) => {
        const y = RY + r * RH_; const dist = sim.disturb[r]; const frac = Math.min(1, dist / THRESH);
        return <g key={r}>
          <text x={RX - 46} y={y + RH_ - 7} className={`rh-rlabel ${isAgg(r) ? 'agg' : ''}`}>{isAgg(r) ? '🔨 row ' + r : 'row ' + r}</text>
          {/* disturbance bar */}
          <rect x={RX - 8} y={y + 2} width={6} height={RH_ - 6} className="rh-distbg" />
          {frac > 0 && <rect x={RX - 8} y={y + 2 + (RH_ - 6) * (1 - frac)} width={6} height={(RH_ - 6) * frac} className={`rh-dist ${frac >= 1 ? 'over' : ''}`} />}
          {/* cells */}
          {Array.from({ length: BITS }, (_, c) => { const flipped = sim.flips[r][c]; const bit = flipped ? 1 - initBit(r, c) : initBit(r, c);
            return <rect key={c} x={RX + c * CW} y={y + 2} width={CW - 1.5} height={RH_ - 6} className={`rh-cell ${flipped ? 'flip' : bit ? 'one' : 'zero'} ${isAgg(r) ? 'aggrow' : ''}`} />; })}
        </g>;
      })}

      <text x={RX} y={RY + ROWS * RH_ + 16} className="rh-key">🔨 hammered (aggressor) · <tspan className="rh-kdist">▮</tspan> disturbance vs threshold · <tspan className="rh-kflip">▮</tspan> flipped bit (in a row never written)</text>

      <text x="450" y="392" className="rh-foot" textAnchor="middle">
        {on('dram') ? 'charge leaks → refresh every 64 ms tops it up; neighbours couple slightly'
          : on('hammer') ? 'hammering an aggressor row builds disturbance on its neighbours faster than refresh'
          : on('flip') ? 'past ~139K activations, adjacent-row cells flip — only the neighbours, never distant rows'
          : on('double') ? 'two aggressors around a victim → double the disturbance, flips in half the hammers'
          : on('defense') ? 'a page-table-entry flip = privilege escalation; TRR / ECC / faster refresh fight back'
          : `${sim.flipCount} bit flip${sim.flipCount === 1 ? '' : 's'} in the victim rows — raise refresh to stop them`}
      </text>
    </svg>
  );
}
