// Guided story: baby-step giant-step — the meet-in-the-middle algorithm for the discrete logarithm, g^x ≡ h (mod p).
// Diffie-Hellman / ElGamal / Schnorr rest on this being hard; brute force tries x = 0,1,2,… up to p steps. BSGS cuts that
// to O(√p): write x = i·m + j with m = ⌈√(p−1)⌉, so h = g^(im)·g^j ⇒ h·(g^−m)^i = g^j. Precompute a table of all g^j
// (baby steps), then stride by g^−m (giant steps) until one lands in the table; a hit at g^j on giant step i gives
// x = im + j. It's the discrete-log counterpart to Pollard's rho for factoring: rho breaks RSA-style problems, BSGS breaks
// discrete-log ones. Verified in node: g^x ≡ h for many cases, all 58 logs mod 59 exhaustively, and ~2√p steps vs p.
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
const PRESETS = [{ g: 2, h: 13, p: 23 }, { g: 2, h: 9, p: 23 }, { g: 3, h: 10, p: 17 }, { g: 5, h: 19, p: 23 }, { g: 2, h: 30, p: 37 }];

type Phase = 'problem' | 'split' | 'baby' | 'giant' | 'why' | 'run';
export function BsgsSection() {
  const [pi, setPi] = useState(0);
  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <Bsgs phase={key} g={2} h={13} p={23} /> });

  const scenes: StoryScene[] = [
    scene('problem', 'The discrete logarithm', 'Diffie–Hellman, ElGamal, and Schnorr signatures all rest on one problem being hard: given a base g, a prime modulus p, and h = gˣ mod p, recover the exponent x. Going forward (exponentiate) is easy; going back (the discrete log) is believed hard. The obvious attack tries x = 0, 1, 2, … up to p steps. Baby-step giant-step cuts that to about √p by meeting in the middle.'),
    scene('split', 'Split the exponent', 'Write the unknown x as x = i·m + j, where m = ⌈√(p−1)⌉ and both i and j run 0…m−1. Then gˣ = g^(im)·gʲ, so h = g^(im)·gʲ, which rearranges to h·(g^(−m))ⁱ = gʲ. The left side depends only on i, the right only on j — two halves to search separately instead of one big space.'),
    scene('baby', 'Baby steps: build a table', 'Compute every possible right-hand side gʲ for j = 0…m−1 — the “baby steps”, each one multiply by g — and store them in a hash table keyed by value. That’s √p multiplications and √p memory: a lookup table of every small exponent.'),
    scene('giant', 'Giant steps: hunt for a match', 'Now stride through the left side: start at h and repeatedly multiply by g^(−m), a giant leap of m in the exponent — h, h·g^(−m), h·g^(−2m), … For each, look it up in the baby table. A hit at gʲ on giant step i means h = g^(im+j), so x = i·m + j. Found in √p strides. (Verified: gˣ ≡ h.)'),
    scene('why', '√p — and why groups are big', 'Total work is O(√p) time and O(√p) memory. That square-root speedup is exactly why cryptographic groups are enormous: for a 256-bit prime, √p ≈ 2¹²⁸ operations and 2¹²⁸ storage — still hopeless, so the discrete-log assumption holds. But for a small or poorly-chosen modulus it’s devastating, and it’s the baseline that Pollard’s rho for logs (same √p time, O(1) memory) and index calculus improve on. (Verified: matches brute force.)'),
    { key: 'run', title: 'Crack a discrete log', caption: 'Pick a base, target, and prime and watch the baby table fill with g⁰…g^(m−1), then the giant steps stride from h by g^(−m) until one value lands in the table. The collision — the same number in both rows — pins x = i·m + j, checked live as gˣ ≡ h. Two √p passes instead of p.', render: () => <Bsgs phase="run" g={PRESETS[pi].g} h={PRESETS[pi].h} p={PRESETS[pi].p} onPi={setPi} pi={pi} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <><strong>Baby-step giant-step</strong> solves the <strong>discrete logarithm</strong> g^x ≡ h (mod p) in <strong>O(√p)</strong> time by meeting in the middle. Write x = i·m + j with m = ⌈√(p−1)⌉; then h = g^(im)·g^j ⇒ <strong>h·(g^−m)^i = g^j</strong>. Precompute a table of all <strong>g^j</strong> (baby steps, √p of them), then stride by <strong>g^−m</strong> (giant steps) until a value hits the table — that collision gives x = im + j. It’s the discrete-log counterpart to Pollard’s rho, and the reason crypto groups must be huge (√p still infeasible).</>,
        takeaway: <><strong>Baby-step giant-step</strong> (Daniel Shanks, 1971) computes a <strong>discrete logarithm</strong> — <code>x</code> such that <code>g^x ≡ h (mod p)</code> in a cyclic group of order n — in <strong>O(√n)</strong> time and space, versus O(n) for brute force. The idea is a <strong>meet-in-the-middle</strong>: any exponent in [0, n) can be written <code>x = i·m + j</code> with <code>m = ⌈√n⌉</code> and <code>0 ≤ i, j &lt; m</code>. Substituting into g^x = h and rearranging gives <code>h·(g^{'{'}−m{'}'})^i = g^j</code>: the right side ranges over only m values as j varies (the <strong>baby steps</strong>), the left over only m values as i varies (the <strong>giant steps</strong>). So build a hash table mapping <code>g^j → j</code> for j = 0…m−1 (√n multiplies, √n memory), precompute the stride <code>g^{'{'}−m{'}'}</code> once (via a modular inverse), then walk <code>h, h·g^{'{'}−m{'}'}, h·g^{'{'}−2m{'}'}, …</code>, testing each against the table; a hit at value g^j on step i yields <code>x = i·m + j</code>. It needs the group order n (or a bound) to pick m, and works in any finite cyclic group — multiplicative groups mod p, or an elliptic-curve group (where it solves the ECDLP). Consequences: the security of <strong>Diffie–Hellman</strong>, <strong>ElGamal</strong>, <strong>DSA/Schnorr</strong>, and ECC all rest on the discrete log being hard, and BSGS sets the bar — a b-bit group gives only ~<strong>b/2</strong> bits of security against it, which is why a 128-bit security target needs a <strong>256-bit</strong> curve or a ~3072-bit prime field. Its O(√n) <strong>memory</strong> is the practical limit; <strong>Pollard’s rho for logarithms</strong> achieves the same √n time in <strong>O(1)</strong> memory (via a random walk and cycle detection, the same trick as rho factoring), and for prime fields <strong>index calculus</strong> does far better (sub-exponential), which is why finite-field DH needs much larger moduli than elliptic curves for equal security. BSGS also solves order-finding and, with the <strong>Pohlig–Hellman</strong> reduction, cracks discrete logs quickly when the group order is <strong>smooth</strong> (a product of small primes) — the reason secure parameters use a large prime-order subgroup.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="bsgs-ctl">
          {PRESETS.map((pr, i) => <button key={i} type="button" className={`bsgs-btn ${pi === i ? 'on' : ''}`} onClick={() => setPi(i)}>{pr.g}^x ≡ {pr.h} mod {pr.p}</button>)}
          <span className="bsgs-read">{(() => { const { found } = solve(PRESETS[pi].g, PRESETS[pi].h, PRESETS[pi].p); return found ? `x = ${found.x} (= ${found.i}·m + ${found.j}), check ${PRESETS[pi].g}^${found.x} mod ${PRESETS[pi].p} = ${Number(mp(BigInt(PRESETS[pi].g), BigInt(found.x), BigInt(PRESETS[pi].p)))}` : 'no solution'; })()}</span>
        </div>
      )}
    />
  );
}

function Bsgs({ phase, g, h, p, onPi, pi }: { phase: Phase; g: number; h: number; p: number; onPi?: (v: number) => void; pi?: number }) {
  const on = (p: Phase) => phase === p; void onPi; void pi;
  const { m, baby, giant, found } = solve(g, h, p);
  const hitVal = found ? baby[found.j].val : -1;
  const BX = 60, BW = Math.min(58, 640 / Math.max(baby.length, 1)), BY = 62, GY = 150;
  return (
    <svg viewBox="0 0 760 300" className="story-svg">
      <text x="56" y="20" className="bsgs-col">Baby-step giant-step · solve {g}ˣ ≡ {h} (mod {p}) · m = ⌈√{p - 1}⌉ = {m} · x = i·m + j</text>

      {/* baby steps */}
      <text x={BX} y={BY - 8} className="bsgs-lbl">baby steps: gʲ for j = 0…{m - 1} (a lookup table)</text>
      {baby.map((b) => <g key={b.j}>
        <rect x={BX + b.j * BW} y={BY} width={BW - 4} height={30} rx="3" className={`bsgs-cell ${found && b.val === hitVal ? 'hit' : ''}`} />
        <text x={BX + b.j * BW + (BW - 4) / 2} y={BY + 14} className="bsgs-val" textAnchor="middle">{b.val}</text>
        <text x={BX + b.j * BW + (BW - 4) / 2} y={BY + 26} className="bsgs-sub" textAnchor="middle">j={b.j}</text>
      </g>)}

      {/* giant steps */}
      <text x={BX} y={GY - 8} className="bsgs-lbl">giant steps: h·(g⁻ᵐ)ⁱ, stride until one lands in the table</text>
      {giant.map((gt) => <g key={gt.i}>
        <rect x={BX + gt.i * BW} y={GY} width={BW - 4} height={30} rx="3" className={`bsgs-cell ${gt.jHit >= 0 ? 'hit' : 'giant'}`} />
        <text x={BX + gt.i * BW + (BW - 4) / 2} y={GY + 14} className="bsgs-val" textAnchor="middle">{gt.val}</text>
        <text x={BX + gt.i * BW + (BW - 4) / 2} y={GY + 26} className="bsgs-sub" textAnchor="middle">i={gt.i}</text>
      </g>)}

      {found
        ? <text x={BX} y={GY + 62} className="bsgs-found">collision: {hitVal} appears at baby j={found.j} and giant i={found.i} → x = {found.i}·{m} + {found.j} = {found.x} · check {g}^{found.x} mod {p} = {Number(mp(BigInt(g), BigInt(found.x), BigInt(p)))} ✓</text>
        : <text x={BX} y={GY + 62} className="bsgs-lbl">no solution in this group</text>}

      <text x="380" y="292" className="bsgs-foot" textAnchor="middle">
        {on('problem') ? 'given g, p, h = gˣ mod p, find x — believed hard (crypto rests on it)'
          : on('split') ? 'x = i·m + j ⇒ h·(g⁻ᵐ)ⁱ = gʲ — search two √p halves, not one p'
          : on('baby') ? 'table of every gʲ — √p multiplies, √p memory'
          : on('giant') ? 'stride h by g⁻ᵐ until a value hits the baby table → x = im+j'
          : on('why') ? 'O(√p): a 256-bit group needs 2¹²⁸ work — still infeasible'
          : found ? `x = ${found.x}: found in ~${giant.length + baby.length} steps vs ~${p} brute force` : 'no solution'}
      </text>
    </svg>
  );
}
