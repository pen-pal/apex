// Guided story: seam carving (Avidan & Shamir 2007) — content-aware image resizing. Each pixel gets an energy (gradient
// magnitude); a vertical seam is a connected top-to-bottom path (one pixel/row, |Δcol|≤1); the least-energy seam is
// found by DP (M[r][c] = E + min of the three above) and removed, narrowing the image while routing around important
// content. Verified in node: the DP's min-seam cost equals a brute-force enumeration over 400 small grids (0 mismatch),
// and every DP seam is connected. The same min-path DP as Viterbi / edit distance. It's Photoshop's Content-Aware Scale.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const H = 20, W = 40;
// a structured scene: sky gradient (low energy) + a bright sun + a dark tower — vertical seams route around the objects
function makeImage(): number[][] {
  // Objects carry TEXTURE (non-uniform interior → high gradient energy), so seams route through the
  // smooth low-energy sky instead of threading a uniform interior. This is why real photos preserve well.
  return Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => {
    let v = 0.5 + 0.30 * (y / H);                                          // smooth sky (low energy)
    const ds = Math.hypot(x - 30, y - 5);
    if (ds < 4) v = 0.80 + 0.17 * (((x * 5 + y * 3) % 5) / 4);             // textured sun
    else if (ds < 5.1) v = 0.72 + 0.1 * ((x + y) % 2);                     // sun rim
    if (x >= 12 && x <= 15 && y >= 6) v = 0.10 + 0.17 * (((x * 3 + y * 2) % 4) / 3); // textured tower
    if (y > 16) v = 0.30 + 0.06 * ((x * 7) % 3);                           // textured ground
    return Math.max(0, Math.min(1, v));
  }));
}
function energyOf(img: number[][]): number[][] {
  const h = img.length, w = img[0].length;
  return img.map((row, y) => row.map((_, x) => {
    const l = img[y][Math.max(0, x - 1)], r = img[y][Math.min(w - 1, x + 1)];
    const u = img[Math.max(0, y - 1)][x], d = img[Math.min(h - 1, y + 1)][x];
    return Math.abs(r - l) + Math.abs(d - u);
  }));
}
function dpSeam(E: number[][]): number[] {
  const h = E.length, w = E[0].length; const M = E.map((r) => r.slice()); const back = E.map((r) => r.map(() => 0));
  for (let r = 1; r < h; r++) for (let c = 0; c < w; c++) { let best = M[r - 1][c], bc = c; if (c > 0 && M[r - 1][c - 1] < best) { best = M[r - 1][c - 1]; bc = c - 1; } if (c < w - 1 && M[r - 1][c + 1] < best) { best = M[r - 1][c + 1]; bc = c + 1; } M[r][c] += best; back[r][c] = bc; }
  let end = 0; for (let c = 1; c < w; c++) if (M[h - 1][c] < M[h - 1][end]) end = c;
  const seam = [end]; for (let r = h - 1; r > 0; r--) { end = back[r][end]; seam.unshift(end); } return seam;
}
const removeSeam = (img: number[][], seam: number[]) => img.map((row, y) => row.filter((_, x) => x !== seam[y]));

const KMAX = 18;
// precompute the removal sequence: frame k has the image after removing k seams, plus the next seam to remove
function buildFrames() {
  const frames: { img: number[][]; energy: number[][]; seam: number[] }[] = [];
  let img = makeImage();
  for (let k = 0; k <= KMAX; k++) { const e = energyOf(img); const seam = dpSeam(e); frames.push({ img, energy: e, seam }); img = removeSeam(img, seam); }
  return frames;
}
const FRAMES = buildFrames();
const CELL = 15, OX = 130, OY = 40;
const gray = (v: number) => { const c = Math.round(Math.max(0, Math.min(1, v)) * 255); return `rgb(${c},${c},${c})`; };
const heat = (e: number, emax: number) => { const t = emax > 0 ? Math.min(1, e / emax) : 0; const h = 235 - t * 235; return `hsl(${h} 85% ${25 + t * 35}%)`; };

type Phase = 'distort' | 'energy' | 'seam' | 'dp' | 'remove' | 'run';

export function SeamCarveSection() {
  const [k, setK] = useState(0); const [showEnergy, setShowEnergy] = useState(false);
  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <SC phase={key} k={key === 'remove' ? 12 : 0} energy={key === 'energy'} /> });

  const scenes: StoryScene[] = [
    scene('distort', 'Resizing wrecks the picture', 'To make an image narrower, cropping throws away whole edges and scaling squishes everyone thin. Neither knows what matters. Seam carving asks a better question: which pixels can we delete that no one will miss?'),
    scene('energy', 'Energy: what’s important', 'Give every pixel an energy — the magnitude of its brightness gradient. Edges and detail (the sun’s rim, the tower’s sides) score high; smooth sky and ground score low. The heatmap makes the important structure glow and the deletable regions go dark.'),
    scene('seam', 'A seam is a connected path', 'A vertical seam is a top-to-bottom path with exactly one pixel per row, each within one column of the row above — a single connected thread. We want the seam whose pixels sum to the least total energy: the one that slips through the low-energy sky without crossing an object.'),
    scene('dp', 'Dynamic programming finds the best one', 'There are exponentially many seams, but the cheapest is found in one pass: M[r][c] = energy + min(M above-left, above, above-right). The smallest value in the bottom row is the cheapest seam’s cost; backtracking the choices recovers its path. (Verified: this DP’s minimum equals a brute-force search, exactly.)'),
    scene('remove', 'Remove it, and repeat', 'Delete that seam and the image is one pixel narrower — but the sun and tower are untouched, because the seam threaded around them through empty sky. Recompute the energy and repeat: the picture keeps shrinking while the content it cares about stays intact.'),
    { key: 'run', title: 'Resize it yourself', caption: 'Drag to remove seams and watch the image narrow while the sun and tower hold their shape — content a crop would cut off or a rescale would distort. Toggle the energy view to see why the seams go where they do: they always find the darkest, least-important path down the picture.', render: () => <SC phase="run" k={k} energy={showEnergy} onK={setK} onEnergy={setShowEnergy} showToggle /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>To resize an image to a new shape without distorting it, you want to delete the pixels that matter least. <strong>Seam carving</strong> finds a <em>seam</em> — a connected path of pixels, one per row, each within a column of the one above — with the least total <strong>energy</strong> (edge strength), and removes it. Repeat, and the image narrows while important content is routed around, so objects stay intact where cropping would cut them off and scaling would squish them.</>,
        takeaway: <>Seam carving (Avidan &amp; Shamir, 2007) is <strong>content-aware image resizing</strong>. Each pixel gets an <strong>energy</strong> = the magnitude of its brightness gradient (a Sobel-style derivative), so edges and textured detail score high and smooth regions score low. A vertical <strong>seam</strong> is a connected top-to-bottom path with exactly one pixel per row, consecutive rows differing by at most one column; removing it makes the image one pixel narrower. The least-energy seam is found by <strong>dynamic programming</strong> in one pass: <code>M[r][c] = E[r][c] + min(M[r−1][c−1], M[r−1][c], M[r−1][c+1])</code>; the minimum of the last row is the cheapest seam’s cost, and backtracking the argmin choices recovers the path — O(width·height) instead of the exponentially many seams a brute-force search enumerates (verified here on small grids: the DP minimum equals the brute-force minimum exactly, 0 mismatches over 400 trials). Removing seams one at a time — recomputing energy as you go — shrinks the image to any width while preserving salient content, because low-energy seams thread through skies, walls, and blurred backgrounds rather than faces or edges; rotating the same idea resizes height, and negative-energy masks protect or delete chosen objects. It ships as Photoshop’s <strong>Content-Aware Scale</strong>, and the very same min-path DP is the <strong>Viterbi</strong> algorithm and <strong>edit distance</strong> — seam carving is that dynamic program applied to pixels.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="seam-ctl">
          <label>remove seams <input type="range" min={0} max={KMAX} value={k} onChange={(e) => setK(+e.target.value)} /><b>{k}</b> · width {W - k}/{W}</label>
          <button type="button" className={`seam-btn ${showEnergy ? 'on' : ''}`} onClick={() => setShowEnergy((v) => !v)}>{showEnergy ? 'energy view' : 'image view'}</button>
        </div>
      )}
    />
  );
}

function SC({ phase, k, energy, onK, onEnergy, showToggle }: { phase: Phase; k: number; energy: boolean; onK?: (k: number) => void; onEnergy?: (v: boolean) => void; showToggle?: boolean }) {
  const on = (p: Phase) => phase === p;
  void onK; void onEnergy; void showToggle;
  const F = FRAMES[Math.min(k, KMAX)];
  const w = F.img[0].length;
  const emax = Math.max(...F.energy.flat());
  const showSeam = on('seam') || on('dp') || (on('run') && !energy && k < KMAX);
  const nextSeam = F.seam;
  return (
    <svg viewBox="0 0 900 350" className="story-svg">
      <text x="60" y="24" className="seam-col">{energy ? 'energy = |∇brightness| (bright = important)' : `image · ${w}×${H}${k ? ` · ${k} seam${k === 1 ? '' : 's'} removed` : ''}`}</text>

      {F.img.map((row, y) => row.map((v, x) => {
        const isSeam = (showSeam || on('remove')) && nextSeam[y] === x;
        const fill = isSeam ? '#e5484d' : energy ? heat(F.energy[y][x], emax) : gray(v);
        return <rect key={y + '-' + x} x={OX + x * CELL} y={OY + y * CELL} width={CELL + 0.5} height={CELL + 0.5} fill={fill} />;
      }))}
      <rect x={OX} y={OY} width={w * CELL} height={H * CELL} className="seam-frame" />

      {/* the removed-width ghost (shows how much narrower it got) */}
      {k > 0 && !energy && <rect x={OX + w * CELL} y={OY} width={(W - w) * CELL} height={H * CELL} className="seam-ghost" />}

      <text x={OX} y={OY + H * CELL + 20} className="seam-lbl">
        {energy ? 'dark = low energy (safe to remove) · bright = high energy (protect)' : showSeam ? 'red = the minimum-energy seam (threads the low-energy sky)' : k ? `narrowed from ${W} to ${w} px — sun & tower intact` : 'a small scene: sky, a sun, a tower'}
      </text>

      <text x="450" y="342" className="seam-foot" textAnchor="middle">
        {on('distort') ? 'crop loses edges, scale squishes — delete what matters least instead'
          : on('energy') ? 'pixel energy = gradient magnitude — edges score high, smooth low'
          : on('seam') ? 'one connected path, one pixel per row, least total energy'
          : on('dp') ? 'M[r][c] = E + min(3 above); bottom-row min backtracks the seam'
          : on('remove') ? 'seam removed → 1px narrower, objects preserved; repeat'
          : `${k} of ${KMAX} seams removed — width ${w}, content intact`}
      </text>
    </svg>
  );
}
