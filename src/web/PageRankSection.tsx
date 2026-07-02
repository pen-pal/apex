// Guided story: PageRank — how Google first ranked the web. Importance is recursive: a page is important if important
// pages link to it. Model a random surfer clicking links forever; PageRank is the fraction of time spent on each page
// (the stationary distribution). Solve by power iteration: start equal, flow each page's rank along its out-links,
// re-total, repeat until it settles (the dominant eigenvector of the link matrix). Damping (teleport with prob 0.15)
// drains dead-ends and guarantees a unique answer. Verified in node: converges, sums to 1, same result from any start.
import { useEffect, useRef, useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const LINKS = [[1, 2], [2], [0], [0, 2], [2]]; // page → out-links
const N = LINKS.length, D = 0.85;
const POS = [[300, 150], [520, 130], [430, 280], [180, 300], [630, 330]] as [number, number][];
function step(r: number[]): number[] {
  const nr = new Array(N).fill((1 - D) / N);
  for (let j = 0; j < N; j++) { const outs = LINKS[j]; if (outs.length === 0) { for (let i = 0; i < N; i++) nr[i] += D * r[j] / N; } else for (const i of outs) nr[i] += D * r[j] / outs.length; }
  return nr;
}

type Phase = 'rank' | 'recursive' | 'surfer' | 'iterate' | 'damping' | 'run';

export function PageRankSection() {
  const rRef = useRef<number[]>(new Array(N).fill(1 / N)); const itRef = useRef(0); const dRef = useRef(1);
  const [, tick] = useState(0); const frame = useRef(0);
  const reset = () => { rRef.current = new Array(N).fill(1 / N); itRef.current = 0; dRef.current = 1; };
  useEffect(() => {
    let raf = 0; const loop = () => {
      frame.current++;
      if (frame.current % 14 === 0 && dRef.current > 1e-5) { const nr = step(rRef.current); dRef.current = nr.reduce((s, v, i) => s + Math.abs(v - rRef.current[i]), 0); rRef.current = nr; itRef.current++; }
      if (dRef.current <= 1e-5 && frame.current % 200 === 0) reset(); // pause then restart the convergence
      tick((t) => (t + 1) % 100000); raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, []);

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <PR phase={key} r={rRef.current} it={itRef.current} delta={dRef.current} /> });

  const scenes: StoryScene[] = [
    scene('rank', 'Ranking the whole web', 'To order web pages by importance, counting inbound links is the obvious idea — and trivially gamed: spawn a thousand throwaway pages that all link to yours. PageRank’s fix is that a link should carry the importance of the page it comes from. A link from a nobody counts for little; a link from a hub counts a lot.'),
    scene('recursive', 'Importance is recursive', 'But that’s circular: a page’s importance depends on the importance of the pages linking to it — which depends on the pages linking to THEM. PageRank embraces the circle: a page’s rank is the sum of a share of every linking page’s rank. The definition refers to itself, and iteration untangles it.'),
    scene('surfer', 'The random surfer', 'Picture someone clicking links at random, forever. A page’s PageRank is simply the fraction of time this surfer spends on it. Each page hands its rank out in equal shares along its links, so a page linked from many high-rank pages catches the most flow — the bigger, brighter nodes here.'),
    scene('iterate', 'Iterate until it settles', 'Start every page at an equal rank, then repeatedly push each page’s rank along its links and re-total. The numbers slosh around at first, then settle — after a dozen rounds they stop changing. That fixed point is the ranking. (It’s the dominant eigenvector of the link matrix, found by this power iteration.)'),
    scene('damping', 'Damping keeps it honest', 'A real web has dead-ends and little loops that would hoard all the rank. So 15% of the time the surfer teleports to a random page instead of following a link. That damping drains the traps, keeps rank flowing everywhere, and guarantees the iteration converges to one unique answer that sums to 1.'),
    { key: 'run', title: 'Watch the rank flow', caption: 'The iteration runs live: every page starts equal, then rank flows along the links and the nodes grow or shrink to their true importance, settling after a dozen rounds. Pages linked from important pages win — even a page with few links can outrank one with many, if those few come from the right places.', render: () => <PR phase="run" r={rRef.current} it={itRef.current} delta={dRef.current} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>To rank web pages by importance, counting inbound links is the obvious idea — and easily gamed, since anyone can spawn a thousand pages linking to their own. PageRank’s insight is that a link should carry the importance of the page it comes from: <strong>a page is important if important pages link to it</strong>. That’s circular — importance defined in terms of importance — and PageRank resolves the circle by iteration.</>,
        takeaway: <>Model a random surfer who clicks links forever; a page’s PageRank is the long-run fraction of time spent on it — the <strong>stationary distribution</strong> of that random walk. Each page passes its rank in equal shares along its outbound links, so a page’s rank is the sum of the shares flowing in: <code>rank(p) = Σ<sub>q→p</sub> rank(q) / outdegree(q)</code>. You solve this by <strong>power iteration</strong>: start every page equal, flow the ranks along the links, re-total, and repeat; the vector shifts and then settles to a fixed point — mathematically the dominant eigenvector of the link matrix. Two fixes make it well-behaved: with damping factor d ≈ 0.85 the surfer follows a link, and with 1−d they <strong>teleport</strong> to a random page, which drains dead-ends and disconnected traps that would otherwise hoard all the rank, and guarantees convergence to a unique distribution summing to 1 (verified here: it converges, sums to 1, and any starting vector reaches the same answer). This recursive, iteration-resolved notion of importance is what launched Google, and the same power-iteration-on-a-graph idea now ranks nodes in social networks, citation graphs, and recommendation systems.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="pr-ctl">
          <button type="button" className="pr-btn" onClick={reset}>↻ restart iteration</button>
          <span className="pr-live">iteration {itRef.current} · Δ {dRef.current.toExponential(1)}{dRef.current <= 1e-5 ? ' · converged ✓' : ''}</span>
        </div>
      )}
    />
  );
}

function PR({ phase, r, it, delta }: { phase: Phase; r: number[]; it: number; delta: number }) {
  const on = (p: Phase) => phase === p;
  const rad = (rank: number) => 15 + rank * 115;
  const order = r.map((v, i) => [i, v] as [number, number]).sort((a, b) => b[1] - a[1]);
  const rankPos = new Map(order.map(([i], k) => [i, k]));
  return (
    <svg viewBox="0 0 900 440" className="story-svg">
      <text x="60" y="30" className="pr-col">{N} pages, directed links · iteration {it} · Δ {delta.toExponential(1)}{delta <= 1e-5 ? ' · converged' : ''}</text>

      {/* links (arrows) */}
      <defs><marker id="prarrow" markerWidth="9" markerHeight="9" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6 z" fill="hsl(210 30% 55%)" /></marker></defs>
      {LINKS.map((outs, j) => outs.map((i) => {
        const [x1, y1] = POS[j], [x2, y2] = POS[i]; const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy);
        const r1 = rad(r[j]), r2 = rad(r[i]);
        return <line key={`${j}-${i}`} x1={x1 + dx / L * r1} y1={y1 + dy / L * r1} x2={x2 - dx / L * (r2 + 8)} y2={y2 - dy / L * (r2 + 8)} className="pr-edge" markerEnd="url(#prarrow)" />;
      }))}

      {/* nodes */}
      {POS.map(([x, y], i) => {
        const top = rankPos.get(i) === 0;
        return <g key={i}>
          <circle cx={x} cy={y} r={rad(r[i])} className={`pr-node ${top ? 'top' : ''}`} style={{ opacity: 0.5 + r[i] * 1.3 }} />
          <text x={x} y={y - 2} className="pr-name" textAnchor="middle">P{i}</text>
          <text x={x} y={y + 14} className="pr-rank" textAnchor="middle">{(r[i] * 100).toFixed(0)}%</text>
        </g>;
      })}

      <text x="450" y="424" className="pr-foot" textAnchor="middle">
        {on('rank') ? 'a link from an important page should count more than one from a nobody'
          : on('recursive') ? 'rank(p) = Σ of a share of each linking page’s rank — circular, solved by iteration'
          : on('surfer') ? 'PageRank = fraction of time a random-link-clicking surfer spends here'
          : on('iterate') ? 'flow rank along links, re-total, repeat → it converges to the ranking'
          : on('damping') ? '15% teleport drains dead-ends and forces a unique, summing-to-1 answer'
          : delta <= 1e-5 ? `converged: P${order[0][0]} ranks highest (${(order[0][1] * 100).toFixed(0)}%)` : `iterating… ranks still flowing (Δ ${delta.toExponential(1)})`}
      </text>
    </svg>
  );
}
