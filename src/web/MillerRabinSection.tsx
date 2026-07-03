// Guided story: Miller–Rabin primality test — how crypto libraries decide a 2048-bit number is prime without factoring.
// Fermat says a^(n-1) ≡ 1 (mod n) for prime n; MR sharpens it by writing n-1 = d·2^r and using that mod a prime the only
// square roots of 1 are ±1. Test a base a: compute a^d mod n, then square up to r-1 times; a prime must start at 1 or hit
// n-1 before reaching a^(n-1). If the sequence reaches 1 through a "rogue" root (not −1), n is definitely composite and a
// is a witness. For any composite ≥3/4 of bases are witnesses, so k rounds miss with probability ≤ 4^-k; a fixed base set
// is deterministic below proven bounds. Catches Carmichael numbers that fool Fermat. Verified in node: matches trial
// division for n<5000, ≥3/4 of bases witness every composite, and exposes 561/1105/1729/2465. Sandboxed/CONCEPTUAL.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const mp = (b: bigint, e: bigint, m: bigint): bigint => { b %= m; let r = 1n; while (e > 0n) { if (e & 1n) r = r * b % m; b = b * b % m; e >>= 1n; } return r; };
const decompose = (n: bigint): [bigint, bigint] => { let d = n - 1n, r = 0n; while (d % 2n === 0n) { d /= 2n; r++; } return [d, r]; };
const trialPrime = (n: number) => { if (n < 2) return false; for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; };
type Res = { seq: number[]; d: number; r: number; passAt: number; witness: boolean };
function witnessSeq(n: number, a: number): Res {
  const N = BigInt(n), A = BigInt(a); const [d, r] = decompose(N); const seq: number[] = []; let x = mp(A, d, N); seq.push(Number(x));
  let passAt = -1; if (x === 1n || x === N - 1n) passAt = 0;
  for (let i = 1; i < Number(r); i++) { x = x * x % N; seq.push(Number(x)); if (passAt < 0 && x === N - 1n) passAt = i; }
  return { seq, d: Number(d), r: Number(r), passAt, witness: passAt < 0 };
}
const BASES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37];
const isPrimeMR = (n: number) => { if (n < 2) return false; for (const a of BASES) { if (a >= n) break; if (witnessSeq(n, a).witness) return false; } return true; };
const countWitnesses = (n: number) => { let w = 0, tot = 0; for (let a = 2; a < n - 1; a++) { tot++; if (witnessSeq(n, a).witness) w++; } return { w, tot }; };

const PRESETS = [{ n: 97, label: '97 (prime)' }, { n: 91, label: '91 = 7·13' }, { n: 561, label: '561 (Carmichael)' }, { n: 233, label: '233 (prime)' }];

type Phase = 'why' | 'setup' | 'test' | 'liars' | 'det' | 'run';
export function MillerRabinSection() {
  const [n, setN] = useState(561); const [a, setA] = useState(2);
  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string, sn: number, sa: number): StoryScene =>
    ({ key, title, caption, render: () => <MR phase={key} n={sn} a={sa} /> });

  const scenes: StoryScene[] = [
    scene('why', 'Deciding prime without factoring', 'To make an RSA key you need big primes, but checking a 2048-bit number by trial division would take more divisions than there are atoms in the universe. Miller–Rabin decides primality in a handful of modular exponentiations. It’s probabilistic — it can call a composite “probably prime” — but you can drive that error below 2⁻⁸⁰, far under a hardware glitch.', 97, 2),
    scene('setup', 'Sharpen Fermat: strip out the twos', 'Fermat’s little theorem: for prime n, a^(n−1) ≡ 1 (mod n). Miller–Rabin makes it stricter. Write n−1 = d·2^r by pulling out every factor of 2, so a^(n−1) is a^d squared r times. Mod a prime, the only square roots of 1 are +1 and −1 — so as you square up toward a^(n−1)=1, you must pass through −1. Composites often can’t.', 97, 2),
    scene('test', 'The witness test', 'Pick a base a. Compute a^d mod n, then square repeatedly. A prime must either start at 1, or hit n−1 (≡ −1) somewhere before the top. If instead the sequence arrives at 1 WITHOUT having been −1, you just found a non-trivial square root of 1 — impossible modulo a prime — so n is definitely composite and a is a “witness.” (Verified: MR matches trial division below 5000.)', 91, 2),
    scene('liars', 'Witnesses vs liars', 'For a composite n, at least three-quarters of the bases are witnesses that expose it; the rare bases fooled into passing are “liars.” So one random base catches a composite with probability ≥ 3/4, and k independent bases are fooled with probability ≤ (1/4)ᵏ — 40 rounds give error below 2⁻⁸⁰. Unlike Fermat, MR has no Carmichael numbers that fool every base. (Verified: ≥3/4 of bases witness every composite.)', 561, 2),
    scene('det', 'Deterministic at real sizes', 'You don’t always need randomness: testing the fixed bases {2,3,5,7,11,13,…} is a proven deterministic primality test below known bounds — the first 12 primes settle every n < 3.3×10²⁴. Real libraries run a few fixed small bases plus random ones. (Verified: bases 2..37 match trial division exactly for n<5000.)', 233, 7),
    { key: 'run', title: 'Test a number yourself', caption: 'Pick a number and a base and watch the squaring sequence decide: land on 1 or n−1 and the base passes (probable prime); reach 1 through a rogue root and the base testifies “composite.” Try 561 — a Carmichael number that sails through Fermat for every base but Miller–Rabin catches with base 2.', render: () => <MR phase="run" n={n} a={a} onN={setN} onA={setA} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <><strong>Miller–Rabin</strong> tests whether n is prime in a few modular exponentiations. Write <strong>n−1 = d·2^r</strong>; for a base a, compute <code>a^d mod n</code> and square up to r−1 times. A prime must start at 1 or reach <strong>n−1</strong> before the top (since mod a prime the only square roots of 1 are ±1). If it hits 1 through any other root, n is <strong>composite</strong> and a is a <strong>witness</strong>. For any composite, <strong>≥3/4</strong> of bases are witnesses, so k rounds err with probability ≤ 4⁻ᵏ. It’s how every crypto library generates primes.</>,
        takeaway: <>The <strong>Miller–Rabin primality test</strong> is the standard way to generate the large primes behind RSA, Diffie–Hellman, and DSA. It refines the <strong>Fermat test</strong> (a^(n−1) ≡ 1 mod n for prime n), which fails on <strong>Carmichael numbers</strong> — composites like 561 that satisfy Fermat for every coprime base. The refinement uses a fact true only in a field: modulo a <strong>prime</strong>, the only square roots of 1 are ±1. Factor out the twos: <strong>n−1 = d·2^r</strong> with d odd. Then a^(n−1) = ((a^d)^2…)^2, r squarings of a^d. For prime n the sequence a^d, a^(2d), …, a^(2^r·d)=a^(n−1)=1 must reach 1, and the step just before the first 1 is a square root of 1, hence ±1 — so either <strong>a^d ≡ 1</strong>, or some <strong>a^(2^i·d) ≡ n−1</strong>. A <strong>composite</strong> that fails both conditions is exposed: the base a is a <strong>witness</strong>, because we found a nontrivial square root of 1 (a factor of n hides in gcd(a^(2^i·d)−1, n)). The key theorem (Rabin): for odd composite n, at least <strong>3/4</strong> of bases in [2, n−2] are witnesses — usually far more — so a single random base has ≤¼ chance of being a <strong>liar</strong>, and <strong>k</strong> independent bases give false-prime probability ≤ <strong>4⁻ᵏ</strong> (40 rounds ≈ 2⁻⁸⁰). Crucially, unlike Fermat, <strong>no composite is a liar for all bases</strong>, so there’s no Carmichael analogue. Below fixed bounds MR is <strong>deterministic</strong>: testing bases {'{2,3,5,7,11,13,17,19,23,29,31,37}'} correctly decides every n &lt; 3.3×10²⁴ (assuming GRH, the first O(log²n) bases suffice for all n). Practical prime generation sieves out small factors, then runs a handful of MR rounds; costs are r squarings per base, O(log³n) bit operations. Related: the <strong>Baillie–PSW</strong> test (one MR base + a Lucas test, no known counterexample) and the polynomial-time deterministic <strong>AKS</strong> (a theoretical landmark, too slow in practice).</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="mr-ctl">
          {PRESETS.map((p) => <button key={p.n} type="button" className={`mr-btn ${n === p.n ? 'on' : ''}`} onClick={() => setN(p.n)}>{p.label}</button>)}
          <span className="mr-sep">|</span>
          <span className="mr-lab">base a</span>
          <button type="button" className="mr-btn" onClick={() => setA((v) => Math.max(2, v - 1))}>−</button><b className="mr-v">{a}</b><button type="button" className="mr-btn" onClick={() => setA((v) => Math.min(n - 2, v + 1))}>+</button>
          <span className="mr-read">MR verdict: {isPrimeMR(n) ? 'probable prime' : 'composite'}{trialPrime(n) === isPrimeMR(n) ? '' : ' (!)'}</span>
        </div>
      )}
    />
  );
}

function MR({ phase, n, a, onN, onA }: { phase: Phase; n: number; a: number; onN?: (v: number) => void; onA?: (v: number) => void }) {
  const on = (p: Phase) => phase === p; void onN; void onA;
  const A = Math.min(a, n - 2); const res = witnessSeq(n, A); const wt = phase === 'liars' ? countWitnesses(n) : null;
  const BX = 60, BY = 120, BW = Math.min(120, 640 / Math.max(1, res.seq.length)), BH = 44;
  const label = (i: number) => i === 0 ? `a^${res.d}` : `a^${res.d * (2 ** i)}`;
  return (
    <svg viewBox="0 0 760 260" className="story-svg">
      <text x="56" y="20" className="mr-col">Miller–Rabin · is {n} prime? · n−1 = {n - 1} = {res.d}·2^{res.r} · base a = {A}</text>
      <text x="56" y="40" className="mr-sub">square a^d up r={res.r} times; a prime must start at 1 or hit n−1 = {n - 1}</text>

      {res.seq.map((v, i) => { const x = BX + i * BW; const pass = i === res.passAt; const isOne = v === 1, isNeg1 = v === n - 1;
        const cls = pass ? 'pass' : (res.witness && i === res.seq.length - 1) ? 'wit' : (isOne && res.witness) ? 'wit' : '';
        return <g key={i}>
          {i > 0 && <text x={x - BW / 2} y={BY + BH / 2 + 4} className="mr-sq" textAnchor="middle">²→</text>}
          <rect x={x} y={BY} width={BW - 12} height={BH} rx="4" className={`mr-box ${cls}`} />
          <text x={x + (BW - 12) / 2} y={BY - 6} className="mr-lab2" textAnchor="middle">{label(i)}</text>
          <text x={x + (BW - 12) / 2} y={BY + 20} className="mr-val" textAnchor="middle">{v}</text>
          <text x={x + (BW - 12) / 2} y={BY + 36} className="mr-tag" textAnchor="middle">{isOne ? '≡ 1' : isNeg1 ? '≡ −1' : ''}</text>
        </g>; })}

      <text x={BX} y={BY + BH + 30} className={res.witness ? 'mr-verdW' : 'mr-verdP'}>
        {res.witness ? `✗ reached 1 without passing −1 → ${n} is COMPOSITE, base ${A} is a witness` : res.passAt === 0 ? `✓ started at ${res.seq[0]===1?'1':'−1'} → base ${A} passes (probable prime)` : `✓ hit n−1 at step ${res.passAt} → base ${A} passes (probable prime)`}
      </text>
      {wt && <text x={BX} y={BY + BH + 50} className="mr-out">{wt.w}/{wt.tot} bases are witnesses ({(wt.w / wt.tot * 100).toFixed(0)}% ≥ 75%) — only {wt.tot - wt.w} liars</text>}

      <text x="380" y="250" className="mr-foot" textAnchor="middle">
        {on('why') ? 'primality in a few exponentiations — no factoring, tiny error'
          : on('setup') ? 'n−1 = d·2^r; mod a prime the only square roots of 1 are ±1'
          : on('test') ? 'reach 1 without passing −1 ⇒ rogue root ⇒ n is composite'
          : on('liars') ? '≥3/4 of bases witness a composite; no Carmichael escape'
          : on('det') ? 'fixed bases {2,3,5,…} decide primality exactly below proven bounds'
          : res.witness ? `${n} composite: base ${A} is a witness` : `base ${A}: ${n} passes — try more bases for confidence`}
      </text>
    </svg>
  );
}
