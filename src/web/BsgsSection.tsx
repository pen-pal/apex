// Guided story: baby-step giant-step — the meet-in-the-middle algorithm for the discrete logarithm, g^x ≡ h (mod p).
// Diffie-Hellman / ElGamal / Schnorr rest on this being hard; brute force tries x = 0,1,2,… up to p steps. BSGS cuts that
// to O(√p): write x = i·m + j with m = ⌈√(p−1)⌉, so h·(g^−m)^i = g^j — build a table of the baby steps g^j, then stride
// by g^−m until a giant step lands in it. DEEPENED so you PRODUCE the √p scaling (pick larger primes and watch the baby
// table grow as √p, the speedup rising 2.9×→19×) and then hit the wall a master knows: √p is a colossal speedup but
// STILL EXPONENTIAL in the bit-length. A cost chart shows BSGS halving the exponent (2^(b/2)) yet still shooting past the
// feasibility horizon — so it cracks a 9-bit toy in ~26 steps but a 256-bit group needs 2^128 (hopeless). That b/2-bit
// security is exactly why real groups are ≥256-bit. Node-verified: 5 primes solve with visible strides; 256-bit → 2^128.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const mp = (b: bigint, e: bigint, m: bigint): bigint => { b %= m; if (b < 0n) b += m; let r = 1n; while (e > 0n) { if (e & 1n) r = r * b % m; b = b * b % m; e >>= 1n; } return r; };
function xgcd(a: bigint, b: bigint): [bigint, bigint] { let or = a, r = b, os = 1n, s = 0n; while (r !== 0n) { const q = or / r;[or, r] = [r, or - q * r];[os, s] = [s, os - q * s]; } return [or, os]; }
const modinv = (a: bigint, m: bigint): bigint => { const [g, x] = xgcd(((a % m) + m) % m, m); return g === 1n ? ((x % m) + m) % m : 1n; };

type Baby = { j: number; val: number };
type Giant = { i: number; val: number; jHit: number };
function solve(g: number, h: number, p: number): { m: number; baby: Baby[]; giant: Giant[]; found: { i: number; j: number; x: number } | null } {
  const P = BigInt(p), G = BigInt(g), H = BigInt(h); const m = Math.ceil(Math.sqrt(p - 1));
  const baby: Baby[] = []; const map = new Map<string, number>(); let e = 1n;
  for (let j = 0; j < m; j++) { baby.push({ j, val: Number(e) }); if (!map.has(e.toString())) map.set(e.toString(), j); e = e * G % P; }
  const factor = modinv(mp(G, BigInt(m), P), P);
  const giant: Giant[] = []; let cur = H % P; let found = null;
  for (let i = 0; i <= m; i++) { const jHit = map.has(cur.toString()) ? map.get(cur.toString())! : -1; giant.push({ i, val: Number(cur), jHit }); if (jHit >= 0) { found = { i, j: jHit, x: i * m + jHit }; break; } cur = cur * factor % P; }
  return { m, baby, giant, found };
}
// each preset uses a primitive root so the log is unique and the collision lands at giant step i=2 (a visible stride);
// primes rise 23→503 so the baby table (√p) visibly grows and the speedup climbs. Node-verified solvable.
const PRESETS = [{ g: 5, h: 18, p: 23 }, { g: 2, h: 47, p: 61 }, { g: 3, h: 38, p: 127 }, { g: 6, h: 69, p: 251 }, { g: 5, h: 103, p: 503 }];
const HORIZON = 80; // ~2^80 operations: the standard "computationally infeasible" line

type Phase = 'problem' | 'split' | 'baby' | 'giant' | 'why' | 'run';
export function BsgsSection() {
  const [pi, setPi] = useState(0);
  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string, p = 0): StoryScene =>
    ({ key, title, caption, render: () => <Bsgs phase={key} g={PRESETS[p].g} h={PRESETS[p].h} p={PRESETS[p].p} /> });

  const scenes: StoryScene[] = [
    scene('problem', 'The discrete logarithm', 'Diffie–Hellman, ElGamal, and Schnorr signatures all rest on one problem being hard: given a base g, a prime modulus p, and h = gˣ mod p, recover the exponent x. Going forward (exponentiate) is easy; going back (the discrete log) is believed hard. The obvious attack tries x = 0, 1, 2, … up to p steps. Baby-step giant-step cuts that to about √p by meeting in the middle.'),
    scene('split', 'Split the exponent', 'Write the unknown x as x = i·m + j, where m = ⌈√(p−1)⌉ and both i and j run 0…m−1. Then gˣ = g^(im)·gʲ, so h = g^(im)·gʲ, which rearranges to h·(g^(−m))ⁱ = gʲ. The left side depends only on i, the right only on j — two halves to search separately instead of one big space.'),
    scene('baby', 'Baby steps: build a table', 'Compute every possible right-hand side gʲ for j = 0…m−1 — the “baby steps”, each one multiply by g — and store them in a hash table keyed by value. That’s √p multiplications and √p memory: a lookup table of every small exponent.'),
    scene('giant', 'Giant steps: hunt for a match', 'Now stride through the left side: start at h and repeatedly multiply by g^(−m), a giant leap of m in the exponent — h, h·g^(−m), h·g^(−2m), … For each, look it up in the baby table. A hit at gʲ on giant step i means h = g^(im+j), so x = i·m + j. Found in √p strides. (Verified: gˣ ≡ h.)'),
    scene('why', 'A √p speedup that’s still exponential', 'Total work is O(√p) time and O(√p) memory — a colossal speedup. But look at the cost chart: √p only HALVES the exponent. Brute force is 2ᵇ for a b-bit prime; BSGS is 2^(b/2). Both still shoot past the feasibility line — BSGS just needs twice the bits to do it. So it cracks small or careless groups outright, yet a 256-bit group costs 2¹²⁸ and stays safe. A b-bit group buys only b/2 bits of security.', 4),
    { key: 'run', title: 'Crack it — then watch it hit the wall', caption: 'Pick a problem: the baby table fills with g⁰…g^(m−1), the giant steps stride from h by g^(−m), and the collision — the same value in both rows — pins x = i·m + j, checked live as gˣ ≡ h. Now climb the primes 23 → 503 and watch the baby table grow as √p while the speedup rises 2.9× → 19×. But the cost chart shows the limit: BSGS is 2^(b/2), still exponential — it demolishes these toy primes and would demolish a weak or smooth key, but a real 256-bit group needs 2¹²⁸ operations and memory, more than there are atoms in the observable universe. √p breaks the careless, never the careful.', render: () => <Bsgs phase="run" g={PRESETS[pi].g} h={PRESETS[pi].h} p={PRESETS[pi].p} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <><strong>Baby-step giant-step</strong> solves the <strong>discrete logarithm</strong> g^x ≡ h (mod p) in <strong>O(√p)</strong> time by meeting in the middle. Write x = i·m + j with m = ⌈√(p−1)⌉; then h = g^(im)·g^j ⇒ <strong>h·(g^−m)^i = g^j</strong>. Precompute a table of all <strong>g^j</strong> (baby steps, √p of them), then stride by <strong>g^−m</strong> (giant steps) until a value hits the table — that collision gives x = im + j. The √p speedup is huge, but still exponential in the bit-length: a b-bit group gives only ~b/2 bits of security, which is exactly why crypto groups must be huge.</>,
        takeaway: <><strong>Baby-step giant-step</strong> (Daniel Shanks, 1971) computes a <strong>discrete logarithm</strong> — <code>x</code> with <code>g^x ≡ h (mod p)</code> in a cyclic group of order n — in <strong>O(√n)</strong> time and space, versus O(n) for brute force, by a <strong>meet-in-the-middle</strong>: write <code>x = i·m + j</code> with <code>m = ⌈√n⌉</code>; then <code>h·(g^{'{'}−m{'}'})^i = g^j</code>, so build a hash table of the <strong>baby steps</strong> <code>g^j → j</code> (√n multiplies, √n memory), precompute the stride <code>g^{'{'}−m{'}'}</code> via a modular inverse, and walk the <strong>giant steps</strong> <code>h, h·g^{'{'}−m{'}'}, …</code> until one hits the table, giving <code>x = i·m + j</code>. It works in any finite cyclic group, including elliptic curves (the ECDLP). The consequence you can produce here is the security bar: because the cost is <code>√p = 2^(b/2)</code> for a b-bit prime, a <strong>b-bit group offers only ~b/2 bits of security</strong> against it — the √p is a genuine, devastating speedup on small or poorly-chosen parameters, but it merely <em>halves the exponent</em>, so it stays exponential and a 256-bit group still costs an unreachable 2¹²⁸. That’s why 128-bit security needs a <strong>256-bit</strong> elliptic curve or a ~3072-bit prime field. BSGS’s <strong>O(√n) memory</strong> is its practical ceiling; <strong>Pollard’s rho for logarithms</strong> matches the √n time in <strong>O(1)</strong> memory, and for prime fields <strong>index calculus</strong> is sub-exponential (why finite-field DH needs far larger moduli than curves). With <strong>Pohlig–Hellman</strong>, discrete logs also fall fast when the group order is <strong>smooth</strong> (all small prime factors) — the reason secure parameters mandate a large prime-order subgroup.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="bsgs-ctl">
          <div className="bsgs-ctl-row">
            {PRESETS.map((pr, i) => <button key={i} type="button" className={`bsgs-btn ${pi === i ? 'on' : ''}`} onClick={() => setPi(i)}>p={pr.p}</button>)}
          </div>
          <span className="bsgs-read">{(() => { const P = PRESETS[pi]; const { m, baby, giant, found } = solve(P.g, P.h, P.p); const steps = baby.length + giant.length; const bits = Math.log2(P.p); return found ? <>solved {P.g}^x ≡ {P.h} mod {P.p}: <b>x = {found.x}</b> (= {found.i}·{m}+{found.j}) in <b>{steps} steps</b> vs {P.p} brute (<b>{(P.p / steps).toFixed(1)}×</b>) · √p = {m}-entry table · a {bits.toFixed(0)}-bit prime; a 256-bit one needs 2¹²⁸</> : 'no solution'; })()}</span>
        </div>
      )}
    />
  );
}

// cost chart geometry: x = bit-length b (0..256), y = log2(operations) (0..256)
const CX0 = 74, CX1 = 858, CY0 = 250, CY1 = 384, BMAX = 256, OMAX = 256;
const bx = (b: number) => CX0 + (b / BMAX) * (CX1 - CX0);
const oy = (o: number) => CY1 - (Math.min(o, OMAX) / OMAX) * (CY1 - CY0);

function Bsgs({ phase, g, h, p }: { phase: Phase; g: number; h: number; p: number }) {
  const on = (ph: Phase) => phase === ph;
  const { m, baby, giant, found } = solve(g, h, p);
  const hitVal = found ? baby[found.j].val : -1;
  const BX = 60, BW = Math.min(60, 792 / Math.max(baby.length, 1)), BY = 62, GY = 138;
  const showChart = on('why') || on('run');
  const bits = Math.log2(p);
  return (
    <svg viewBox="0 0 900 410" className="story-svg">
      <text x="56" y="22" className="bsgs-col">Baby-step giant-step · solve {g}ˣ ≡ {h} (mod {p}) · m = ⌈√{p - 1}⌉ = {m} · x = i·m + j</text>

      <text x={BX} y={BY - 8} className="bsgs-lbl">baby steps: gʲ for j = 0…{m - 1} (a lookup table, √p entries)</text>
      {baby.map((b) => <g key={b.j}>
        <rect x={BX + b.j * BW} y={BY} width={BW - 4} height={30} rx="3" className={`bsgs-cell ${found && b.val === hitVal ? 'hit' : ''}`} />
        <text x={BX + b.j * BW + (BW - 4) / 2} y={BY + 14} className="bsgs-val" textAnchor="middle">{b.val}</text>
        <text x={BX + b.j * BW + (BW - 4) / 2} y={BY + 26} className="bsgs-sub" textAnchor="middle">j={b.j}</text>
      </g>)}

      <text x={BX} y={GY - 8} className="bsgs-lbl">giant steps: h·(g⁻ᵐ)ⁱ, stride until one lands in the table</text>
      {giant.map((gt) => <g key={gt.i}>
        <rect x={BX + gt.i * BW} y={GY} width={BW - 4} height={30} rx="3" className={`bsgs-cell ${gt.jHit >= 0 ? 'hit' : 'giant'}`} />
        <text x={BX + gt.i * BW + (BW - 4) / 2} y={GY + 14} className="bsgs-val" textAnchor="middle">{gt.val}</text>
        <text x={BX + gt.i * BW + (BW - 4) / 2} y={GY + 26} className="bsgs-sub" textAnchor="middle">i={gt.i}</text>
      </g>)}

      {found
        ? <text x={BX} y={GY + 58} className="bsgs-found">collision: {hitVal} at baby j={found.j} and giant i={found.i} → x = {found.i}·{m}+{found.j} = {found.x} · {g}^{found.x} mod {p} = {Number(mp(BigInt(g), BigInt(found.x), BigInt(p)))} ✓ · {baby.length + giant.length} steps vs {p} brute</text>
        : <text x={BX} y={GY + 58} className="bsgs-lbl">no solution in this group</text>}

      {/* the wall: √p halves the exponent but is still exponential — a cost chart vs the feasibility horizon */}
      {showChart && <g>
        <text x={CX0} y={CY0 - 12} className="bsgs-chart-title">cost vs group size — √p only halves the exponent</text>
        <line x1={CX0} y1={CY1} x2={CX1} y2={CY1} className="bsgs-axis" />
        <line x1={CX0} y1={CY0} x2={CX0} y2={CY1} className="bsgs-axis" />
        {/* feasibility horizon at 2^80 */}
        <line x1={CX0} y1={oy(HORIZON)} x2={CX1} y2={oy(HORIZON)} className="bsgs-horizon" />
        <text x={CX0 + 8} y={oy(HORIZON) - 6} className="bsgs-horizon-lbl">2⁸⁰ · feasibility horizon</text>
        {/* brute 2^b and BSGS 2^(b/2) */}
        <line x1={bx(0)} y1={oy(0)} x2={bx(BMAX)} y2={oy(BMAX)} className="bsgs-brute" />
        <line x1={bx(0)} y1={oy(0)} x2={bx(BMAX)} y2={oy(BMAX / 2)} className="bsgs-bsgs" />
        <text x={bx(70)} y={oy(70) - 7} className="bsgs-brute-lbl">brute force · 2ᵇ</text>
        <text x={bx(200)} y={oy(102) - 7} className="bsgs-bsgs-lbl">BSGS · 2^(b/2)</text>
        {/* markers: this toy prime, and a real 256-bit group */}
        <circle cx={bx(bits)} cy={oy(bits / 2)} r="4" className="bsgs-mark-now" />
        <text x={bx(bits) + 8} y={oy(bits / 2) + 4} className="bsgs-mark-lbl">this p ({bits.toFixed(0)}-bit): {baby.length + giant.length} steps</text>
        <circle cx={bx(256)} cy={oy(128)} r="4" className="bsgs-mark-bad" />
        <text x={bx(256)} y={oy(128) - 10} className="bsgs-mark-bad-lbl" textAnchor="end">256-bit: 2¹²⁸ safe</text>
        {[80, 128, 160, 256].map((b) => <text key={b} x={bx(b)} y={CY1 + 14} className="bsgs-tick" textAnchor="middle">{b}b</text>)}
      </g>}

      {!showChart && <text x="450" y="300" className="bsgs-foot" textAnchor="middle">
        {on('problem') ? 'given g, p, h = gˣ mod p, find x — believed hard (crypto rests on it)'
          : on('split') ? 'x = i·m + j ⇒ h·(g⁻ᵐ)ⁱ = gʲ — search two √p halves, not one p'
          : on('baby') ? 'table of every gʲ — √p multiplies, √p memory'
          : 'stride h by g⁻ᵐ until a value hits the baby table → x = im+j'}
      </text>}
    </svg>
  );
}
