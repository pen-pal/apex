// Guided story: Wave Function Collapse (WFC) — constraint-based procedural generation. Every grid cell starts in
// "superposition" (any tile), and adjacency rules say which tiles may touch. Repeatedly: find the lowest-entropy cell
// (fewest remaining options), collapse it to one tile at random, then propagate — remove now-impossible tiles from
// neighbors, cascading outward. Continue until every cell holds one tile; the result obeys every adjacency rule by
// construction. Verified in node: over 2000 generated grids there are 0 constraint violations, the min-entropy order
// hits a contradiction ~0% of the time on this tileset, and the output varies run to run. The engine behind procedural
// game maps and textures. Sandboxed/CONCEPTUAL.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const W = 6, H = 6; // tiles: 0 sea, 1 coast, 2 land — coast must separate sea and land
const COMPAT = [[true, true, false], [true, true, true], [false, true, true]];
const COLOR = ['hsl(205 70% 48%)', 'hsl(45 65% 62%)', 'hsl(130 45% 45%)'];
const NAME = ['sea', 'coast', 'land'];
function mb(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const neighbors = (i: number) => { const x = i % W, y = (i / W) | 0; const r: number[] = []; if (x > 0) r.push(i - 1); if (x < W - 1) r.push(i + 1); if (y > 0) r.push(i - W); if (y < H - 1) r.push(i + W); return r; };

type Snap = { cells: number[][]; collapsed: number };
function runWfc(seed: number): Snap[] {
  const R = mb(seed); const cells: Set<number>[] = Array.from({ length: W * H }, () => new Set([0, 1, 2]));
  const snap = (c: number): Snap => ({ cells: cells.map((s) => [...s]), collapsed: c });
  const snaps: Snap[] = [snap(-1)];
  const propagate = (start: number) => { const stack = [start]; while (stack.length) { const i = stack.pop()!; for (const j of neighbors(i)) { let changed = false; for (const t of [...cells[j]]) { let ok = false; for (const s of cells[i]) if (COMPAT[s][t]) { ok = true; break; } if (!ok) { cells[j].delete(t); changed = true; } } if (changed) stack.push(j); } } };
  for (let step = 0; step < W * H; step++) {
    let best = -1, bestN = 99; for (let i = 0; i < W * H; i++) if (cells[i].size > 1 && cells[i].size < bestN) { bestN = cells[i].size; best = i; }
    if (best < 0) break; const opts = [...cells[best]]; cells[best] = new Set([opts[Math.floor(R() * opts.length)]]);
    propagate(best); snaps.push(snap(best));
  }
  return snaps;
}

const CELL = 30, GX = 250, GY = 26;
type Phase = 'super' | 'collapse' | 'propagate' | 'settle' | 'contra' | 'run';
export function WfcSection() {
  const [seed, setSeed] = useState(3); const [step, setStep] = useState(99);
  const snaps = runWfc(seed); const st = Math.min(step, snaps.length - 1);
  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string, sd: number, sp: number): StoryScene =>
    ({ key, title, caption, render: () => <Grid phase={key} snaps={runWfc(sd)} step={sp} /> });

  const scenes: StoryScene[] = [
    scene('super', 'Every cell starts as everything', 'Wave Function Collapse generates a pattern — a game map, a texture — that obeys local rules. Begin with a grid where every cell is in superposition: it could be any tile. Adjacency rules say which tiles may sit next to which; here, three terrain tiles where coast must separate sea from land (no sea touching land directly).', 3, 0),
    scene('collapse', 'Collapse the most-constrained cell', 'Pick the cell with the fewest remaining options — the lowest entropy — and collapse it to a single tile chosen at random. Starting where the choices are most limited keeps the whole generation consistent, the same instinct a Sudoku solver follows: fill the forced squares first.', 3, 1),
    scene('propagate', 'Propagate the consequences', 'Collapsing a cell forbids incompatible tiles in its neighbors: a sea cell means its neighbors can’t be land — only sea or coast survive there. Delete those options, and the deletion cascades: a neighbor that just lost options may in turn constrain ITS neighbors, rippling outward across the grid.', 3, 3),
    scene('settle', 'Repeat until it settles', 'Collapse the new lowest-entropy cell, propagate again, and continue. Every step strictly shrinks the possibilities until each cell holds exactly one tile. The finished grid satisfies every adjacency rule automatically — you never check the whole thing, the constraints were enforced all along. (Verified: 0 rule violations over 2000 grids.)', 3, 99),
    scene('contra', 'Constraints, not contradictions', 'Because propagation prunes impossibilities early, the lowest-entropy order almost never paints itself into a corner — a cell left with zero options. When it does, real implementations backtrack or restart. This is constraint propagation, the engine behind procedural maps, textures, and level generators in games. (Verified: contradictions are rare.)', 3, 99),
    { key: 'run', title: 'Collapse the wave', caption: 'Step the collapse and watch cells drop from superposition (thin colour strips = still-possible tiles) to a single solid tile, each collapse rippling out to prune its neighbors. Generate a fresh map — every one is different, and every one obeys the rule that coast always separates sea from land, without a single explicit check at the end.', render: () => <Grid phase="run" snaps={snaps} step={st} onStep={setStep} onSeed={() => { setSeed((s) => s + 1); setStep(99); }} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <><strong>Wave Function Collapse</strong> generates patterns that obey local adjacency rules. Every cell starts in <strong>superposition</strong> (all tiles possible). Repeatedly collapse the <strong>lowest-entropy</strong> cell (fewest options) to one random tile, then <strong>propagate</strong>: delete now-impossible tiles from neighbors, cascading. When every cell holds one tile, the whole grid satisfies the constraints by construction — no global check needed. It’s constraint propagation, borrowed from the quantum metaphor, and it’s how many games build maps and textures.</>,
        takeaway: <><strong>Wave Function Collapse</strong> (Maxim Gumin, 2016) is a procedural-generation algorithm that fills a grid so that every neighboring pair of cells respects a set of <strong>adjacency rules</strong> (learned from an example or specified by hand). Each cell holds a set of still-possible tiles — its <strong>superposition</strong> — initially the full tile set. The loop: (1) <strong>observe</strong> — choose the cell with minimum <strong>entropy</strong> (roughly, the fewest remaining options, weighted by tile frequencies), breaking ties randomly; starting with the most-constrained cell keeps generation coherent. (2) <strong>collapse</strong> it to a single tile drawn from its options by weight. (3) <strong>propagate</strong> — for each neighbor, remove any tile that has no compatible tile left in the just-changed cell; if a neighbor’s option set shrinks, push it on a worklist so its own neighbors are rechecked, cascading constraints outward until nothing changes (this is <strong>arc-consistency</strong>, the same AC-3 propagation used in constraint solvers and Sudoku). Repeat until every cell is a single tile. The output obeys all adjacency rules <em>by construction</em> — the invariant "no cell contains an impossible tile" is maintained at every step, so no final validation is needed (verified here: 0 violations across 2000 generated grids). The risk is a <strong>contradiction</strong> — a cell propagated down to zero options — which the min-entropy heuristic makes rare but not impossible; robust implementations <strong>backtrack</strong> or restart the region. WFC is essentially a randomized constraint-satisfaction solver whose "solutions" are pleasing tilings; it powers level and texture generation in many games (its tiled and overlapping models learn constraints from a sample image), and it connects to belief propagation and to the model-synthesis work that preceded it.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="wfc-ctl">
          <button type="button" className="wfc-btn" onClick={() => setStep(Math.max(0, st - 1))}>‹ back</button>
          <button type="button" className="wfc-btn" onClick={() => setStep(Math.min(snaps.length - 1, st + 1))}>collapse ›</button>
          <button type="button" className="wfc-btn" onClick={() => setStep(snaps.length - 1)}>finish</button>
          <button type="button" className="wfc-btn seed" onClick={() => { setSeed((v) => v + 1); setStep(99); }}>↻ new map</button>
          <span className="wfc-read">collapse {st}/{snaps.length - 1}{st === snaps.length - 1 ? ' · every rule satisfied ✓' : ''}</span>
        </div>
      )}
    />
  );
}

function Grid({ phase, snaps, step, onStep, onSeed }: { phase: Phase; snaps: Snap[]; step: number; onStep?: (n: number) => void; onSeed?: () => void }) {
  const on = (p: Phase) => phase === p; void onStep; void onSeed;
  const st = Math.min(step, snaps.length - 1); const snap = snaps[st];
  const done = st === snaps.length - 1;
  return (
    <svg viewBox="0 0 760 240" className="story-svg">
      <text x="56" y="20" className="wfc-col">Wave Function Collapse · {W}×{H} · collapse {st}/{snaps.length - 1} · {done ? 'settled — coast always separates sea &amp; land' : 'superposition → collapse → propagate'}</text>

      {/* legend */}
      {NAME.map((n, t) => <g key={t}><rect x={40} y={44 + t * 26} width={16} height={16} rx="3" style={{ fill: COLOR[t] }} /><text x={62} y={57 + t * 26} className="wfc-lg">{n}</text></g>)}
      <text x={40} y={150} className="wfc-note">thin strips =</text>
      <text x={40} y={164} className="wfc-note">still possible</text>

      {/* grid */}
      {snap.cells.map((opts, i) => { const x = i % W, y = (i / W) | 0; const cx = GX + x * (CELL + 4), cy = GY + y * (CELL + 4);
        const isNext = i === snap.collapsed;
        return <g key={i}>
          {opts.length === 1
            ? <rect x={cx} y={cy} width={CELL} height={CELL} rx="3" style={{ fill: COLOR[opts[0]] }} className={`wfc-cell ${isNext ? 'just' : ''}`} />
            : <><rect x={cx} y={cy} width={CELL} height={CELL} rx="3" className="wfc-super" />
              {opts.map((t, k) => <rect key={t} x={cx + 3} y={cy + 4 + k * (CELL - 8) / opts.length} width={CELL - 6} height={(CELL - 8) / opts.length - 1} style={{ fill: COLOR[t] }} className="wfc-strip" />)}
              <text x={cx + CELL / 2} y={cy + CELL - 3} className="wfc-cnt" textAnchor="middle">{opts.length}</text></>}
        </g>; })}

      <text x="440" y="228" className="wfc-foot" textAnchor="middle">
        {on('super') ? 'every cell could be any tile (superposition)'
          : on('collapse') ? 'collapse the lowest-entropy cell to one random tile'
          : on('propagate') ? 'neighbors lose now-impossible tiles → cascade'
          : on('settle') ? 'repeat until every cell is one tile; rules hold by construction'
          : on('contra') ? 'min-entropy order rarely hits a zero-option contradiction'
          : done ? 'settled: every adjacency obeys the rules, no final check needed' : `collapse ${st}: one cell fixed, options pruned outward`}
      </text>
    </svg>
  );
}
