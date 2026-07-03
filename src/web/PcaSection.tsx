// Guided story: PCA — find the axes of maximum variance to compress high-dimensional data. The first principal
// component is the direction the data spreads most, which is exactly the top eigenvector of its covariance matrix;
// rotate into that basis (uncorrelated axes ordered by variance) and drop the small ones to reduce dimensions with
// minimal loss. Verified in node three ways: brute-force angle search, analytic eigenvector, and power iteration all
// agree on the max-variance direction (32° for a 30°-stretched cloud), which carries 91% of the variance. Sandboxed.
import { useMemo, useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

function makeData(): [number, number][] {
  let s = 23; const rnd = () => { s = (s * 1103515245 + 12345) >>> 0; return (s >>> 8) / (1 << 24); };
  const g = () => { const a = Math.max(1e-9, rnd()), b = rnd(); return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * b); };
  const th = Math.PI / 6, c = Math.cos(th), sn = Math.sin(th);
  return Array.from({ length: 220 }, () => { const u = g() * 2.2, v = g() * 0.72; return [u * c - v * sn, u * sn + v * c] as [number, number]; });
}
const PTS = makeData();
const MX = PTS.reduce((s, p) => s + p[0], 0) / PTS.length, MY = PTS.reduce((s, p) => s + p[1], 0) / PTS.length;
const COV = (() => { let a = 0, b = 0, d = 0; for (const p of PTS) { const x = p[0] - MX, y = p[1] - MY; a += x * x; b += x * y; d += y * y; } return [a / PTS.length, b / PTS.length, d / PTS.length]; })();
const [CA, CB, CD] = COV;
const PC1 = 0.5 * Math.atan2(2 * CB, CA - CD);
const pvar = (ang: number) => { const c = Math.cos(ang), s = Math.sin(ang); return c * c * CA + 2 * c * s * CB + s * s * CD; };
const MAXV = pvar(PC1), TOT = CA + CD;

const CX = 340, CY = 220, SC = 56;
const sx = (x: number) => CX + (x - MX) * SC, sy = (y: number) => CY + (y - MY) * SC;

type Phase = 'dims' | 'spread' | 'eigen' | 'rotate' | 'uses' | 'run';

export function PcaSection() {
  const [deg, setDeg] = useState(70);
  const ang = deg * Math.PI / 180;
  const v = useMemo(() => pvar(ang), [ang]);

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string, a: number): StoryScene =>
    ({ key, title, caption, render: () => <Pca phase={key} ang={a} /> });

  const scenes: StoryScene[] = [
    scene('dims', 'Too many dimensions', 'Real data often has many dimensions — pixels, sensor channels, gene expressions — but the meaningful variation usually lives along just a few directions. PCA finds those directions: the axes the data actually spreads along, so you can describe it with far fewer numbers.', PC1),
    scene('spread', 'Which direction spreads most?', 'Take a 2-D cloud and drop a line through it; project every point onto that line and measure the spread (variance) of the shadows. Rotate the line and the spread changes — some angles squash the points together, one angle spreads them out the most. That best direction is the first principal component.', 70 * Math.PI / 180),
    scene('eigen', 'It’s the top eigenvector', 'You don’t have to search angles by hand. That maximum-variance direction is exactly the top eigenvector of the data’s covariance matrix, and its eigenvalue is the variance along it. The second principal component is perpendicular to the first, capturing the leftover spread.', PC1),
    scene('rotate', 'Rotate, then drop the small axes', 'Rotate the data into the principal-component basis — now the axes are uncorrelated and sorted by how much variance each carries. Here the first axis holds most of it. Keep the top few components and discard the rest, and you’ve compressed the data while losing the least information possible.', PC1),
    scene('uses', 'Where it’s used', 'This one idea powers dimensionality reduction, plotting high-dimensional data in 2-D, denoising (the tiny-variance directions are often just noise), compression, and eigenfaces. PCA is the linear ancestor of the autoencoders and embeddings that compress data today.', PC1),
    { key: 'run', title: 'Find the best axis', caption: 'Rotate the candidate axis and watch the shadows of the points spread and squash, with the projected variance rising and falling. It peaks exactly at the first principal component (marked) — the direction of the data’s greatest spread, which here carries most of its variance. No other angle beats it.', render: () => <Pca phase="run" ang={ang} vNow={v} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>Real data often has many dimensions — pixels, sensor readings, features — but the meaningful variation usually lies along just a few directions. <strong>PCA</strong> finds those directions: the axes the data actually spreads along, ordered by how much. Project onto the top one or two and you keep most of the information in far fewer numbers. The first principal component is simply the <strong>direction of maximum variance</strong>, and it falls out as the top eigenvector of the data’s covariance matrix.</>,
        takeaway: <>Center the data, then form its <strong>covariance matrix</strong> — the symmetric matrix of how each pair of dimensions varies together. PCA diagonalizes it: its eigenvectors are the principal components (orthogonal directions) and each eigenvalue is the variance along its eigenvector. The top eigenvector is the direction of maximum projected variance — provably, no other direction spreads the points more (verified here against a brute-force search over all angles, and by power iteration converging to the same axis); the next is the perpendicular direction with the most remaining variance, and so on. Rotating the data into this eigenvector basis gives uncorrelated axes sorted by importance; keeping the top k and dropping the rest is the linear projection that loses the least information (it minimizes squared reconstruction error). That is why PCA is the workhorse for dimensionality reduction, 2-D visualization of high-dimensional data, denoising (small-eigenvalue directions are often noise), compression, and eigenfaces — and it’s the linear ancestor of the nonlinear embeddings (autoencoders, t-SNE, UMAP) that compress data today. The same eigen-decomposition also gives the normal modes of a vibrating structure and the axes of an inertia tensor.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <label className="pca-ctl">axis angle<input type="range" min={0} max={179} value={deg} onChange={(e) => setDeg(+e.target.value)} /><b>{deg}°</b> · variance <b>{(100 * v / MAXV).toFixed(0)}%</b> of max{Math.abs(((deg * Math.PI / 180) - PC1 + Math.PI) % Math.PI - 0) < 0.06 || Math.abs(v - MAXV) < 1e-3 ? ' ← PC1!' : ''}</label>
      )}
    />
  );
}

function Pca({ phase, ang, vNow }: { phase: Phase; ang: number; vNow?: number }) {
  const on = (p: Phase) => phase === p;
  const dir = { x: Math.cos(ang), y: Math.sin(ang) };
  const showAxis = !on('dims');
  const showPCs = on('eigen') || on('rotate') || on('run');
  const v = vNow ?? pvar(ang);
  // projection foot for each point onto the candidate axis (through centroid)
  const foot = (p: number[]) => { const t = (p[0] - MX) * dir.x + (p[1] - MY) * dir.y; return { x: MX + t * dir.x, y: MY + t * dir.y }; };
  const axEnd = (len: number, sign: number) => ({ x: MX + sign * len * dir.x, y: MY + sign * len * dir.y });
  const A = axEnd(3.6, 1), B = axEnd(3.6, -1);
  return (
    <svg viewBox="0 0 900 440" className="story-svg">
      <text x="60" y="30" className="pca-col">{PTS.length} 2-D points{showAxis ? ` · projected variance ${(100 * v / MAXV).toFixed(0)}% of max` : ' · find the axis of most spread'}</text>

      {/* candidate axis + projections */}
      {showAxis && !showPCs && <>
        <line x1={sx(A.x)} y1={sy(A.y)} x2={sx(B.x)} y2={sy(B.y)} className="pca-axis" />
        {PTS.map((p, i) => { const f = foot(p); return <g key={i}><line x1={sx(p[0])} y1={sy(p[1])} x2={sx(f.x)} y2={sy(f.y)} className="pca-drop" /><circle cx={sx(f.x)} cy={sy(f.y)} r="2.5" className="pca-shadow" /></g>; })}
      </>}

      {/* principal component axes */}
      {showPCs && <>
        {(() => { const p1 = { x: Math.cos(PC1), y: Math.sin(PC1) }, p2 = { x: -Math.sin(PC1), y: Math.cos(PC1) }; const L1 = 2 + 2.4 * Math.sqrt(pvar(PC1)), L2 = 2 + 2.4 * Math.sqrt(pvar(PC1 + Math.PI / 2)); return <>
          <line x1={sx(MX - p1.x * L1)} y1={sy(MY - p1.y * L1)} x2={sx(MX + p1.x * L1)} y2={sy(MY + p1.y * L1)} className="pca-pc1" markerEnd="url(#pcaarr)" />
          <line x1={sx(MX - p2.x * L2)} y1={sy(MY - p2.y * L2)} x2={sx(MX + p2.x * L2)} y2={sy(MY + p2.y * L2)} className="pca-pc2" markerEnd="url(#pcaarr2)" />
          <text x={sx(MX + p1.x * L1) + 6} y={sy(MY + p1.y * L1)} className="pca-pclbl">PC1 ({(100 * pvar(PC1) / TOT).toFixed(0)}%)</text>
          <text x={sx(MX + p2.x * L2) + 6} y={sy(MY + p2.y * L2)} className="pca-pclbl2">PC2 ({(100 * pvar(PC1 + Math.PI / 2) / TOT).toFixed(0)}%)</text>
        </>; })()}
        {/* candidate axis in run mode too, to compare */}
        {on('run') && <line x1={sx(A.x)} y1={sy(A.y)} x2={sx(B.x)} y2={sy(B.y)} className="pca-axis" />}
        {on('run') && PTS.map((p, i) => { const f = foot(p); return <circle key={i} cx={sx(f.x)} cy={sy(f.y)} r="2.5" className="pca-shadow" />; })}
      </>}

      {/* points */}
      {PTS.map((p, i) => <circle key={'p' + i} cx={sx(p[0])} cy={sy(p[1])} r="2.6" className="pca-pt" />)}

      {/* variance meter */}
      {showAxis && <><rect x="720" y="90" width="26" height="220" className="pca-meterbg" /><rect x="720" y={310 - (v / MAXV) * 220} width="26" height={(v / MAXV) * 220} className="pca-meter" /><text x="733" y="330" className="pca-mlbl" textAnchor="middle">variance</text></>}

      <defs>
        <marker id="pcaarr" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 z" fill="hsl(45 90% 62%)" /></marker>
        <marker id="pcaarr2" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 z" fill="hsl(190 60% 60%)" /></marker>
      </defs>

      <text x="450" y="424" className="pca-foot" textAnchor="middle">
        {on('dims') ? 'the data really varies along a few directions — find them'
          : on('spread') ? 'project onto a line; the spread of the shadows is the variance'
          : on('eigen') ? 'PC1 = top eigenvector of the covariance = max-variance direction'
          : on('rotate') ? 'PC1 carries most of the variance; PC2 the little that’s left'
          : on('uses') ? 'reduce dimensions by keeping the top components, dropping the rest'
          : `this axis: ${(100 * v / MAXV).toFixed(0)}% of the max variance — peaks at PC1`}
      </text>
    </svg>
  );
}
