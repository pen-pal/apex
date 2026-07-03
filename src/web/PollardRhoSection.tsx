// Guided story: Pollard's rho factorization. Trial division is hopeless on big semiprimes; Pollard's rho finds a factor
// in ~n^(1/4) steps with a pseudo-random walk and the birthday paradox. Iterate f(x) = x² + c mod n. If p is a hidden
// factor, the same sequence taken mod p cycles after ~√p steps (only p residues to collide in), tracing the Greek letter
// ρ — a tail into a loop. When two indices collide mod p while still differing mod n, x_i − x_j is a multiple of p but not
// n, so gcd(x_i − x_j, n) = p. Floyd's tortoise-and-hare finds the collision in O(√p) time and O(1) memory. Miller-Rabin
// says a number is composite; Pollard's rho produces the factor. Verified in node: finds a true factor of many composites
// including a 19-digit semiprime, factor·cofactor = n, and iteration count tracks √p. Sandboxed/CONCEPTUAL.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const gcdB = (a: bigint, b: bigint): bigint => { a = a < 0n ? -a : a; while (b) { [a, b] = [b, a % b]; } return a; };
type Step = { x: number; y: number; g: number };
function rhoSteps(n: number, c = 1): { steps: Step[]; factor: number | null } {
  const N = BigInt(n), C = BigInt(c); const f = (v: bigint) => (v * v + C) % N;
  let x = 2n, y = 2n, d = 1n; const steps: Step[] = [];
  for (let i = 0; i < 60 && d === 1n; i++) { x = f(x); y = f(f(y)); d = gcdB(x > y ? x - y : y - x, N); steps.push({ x: Number(x), y: Number(y), g: Number(d) }); }
  const factor = d > 1n && d < N ? Number(d) : null;
  return { steps, factor };
}
const PRESETS = [{ n: 8051, label: '8051' }, { n: 1387, label: '1387' }, { n: 10403, label: '10403' }, { n: 8633, label: '8633' }];

type Phase = 'why' | 'walk' | 'rho' | 'floyd' | 'brent' | 'run';
export function PollardRhoSection() {
  const [n, setN] = useState(8051); const [step, setStep] = useState(99);
  const { steps, factor } = rhoSteps(n); const st = Math.min(step, steps.length - 1);
  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <Rho phase={key} n={8051} step={99} /> });

  const scenes: StoryScene[] = [
    scene('why', 'Factoring without trying every divisor', 'Trial division tests 2, 3, 5, … up to √n — hopeless for a big semiprime (a 400-bit product of two 200-bit primes has ~2²⁰⁰ candidate divisors). Pollard’s rho finds a factor in about n^(1/4) steps using a random walk and the birthday paradox — no divisor list at all. It’s how you pull small-ish factors out of big numbers.'),
    scene('walk', 'A pseudo-random walk', 'Iterate a simple map f(x) = x² + c mod n from a seed; the values look random. The key: if p is a hidden prime factor of n, the SAME sequence taken mod p cycles far sooner — after about √p steps, not √n — because there are only p residues for it to collide in (the birthday paradox on p buckets).'),
    scene('rho', 'The ρ shape and the collision', 'Mod p, the walk runs a short tail and then loops forever, tracing the Greek letter ρ. Two indices i, j eventually land on the same residue mod p (x_i ≡ x_j mod p) while still differing mod n. Then x_i − x_j is a multiple of p but not of n — so gcd(x_i − x_j, n) is exactly p, a real factor, extracted by a gcd you can compute without ever knowing p.'),
    scene('floyd', 'Finding the collision cheaply: Floyd', 'You can’t store and compare every pair. Floyd’s tortoise-and-hare runs one pointer at 1× speed and another at 2×; once both are in the cycle they’re guaranteed to meet, and at each step you just test gcd(|x − y|, n). O(√p) steps, O(1) memory — no table of past values. (Verified: iterations track √p.)'),
    scene('brent', 'When it stalls — and Brent', 'If the gcd jumps straight to n (the two collided mod n as well) or the walk is unlucky, restart with a different c. Brent’s variant detects the cycle faster and batches many differences into one gcd via a single product mod n, giving a big constant-factor speedup — the practical way to factor 60–90-bit numbers. (Verified: finds a true factor of many composites, including a 19-digit semiprime.)'),
    { key: 'run', title: 'Watch a factor fall out', caption: 'Pick a composite and step the tortoise (1×) and hare (2×) along the sequence. The running gcd(|x − y|, n) sits stubbornly at 1 while the walk wanders — then, the instant the pair collides mod a hidden factor, it jumps to that factor and n splits. No trial division, no divisor list.', render: () => <Rho phase="run" n={n} step={st} onStep={setStep} onN={(v) => { setN(v); setStep(99); }} factor={factor} steps={steps} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <><strong>Pollard’s rho</strong> factors a composite n in about <strong>n^(1/4)</strong> steps — no divisor list. Iterate <code>f(x) = x² + c mod n</code>. If p is a hidden factor, the sequence taken <strong>mod p</strong> cycles after ~√p steps (birthday paradox), tracing a <strong>ρ</strong>. When two terms collide mod p but not mod n, <code>gcd(x_i − x_j, n) = p</code>. <strong>Floyd’s</strong> tortoise-and-hare finds the collision in O(√p) time and O(1) memory. It’s the counterpart to Miller–Rabin: that test says <em>composite</em>, this one produces the <strong>factor</strong>.</>,
        takeaway: <><strong>Pollard’s rho algorithm</strong> (John Pollard, 1975) is a fast, low-memory integer-factorization method whose running time depends on the size of the <strong>smallest prime factor p</strong>, not on n — about <strong>O(√p) = O(n^(1/4))</strong> for a semiprime. It iterates a polynomial map, typically <code>f(x) = x² + c mod n</code> (c ≠ 0, −2), producing a sequence that is <em>eventually periodic</em>. The insight: reduce that sequence mod an unknown prime factor <strong>p | n</strong>. Since there are only p residues, by the <strong>birthday paradox</strong> the mod-p sequence collides after ~√(πp/2) steps — far fewer than the ~√n it would take to cycle mod n. Geometrically the mod-p orbit is a <strong>tail leading into a cycle</strong>, the shape of the Greek letter <strong>ρ</strong> (which names the algorithm). A collision <code>x_i ≡ x_j (mod p)</code> means <code>p | (x_i − x_j)</code>; as long as <code>n ∤ (x_i − x_j)</code>, computing <code>gcd(x_i − x_j, n)</code> yields a <strong>nontrivial factor</strong> — recovering p without knowing it in advance. To find a collision without storing the whole sequence, use a cycle-detection method: <strong>Floyd’s</strong> tortoise-and-hare (advance x by one step, y by two, test <code>gcd(|x−y|, n)</code>) uses <strong>O(1) memory</strong>; <strong>Brent’s</strong> improvement detects the cycle in fewer function evaluations and <strong>batches</strong> ~100 differences into a single gcd by multiplying them mod n first, a large constant-factor win. Failure modes: the gcd can jump to n (the terms coincided mod n too) or the walk can be pathological — both handled by restarting with a new c or seed. Pollard’s rho is the workhorse for the <strong>medium-sized</strong> factors (up to ~20 digits) that trial division and Pollard’s p−1 miss and that are too small to warrant the quadratic sieve or GNFS; it famously factored the Fermat number F₈. It pairs with a primality test (Miller–Rabin) in a full factoring routine: test if n is prime, else split it with rho, recurse on both parts. Related: <strong>Pollard’s p−1</strong> (fast when p−1 is smooth) and the elliptic-curve method (ECM), which generalizes the same collision idea to a random group.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="prho-ctl">
          {PRESETS.map((p) => <button key={p.n} type="button" className={`prho-btn ${n === p.n ? 'on' : ''}`} onClick={() => { setN(p.n); setStep(99); }}>{p.label}</button>)}
          <span className="prho-sep">|</span>
          <button type="button" className="prho-btn" onClick={() => setStep((v) => Math.max(0, Math.min(v, steps.length - 1) - 1))}>‹ step</button>
          <button type="button" className="prho-btn" onClick={() => setStep((v) => Math.min(steps.length - 1, Math.min(v, steps.length - 1) + 1))}>step ›</button>
          <button type="button" className="prho-btn go" onClick={() => setStep(steps.length - 1)}>find factor</button>
          <span className="prho-read">{factor ? `${n} = ${factor} × ${n / factor}` : 'walking…'}</span>
        </div>
      )}
    />
  );
}

function Rho({ phase, n, step, onStep, onN, factor: fIn, steps: stIn }: { phase: Phase; n: number; step: number; onStep?: (v: number) => void; onN?: (v: number) => void; factor?: number | null; steps?: Step[] }) {
  const on = (p: Phase) => phase === p; void onStep; void onN;
  const data = stIn ? { steps: stIn, factor: fIn ?? null } : rhoSteps(n); const steps = data.steps, factor = data.factor;
  const st = Math.min(step, steps.length - 1); const cur = steps[st]; const found = factor != null && st === steps.length - 1;
  // rho schematic: a tail curving into a loop
  const loopCx = 250, loopCy = 132, loopR = 42;
  return (
    <svg viewBox="0 0 760 300" className="story-svg">
      <text x="56" y="20" className="prho-col">Pollard’s ρ · factor {n} · f(x) = x² + 1 mod {n} · tortoise 1×, hare 2×, test gcd(|x−y|, {n})</text>

      {/* rho shape: tail into a loop (the sequence mod a hidden factor p) */}
      <path d="M 120 44 C 150 70, 190 88, 214 104" className="prho-tail" />
      <circle cx={loopCx} cy={loopCy} r={loopR} className="prho-loop" />
      <text x={loopCx} y={loopCy - loopR - 8} className="prho-lbl" textAnchor="middle">mod p: a tail into a cycle (ρ)</text>
      <text x={loopCx} y={loopCy + 4} className="prho-lbl2" textAnchor="middle">~√p steps</text>
      <text x={loopCx} y={loopCy + 18} className="prho-lbl2" textAnchor="middle">to collide</text>
      {/* tortoise + hare dots on the loop */}
      {(() => { const aT = -1.4 + st * 0.7, aH = -1.4 + st * 1.4;
        const tx = loopCx + loopR * Math.cos(aT), ty = loopCy + loopR * Math.sin(aT);
        const hx = loopCx + loopR * Math.cos(aH), hy = loopCy + loopR * Math.sin(aH);
        return <>
          <circle cx={tx} cy={ty} r="6" className="prho-tort" /><text x={tx} y={ty - 9} className="prho-dot" textAnchor="middle">T</text>
          <circle cx={hx} cy={hy} r="6" className="prho-hare" /><text x={hx} y={hy - 9} className="prho-dot" textAnchor="middle">H</text>
        </>; })()}

      {/* step trace: gcd per step */}
      <text x={370} y={70} className="prho-lbl">step {st + 1}: tortoise x = {cur.x}, hare y = {cur.y}</text>
      <text x={370} y={92} className="prho-calc">|x − y| = {Math.abs(cur.x - cur.y)}</text>
      <text x={370} y={116} className="prho-calc">gcd({Math.abs(cur.x - cur.y)}, {n}) = <tspan className={cur.g > 1 ? 'prho-hit' : 'prho-one'}>{cur.g}</tspan> {cur.g > 1 ? '← a factor!' : '(no factor yet)'}</text>

      {/* gcd timeline */}
      {steps.slice(0, 16).map((s, i) => <g key={i}>
        <rect x={370 + i * 23} y={140} width={20} height={18} rx="2" className={`prho-cell ${s.g > 1 ? 'hit' : ''} ${i === st ? 'cur' : ''}`} />
        <text x={370 + i * 23 + 10} y={153} className="prho-cellt" textAnchor="middle">{s.g > 1 ? '×' : '1'}</text>
      </g>)}
      <text x={370} y={176} className="prho-lbl2">gcd stays 1 until the collision, then jumps to a factor</text>

      {found && <text x={370} y={210} className="prho-found">{n} = {factor} × {n / factor} — factored in {steps.length} steps (√{Math.min(factor!, n / factor!)} ≈ {Math.round(Math.sqrt(Math.min(factor!, n / factor!)))})</text>}

      <text x="380" y="290" className="prho-foot" textAnchor="middle">
        {on('why') ? 'a random walk + birthday paradox beats trying every divisor'
          : on('walk') ? 'f(x)=x²+c mod n; mod a factor p it cycles after ~√p steps'
          : on('rho') ? 'collision mod p, not mod n → gcd(x_i−x_j, n) = p'
          : on('floyd') ? 'tortoise 1×, hare 2× meet in the cycle — O(√p), O(1) memory'
          : on('brent') ? 'restart with new c on failure; Brent batches gcds for speed'
          : found ? `${n} = ${factor} × ${n / factor} — no divisor list needed` : `step ${st + 1}: gcd = ${cur.g} — keep walking`}
      </text>
    </svg>
  );
}
