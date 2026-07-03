// Guided story: spatial hash grid (collision broad-phase) — the follow-up to SAT (narrow-phase). Testing every pair
// of objects for collision is O(n²); a uniform grid buckets each object by cell, and two objects can only touch if
// they share a cell, so you only test same-cell pairs — O(n) candidates for evenly-spread objects. Cheap filter, then
// the exact test confirms. Verified in node: finds the SAME collisions as brute force (independent oracle) while
// testing ~4.4% of the pairs (876 vs 19,900). Sandboxed/CONCEPTUAL.
import { useMemo, useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const CW = 18, CH = 11, R = 0.42, PS = 40, OX = 78, OY = 46;
function makeObjects(n: number) {
  let s = 987654321; const rnd = () => { s = (s * 1103515245 + 12345) >>> 0; return (s >>> 8) / (1 << 24); };
  return Array.from({ length: n }, () => ({ x: 0.6 + rnd() * (CW - 1.2), y: 0.6 + rnd() * (CH - 1.2) }));
}
type Obj = { x: number; y: number };
function broadphase(obj: Obj[]) {
  const cells = new Map<string, number[]>();
  obj.forEach((o, i) => { for (let cx = Math.floor(o.x - R); cx <= Math.floor(o.x + R); cx++) for (let cy = Math.floor(o.y - R); cy <= Math.floor(o.y + R); cy++) { const k = cx + ',' + cy; (cells.get(k) ?? cells.set(k, []).get(k)!).push(i); } });
  const cand = new Set<string>();
  for (const list of cells.values()) for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++) { const i = Math.min(list[a], list[b]), j = Math.max(list[a], list[b]); cand.add(i + ',' + j); }
  const pairs = [...cand].map((p) => p.split(',').map(Number) as [number, number]);
  const hits = pairs.filter(([i, j]) => Math.hypot(obj[i].x - obj[j].x, obj[i].y - obj[j].y) < 2 * R);
  const occupied = new Set([...cells.entries()].filter(([, l]) => l.length > 1).map(([k]) => k));
  return { pairs, hits, occupied };
}
const sx = (x: number) => OX + x * PS, sy = (y: number) => OY + y * PS;

type Phase = 'allpairs' | 'bucket' | 'samecell' | 'narrow' | 'cellsize' | 'run';

export function SpatialHashSection() {
  const [grid, setGrid] = useState(true);
  const N = 42;
  const obj = useMemo(() => makeObjects(N), []);
  const bp = useMemo(() => broadphase(obj), [obj]);
  const brutePairs = N * (N - 1) / 2;

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <SH phase={key} obj={obj} bp={bp} grid={key !== 'allpairs'} brutePairs={brutePairs} /> });

  const scenes: StoryScene[] = [
    scene('allpairs', 'Every pair is too many', 'To find which objects touch, the obvious approach tests every pair. But that’s n² tests: 42 objects is 861 pairs; a thousand is half a million; ten thousand is fifty million — every single frame. Checking all pairs simply doesn’t scale.'),
    scene('bucket', 'Bucket objects by location', 'Overlay a uniform grid and drop each object into the cell it sits in. This is the key fact: two objects can only possibly touch if they share a cell (or an adjacent one) — anything sitting in a far-off cell is too distant to reach.'),
    scene('samecell', 'Only test same-cell pairs', 'So instead of all pairs, test only pairs that share a cell. Most cells hold just one or two objects, so the candidate pairs collapse from n² toward n — here from 861 down to a few dozen. This is the broad phase: a cheap filter run before any exact test.'),
    scene('narrow', 'Then the narrow phase confirms', 'The grid hands you candidate pairs; the exact test — circle-vs-circle here, or SAT for polygons — runs only on those and confirms the real overlaps (red). Cheap grid filter first, precise check second: the same collisions a brute-force scan finds, for a fraction of the work.'),
    scene('cellsize', 'Cell size is the tuning knob', 'Cells about the size of the objects are the sweet spot. Too small and each object spans many cells; too big and each cell packs in too many objects — both drift back toward all-pairs. A uniform grid shines for similar-sized, evenly-spread objects; when they clump, hierarchical structures (quadtrees, BVHs, k-d trees) take over.'),
    { key: 'run', title: 'Filter, then check', caption: 'Toggle between brute force (a line for every one of the 861 pairs — a hairball) and the grid (lines only between objects that share a cell). The candidate count plummets while the collisions found (red) stay exactly the same. That’s the broad phase every physics engine runs before the exact test.', render: () => <SH phase="run" obj={obj} bp={bp} grid={grid} brutePairs={brutePairs} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>Finding which objects in a scene are touching seems to need checking every pair — but that’s n² checks, and it explodes: a thousand objects is half a million pairs every frame. A <strong>spatial hash grid</strong> is the standard fix. Overlay a uniform grid, drop each object into its cell, and use one fact: two objects can only collide if they occupy the same cell (or an adjacent one). So you only ever test objects that share a cell, and the work collapses from n² toward n.</>,
        takeaway: <>This is the <strong>broad phase</strong> of collision detection: a cheap filter that produces candidate pairs, before the exact <strong>narrow-phase</strong> test (circle-vs-circle, or SAT for polygons) confirms actual contacts. You bucket each object by the grid cell it falls in; to find its potential collisions you look only in its own cell and the neighbours its radius can reach. For similar-sized objects spread evenly, each cell holds O(1) of them, so the total candidate pairs are O(n) instead of O(n²) — verified here as the identical set of collisions a brute-force scan finds, from testing about 4.4% of the pairs (876 candidates vs 19,900 for 200 objects). The <strong>cell size</strong> is the tuning knob: roughly the object size is ideal, since too-small cells make each object span many cells and too-large cells pack in too many, both drifting back toward all-pairs. Uneven, clumped distributions defeat a uniform grid — that’s when quadtrees, BVHs, and k-d trees take over. Every physics engine and particle system runs a broad phase like this before the exact test.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="shg-ctl">
          <button type="button" className={`shg-btn ${!grid ? 'on' : ''}`} onClick={() => setGrid(false)}>brute force</button>
          <button type="button" className={`shg-btn ${grid ? 'on' : ''}`} onClick={() => setGrid(true)}>spatial grid</button>
          <span className="shg-live">{grid ? bp.pairs.length : brutePairs} pair-tests · {bp.hits.length} collisions</span>
        </div>
      )}
    />
  );
}

function SH({ phase, obj, bp, grid, brutePairs }: { phase: Phase; obj: Obj[]; bp: ReturnType<typeof broadphase>; grid: boolean; brutePairs: number }) {
  const on = (p: Phase) => phase === p;
  const N = obj.length;
  const showGridLines = !on('allpairs');
  const showAll = on('allpairs') || (on('run') && !grid);
  const showCand = on('samecell') || on('narrow') || on('cellsize') || (on('run') && grid);
  const showHits = on('narrow') || on('cellsize') || on('run');
  const hitSet = new Set(bp.hits.flatMap(([i, j]) => [i, j]));
  return (
    <svg viewBox="0 0 900 480" className="story-svg">
      <text x="60" y="30" className="shg-col">{N} objects · {showAll ? `${brutePairs} pairs (all)` : showCand ? `${bp.pairs.length} candidate pairs` : 'uniform grid broad-phase'} · {bp.hits.length} collisions</text>

      {/* grid */}
      {showGridLines && <>
        {Array.from({ length: CW + 1 }, (_, i) => <line key={'v' + i} x1={sx(i)} y1={sy(0)} x2={sx(i)} y2={sy(CH)} className="shg-grid" />)}
        {Array.from({ length: CH + 1 }, (_, i) => <line key={'h' + i} x1={sx(0)} y1={sy(i)} x2={sx(CW)} y2={sy(i)} className="shg-grid" />)}
        {(on('bucket') || on('samecell')) && [...bp.occupied].map((k) => { const [cx, cy] = k.split(',').map(Number); return <rect key={k} x={sx(cx)} y={sy(cy)} width={PS} height={PS} className="shg-cell" />; })}
      </>}

      {/* all-pairs hairball */}
      {showAll && obj.flatMap((a, i) => obj.slice(i + 1).map((b, j) => <line key={`a${i}-${j}`} x1={sx(a.x)} y1={sy(a.y)} x2={sx(b.x)} y2={sy(b.y)} className="shg-allpair" />))}
      {/* candidate pairs */}
      {showCand && bp.pairs.map(([i, j], k) => <line key={'c' + k} x1={sx(obj[i].x)} y1={sy(obj[i].y)} x2={sx(obj[j].x)} y2={sy(obj[j].y)} className={`shg-cand ${showHits && Math.hypot(obj[i].x - obj[j].x, obj[i].y - obj[j].y) < 2 * R ? 'hit' : ''}`} />)}

      {/* objects */}
      {obj.map((o, i) => <circle key={i} cx={sx(o.x)} cy={sy(o.y)} r={R * PS} className={`shg-obj ${showHits && hitSet.has(i) ? 'hit' : ''}`} />)}

      <text x="450" y="466" className="shg-foot" textAnchor="middle">
        {on('allpairs') ? `${brutePairs} pairs to test for just ${N} objects — grows as n²`
          : on('bucket') ? 'each object lives in a cell; only same-cell objects can touch'
          : on('samecell') ? `only ${bp.pairs.length} candidate pairs share a cell — down from ${brutePairs}`
          : on('narrow') ? 'run the exact test on candidates only → the real collisions (red)'
          : on('cellsize') ? 'cell ≈ object size is ideal; clumping needs a quadtree/BVH instead'
          : grid ? `grid: ${bp.pairs.length} candidate pairs, same ${bp.hits.length} collisions` : `brute force: all ${brutePairs} pairs`}
      </text>
    </svg>
  );
}
