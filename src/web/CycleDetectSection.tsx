// Floyd's cycle detection, made visible. A ρ-shaped graph: a tail that runs into a loop. Two pointers walk it —
// the tortoise one node per step, the hare two. Step through and watch the hare lap the tortoise until they
// land on the same node inside the loop (they can only meet in the loop). Then the second phase resets one
// pointer to the start and advances both by one; they meet exactly at the loop's entrance. Real model from
// floydcycle.ts.
import { useMemo, useState } from 'react';
import { floyd } from './floydcycle';

const NEXT = [1, 2, 3, 4, 5, 6, 7, 3]; // tail 0,1,2 → cycle 3,4,5,6,7
const START = 0;

export function CycleDetectSection() {
  const info = useMemo(() => floyd(NEXT, START), []);
  // phases: chase (tortoise+1/hare+2 until meet), find (start ptr + meet ptr +1 until entrance), done
  const [slow, setSlow] = useState(START);
  const [fast, setFast] = useState(START);
  const [p1, setP1] = useState(START);
  const [phase, setPhase] = useState<'chase' | 'find' | 'done'>('chase');
  const [steps, setSteps] = useState(0);

  const pos = useMemo(() => {
    const p: Record<number, { x: number; y: number }> = {};
    const cs = info.cycleStart;
    for (let i = 0; i < cs; i++) p[i] = { x: 30 + i * 52, y: 100 };       // tail
    const cyc = NEXT.length - cs, cx = 60 + cs * 52 + 66, cy = 100, r = 62;
    for (let k = 0; k < cyc; k++) { const ang = Math.PI - (k * 2 * Math.PI) / cyc; p[cs + k] = { x: cx + r * Math.cos(ang), y: cy - r * Math.sin(ang) }; }
    return p;
  }, [info]);

  const step = () => {
    if (phase === 'chase') {
      const ns = NEXT[slow], nf = NEXT[NEXT[fast]];
      setSlow(ns); setFast(nf); setSteps((s) => s + 1);
      if (ns === nf) { setP1(START); setPhase('find'); } // met inside the loop
    } else if (phase === 'find') {
      if (p1 === slow) { setPhase('done'); return; }
      const np1 = NEXT[p1], ns = NEXT[slow];
      if (np1 === ns) { setP1(np1); setSlow(ns); setPhase('done'); } else { setP1(np1); setSlow(ns); }
    }
  };
  const reset = () => { setSlow(START); setFast(START); setP1(START); setPhase('chase'); setSteps(0); };

  return (
    <div className="th">
      <p className="th-intro">
        Follow the chain: node 0 points to 1, 1 to 2, and so on — but node 7 points back to 3, so it loops. The
        <strong> tortoise 🐢</strong> steps one node at a time, the <strong>hare 🐇</strong> two. If there's a
        loop, the hare catches the tortoise <em>inside</em> it. Step through:
      </p>

      <div className="th-canvas">
        <svg viewBox="0 0 560 200" className="th-svg">
          {NEXT.map((to, from) => {
            const a = pos[from], b = pos[to]; if (!a || !b) return null;
            return <line key={from} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="th-edge" markerEnd="url(#tharrow)" />;
          })}
          <defs><marker id="tharrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 z" fill="var(--muted)" /></marker></defs>
          {Object.entries(pos).map(([id, p]) => {
            const n = +id;
            const isStart = phase === 'done' && n === info.cycleStart;
            return (
              <g key={id}>
                <circle cx={p.x} cy={p.y} r={15} className={`th-node ${isStart ? 'entrance' : ''} ${n >= info.cycleStart ? 'incyc' : 'tail'}`} />
                <text x={p.x} y={p.y + 4} className="th-nlabel">{n}</text>
                {slow === n && <circle cx={p.x} cy={p.y} r={20} className="th-slow" />}
                {phase === 'chase' && fast === n && <circle cx={p.x} cy={p.y} r={24} className="th-fast" />}
                {phase === 'find' && p1 === n && <circle cx={p.x} cy={p.y} r={24} className="th-fast" />}
              </g>
            );
          })}
        </svg>
        <div className="th-markers"><span><i className="th-mk slow" />🐢 tortoise</span><span><i className="th-mk fast" />{phase === 'find' ? '🔎 from start' : '🐇 hare'}</span><span><i className="th-mk ent" /> cycle entrance</span></div>
      </div>

      <div className="th-controls">
        <button type="button" className="th-btn" disabled={phase === 'done'} onClick={step}>step →</button>
        <button type="button" className="th-btn ghost" onClick={reset}>reset</button>
        <span className="th-phase">
          {phase === 'chase' ? `phase 1: chasing (step ${steps}) — 🐢@${slow}, 🐇@${fast}`
            : phase === 'find' ? `phase 2: finding the entrance — 🐢@${slow}, 🔎@${p1}`
              : `✓ done — loop entrance is node ${info.cycleStart}`}
        </span>
      </div>

      <div className="th-stats">
        <div className="th-stat"><span>cycle start (μ)</span><b>{phase === 'done' ? info.cycleStart : '?'}</b></div>
        <div className="th-stat"><span>cycle length (λ)</span><b>{info.cycleLength}</b></div>
        <div className="th-stat"><span>tail length</span><b>{info.tailLength}</b></div>
        <div className="th-stat"><span>memory used</span><b>O(1)</b></div>
      </div>

      <p className="th-foot">
        Why phase 2 works is the pretty part. Say the tail (start → entrance) has length μ and the loop has length
        λ. When the pointers meet, the tortoise has taken some number of steps k that is a multiple of λ (the hare,
        at double speed, has gone exactly one loop-length further). The meeting point is exactly μ
        steps <em>before</em> the entrance going around the loop — so a fresh pointer from the start and the
        tortoise from the meeting point, both stepping by one, cover μ steps and arrive at the entrance together.
        The whole thing uses <strong>two integers</strong> of memory regardless of how long the chain is — versus
        a hash set of every visited node. That O(1)-space property is why it shows up far from linked lists:
        <strong> Pollard's rho</strong> factors a big number by finding a cycle in x → x²+c mod n, and the same
        idea finds hash collisions. Brent's variant meets faster by letting the hare run in growing bursts.
        (Knuth attributes the two-pointer method to Floyd.)
      </p>
    </div>
  );
}
