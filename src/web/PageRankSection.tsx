// Guided story: PageRank — how Google first ranked the web. Importance is recursive: a page is important if important
// pages link to it. Model a random surfer clicking links forever; PageRank is the fraction of time spent on each page
// (the stationary distribution), found by power iteration (the dominant eigenvector of the link matrix). DEEPENED so
// you PRODUCE the failure damping exists to fix: toggle a "spider trap" (a page linking only to itself) and drag the
// damping. With no teleport (d=1) the surfer falls into the trap and never leaves — that one page hoards 100% of the
// rank and the whole web ranks 0. Add teleport (lower d) and the rank drains out and flows again. Node-verified:
// TRAP d=1.00 → P2=100%/others 0; d=0.85 → 85/4/5/3/3; WEB d=0.85 → 37/19/38/3/3, sums to 1.
import { useEffect, useRef, useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const WEB = [[1, 2], [2], [0], [0, 2], [2]];          // a normal, well-connected mini-web
const TRAP = [[1, 2], [2], [2], [0, 2], [2]];          // P2 links only to itself → a spider trap
const N = WEB.length;
const POS = [[300, 150], [520, 130], [430, 280], [180, 300], [630, 330]] as [number, number][];
function step(r: number[], links: number[][], D: number): number[] {
  const nr = new Array(N).fill((1 - D) / N);
  for (let j = 0; j < N; j++) { const outs = links[j]; if (outs.length === 0) { for (let i = 0; i < N; i++) nr[i] += D * r[j] / N; } else for (const i of outs) nr[i] += D * r[j] / outs.length; }
  return nr;
}

type Phase = 'rank' | 'recursive' | 'surfer' | 'iterate' | 'damping' | 'run';

export function PageRankSection() {
  const [mode, setMode] = useState<'web' | 'trap'>('web');
  const [d, setD] = useState(0.85);
  const cfg = useRef({ links: WEB, D: 0.85 });
  const rRef = useRef<number[]>(new Array(N).fill(1 / N)); const itRef = useRef(0); const dRef = useRef(1);
  const [, tick] = useState(0); const frame = useRef(0);
  const resetIter = () => { rRef.current = new Array(N).fill(1 / N); itRef.current = 0; dRef.current = 1; };
  useEffect(() => { cfg.current = { links: mode === 'trap' ? TRAP : WEB, D: d }; resetIter(); tick((t) => t + 1); }, [mode, d]);

  useEffect(() => {
    let raf = 0; const loop = () => {
      frame.current++;
      if (frame.current % 14 === 0 && dRef.current > 1e-5) { const nr = step(rRef.current, cfg.current.links, cfg.current.D); dRef.current = nr.reduce((s, v, i) => s + Math.abs(v - rRef.current[i]), 0); rRef.current = nr; itRef.current++; }
      if (dRef.current <= 1e-5 && frame.current % 220 === 0) resetIter(); // re-run the convergence so the flow keeps animating
      tick((t) => (t + 1) % 100000); raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, []);

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <PR phase={key} r={rRef.current} it={itRef.current} delta={dRef.current} links={cfg.current.links} mode={mode} d={d} /> });

  const scenes: StoryScene[] = [
    scene('rank', 'Ranking the whole web', 'To order web pages by importance, counting inbound links is the obvious idea — and trivially gamed: spawn a thousand throwaway pages that all link to yours. PageRank’s fix is that a link should carry the importance of the page it comes from. A link from a nobody counts for little; a link from a hub counts a lot.'),
    scene('recursive', 'Importance is recursive', 'But that’s circular: a page’s importance depends on the importance of the pages linking to it — which depends on the pages linking to THEM. PageRank embraces the circle: a page’s rank is the sum of a share of every linking page’s rank. The definition refers to itself, and iteration untangles it.'),
    scene('surfer', 'The random surfer', 'Picture someone clicking links at random, forever. A page’s PageRank is simply the fraction of time this surfer spends on it. Each page hands its rank out in equal shares along its links, so a page linked from many high-rank pages catches the most flow — the bigger, brighter nodes here.'),
    scene('iterate', 'Iterate until it settles', 'Start every page at an equal rank, then repeatedly push each page’s rank along its links and re-total. The numbers slosh around at first, then settle — after a dozen rounds they stop changing. That fixed point is the ranking. (It’s the dominant eigenvector of the link matrix, found by this power iteration.)'),
    scene('damping', 'Damping keeps it honest', 'A real web has dead-ends and little loops that would hoard all the rank. So 15% of the time the surfer teleports to a random page instead of following a link. That damping drains the traps, keeps rank flowing everywhere, and guarantees the iteration converges to one unique answer that sums to 1.'),
    { key: 'run', title: 'Build a trap — then drain it', caption: 'The iteration runs live. Now break it: switch on the spider trap and P2 links only to itself. Drag damping to 1.0 (no teleport) and watch the random surfer fall in and never leave — P2 balloons to 100% of the rank while the rest of the web collapses to 0. That’s the dead-end problem that would have made PageRank useless. Now drag damping back down: teleport lets the surfer escape, the trap drains, and every page gets a fair share again. That single knob is why PageRank works on the real web.', render: () => <PR phase="run" r={rRef.current} it={itRef.current} delta={dRef.current} links={cfg.current.links} mode={mode} d={d} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>To rank web pages by importance, counting inbound links is the obvious idea — and easily gamed, since anyone can spawn a thousand pages linking to their own. PageRank’s insight is that a link should carry the importance of the page it comes from: <strong>a page is important if important pages link to it</strong>. That’s circular — importance defined in terms of importance — and PageRank resolves the circle by iteration. The catch that nearly sinks it, which you can trigger here, is a dead-end or loop that hoards all the rank.</>,
        takeaway: <>Model a random surfer who clicks links forever; a page’s PageRank is the long-run fraction of time spent on it — the <strong>stationary distribution</strong> of that random walk. Each page passes its rank in equal shares along its outbound links, so a page’s rank is the sum of the shares flowing in: <code>rank(p) = Σ<sub>q→p</sub> rank(q) / outdegree(q)</code>. You solve this by <strong>power iteration</strong>: start every page equal, flow the ranks along the links, re-total, and repeat; the vector shifts and then settles to a fixed point — mathematically the dominant eigenvector of the link matrix. But a <strong>spider trap</strong> (a page or clump that links only inward, like a page linking to itself) is fatal: the surfer falls in and never leaves, so it absorbs all the rank and the rest of the web ranks zero — you can produce exactly this by turning on the trap and setting damping to 1. The fix is <strong>damping</strong>: with probability d ≈ 0.85 the surfer follows a link, and with 1−d they <strong>teleport</strong> to a random page, which drains traps and dead-ends, keeps rank flowing everywhere, and guarantees convergence to a unique distribution summing to 1. This recursive, iteration-resolved notion of importance is what launched Google, and the same power-iteration-on-a-graph idea now ranks nodes in social networks, citation graphs, and recommendation systems.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="pr-ctl">
          <div className="pr-ctl-row">
            <button type="button" className={`pr-btn ${mode === 'web' ? 'on' : ''}`} onClick={() => setMode('web')}>normal web</button>
            <button type="button" className={`pr-btn ${mode === 'trap' ? 'on' : ''}`} onClick={() => setMode('trap')}>🕸️ spider trap</button>
            <label className="pr-damp">damping d <input type="range" min={50} max={100} value={Math.round(d * 100)} onChange={(e) => setD(+e.target.value / 100)} /><b>{d.toFixed(2)}</b></label>
          </div>
          <span className={`pr-live ${mode === 'trap' && d > 0.97 ? 'warn' : ''}`}>
            teleport {Math.round((1 - d) * 100)}% · iteration {itRef.current}{dRef.current <= 1e-5 ? ' · converged' : ''}
            {mode === 'trap' ? (d > 0.97 ? ' — the trap hoards ~100%; the web ranks 0 (no way out)' : ' — teleport is draining the trap; rank flows again') : ''}
          </span>
        </div>
      )}
    />
  );
}

function PR({ phase, r, it, delta, links, mode, d }: { phase: Phase; r: number[]; it: number; delta: number; links: number[][]; mode: 'web' | 'trap'; d: number }) {
  const on = (p: Phase) => phase === p;
  const rad = (rank: number) => 15 + rank * 115;
  const order = r.map((v, i) => [i, v] as [number, number]).sort((a, b) => b[1] - a[1]);
  const rankPos = new Map(order.map(([i], k) => [i, k]));
  return (
    <svg viewBox="0 0 900 440" className="story-svg">
      <text x="60" y="30" className="pr-col">{N} pages · {mode === 'trap' ? 'P2 is a spider trap' : 'directed links'} · teleport {Math.round((1 - d) * 100)}% · iter {it}{delta <= 1e-5 ? ' · converged' : ''}</text>

      <defs><marker id="prarrow" markerWidth="9" markerHeight="9" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6 z" fill="hsl(210 30% 55%)" /></marker></defs>
      {links.map((outs, j) => outs.map((i) => {
        if (i === j) { // self-loop (spider trap): a small loop above the node
          const [x, y] = POS[j]; const R = rad(r[j]);
          return <path key={`${j}-self`} d={`M ${x - 7} ${y - R} C ${x - 42} ${y - R - 48}, ${x + 42} ${y - R - 48}, ${x + 7} ${y - R}`} className="pr-edge trap" markerEnd="url(#prarrow)" fill="none" />;
        }
        const [x1, y1] = POS[j], [x2, y2] = POS[i]; const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy);
        const r1 = rad(r[j]), r2 = rad(r[i]);
        return <line key={`${j}-${i}`} x1={x1 + dx / L * r1} y1={y1 + dy / L * r1} x2={x2 - dx / L * (r2 + 8)} y2={y2 - dy / L * (r2 + 8)} className="pr-edge" markerEnd="url(#prarrow)" />;
      }))}

      {POS.map(([x, y], i) => {
        const top = rankPos.get(i) === 0; const isTrap = mode === 'trap' && i === 2;
        return <g key={i}>
          <circle cx={x} cy={y} r={rad(r[i])} className={`pr-node ${top ? 'top' : ''} ${isTrap ? 'trap' : ''}`} style={{ opacity: 0.5 + r[i] * 1.3 }} />
          <text x={x} y={y - 2} className="pr-name" textAnchor="middle">P{i}</text>
          <text x={x} y={y + 14} className="pr-rank" textAnchor="middle">{(r[i] * 100).toFixed(0)}%</text>
        </g>;
      })}

      <text x="450" y="424" className={`pr-foot ${mode === 'trap' && d > 0.97 ? 'warn' : ''}`} textAnchor="middle">
        {on('rank') ? 'a link from an important page should count more than one from a nobody'
          : on('recursive') ? 'rank(p) = Σ of a share of each linking page’s rank — circular, solved by iteration'
          : on('surfer') ? 'PageRank = fraction of time a random-link-clicking surfer spends here'
          : on('iterate') ? 'flow rank along links, re-total, repeat → it converges to the ranking'
          : on('damping') ? '15% teleport drains dead-ends and forces a unique, summing-to-1 answer'
          : mode === 'trap' && d > 0.97 ? 'no teleport: the surfer falls into P2’s self-loop and never escapes → it takes all the rank'
          : mode === 'trap' ? 'teleport lets the surfer escape the trap → rank redistributes across the web'
          : delta <= 1e-5 ? `converged: P${order[0][0]} ranks highest (${(order[0][1] * 100).toFixed(0)}%)` : `iterating… ranks still flowing (Δ ${delta.toExponential(1)})`}
      </text>
    </svg>
  );
}
