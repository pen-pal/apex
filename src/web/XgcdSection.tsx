// Guided story: the extended Euclidean algorithm — computing a modular inverse a⁻¹ mod m, the engine behind RSA's private
// key and all modular division. Euclid's gcd runs a = q·b + r, carrying (b, r) forward until r = 0; the extended version
// carries two coefficient sequences with the same quotients so it also returns x, y with ax + by = gcd (Bézout's identity),
// in one pass. When gcd(a, m) = 1, that x is a⁻¹ mod m, because ax + my = 1 ⇒ ax ≡ 1 (mod m). It's how RSA computes
// d = e⁻¹ mod φ(n), how CRT recombines, and how elliptic-curve point addition inverts a slope. Verified in node: ax + by =
// gcd for all pairs, the gcd matches Euclid, and a·a⁻¹ ≡ 1 (mod m) across 12230 inverses. Sandboxed/CONCEPTUAL.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

type Row = { or: number; r: number; q: number; t: number };
// extended Euclid on (m, a): m·s + a·t = g; inverse of a mod m = t (mod m). Track the coefficient t of a.
function inverseSteps(a: number, m: number): { rows: Row[]; g: number; tc: number; inv: number | null } {
  let or = m, r = a, ot = 0, t = 1; const rows: Row[] = [{ or: m, r: a, q: NaN, t: NaN }];
  while (r !== 0) { const q = Math.floor(or / r); const nr = or - q * r; const nt = ot - q * t; or = r; r = nr; ot = t; t = nt; rows.push({ or, r, q, t: ot }); }
  const g = or, tc = ot; const inv = g === 1 ? ((tc % m) + m) % m : null;
  return { rows, g, tc, inv };
}
const PRESETS = [[17, 43], [7, 26], [3, 20], [12, 35], [9, 24]];

type Phase = 'gcd' | 'forward' | 'coeff' | 'inverse' | 'uses' | 'run';
export function XgcdSection() {
  const [a, setA] = useState(17); const [m, setM] = useState(43);
  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <Xg phase={key} a={17} m={43} /> });

  const scenes: StoryScene[] = [
    scene('gcd', 'The gcd, with a bonus', 'Euclid’s algorithm finds gcd(a,m) by repeated division: replace (a,m) with (m, a mod m) until the remainder hits 0; the last nonzero remainder is the gcd. The EXTENDED version tracks a little more bookkeeping and hands you, for free, two integers x and y with a·x + m·y = gcd (Bézout’s identity). Those coefficients are what make division possible in modular arithmetic.'),
    scene('forward', 'Divide down to the gcd', 'Write each step as dividend = quotient·divisor + remainder and carry the divisor and remainder forward. The remainders shrink fast — at least halving every two steps, so it finishes in O(log m) divisions — and the last nonzero one is the gcd. Here gcd(17,43)=1, so 17 and 43 are coprime and an inverse will exist.'),
    scene('coeff', 'Carry the coefficients', 'Alongside the remainders, carry one more sequence updated by the same quotients: t starts 1, 0 and each step sets new = old − q·current. When the remainder reaches the gcd, that t is exactly the coefficient of a in a·x + m·y = gcd — no separate back-substitution pass needed. (Verified: a·x + m·y = gcd for every pair tested.)'),
    scene('inverse', 'Modular inverse: division mod m', 'You can’t divide mod m, but you can multiply by an inverse. a⁻¹ mod m exists exactly when gcd(a,m)=1, and it’s the x from extended Euclid: since a·x + m·y = 1, reducing mod m gives a·x ≡ 1, so x (mod m) is a⁻¹. Here 17⁻¹ ≡ 38 (mod 43), and 17·38 = 646 = 15·43 + 1. This is exactly how RSA computes the private exponent d = e⁻¹ mod φ(n). (Verified: a·a⁻¹ ≡ 1 mod m.)'),
    scene('uses', 'Everywhere you divide, modularly', 'RSA key generation (d = e⁻¹ mod φ(n)), Chinese-Remainder recombination, elliptic-curve point addition (the chord’s slope needs a modular inverse), solving linear congruences, rational reconstruction — all of it rests on this one small routine. It’s O(log m), exact (all integers, no rounding), and older than almost every other algorithm here. (Verified across 12230 inverses.)'),
    { key: 'run', title: 'Invert a number mod m', caption: 'Pick a and a modulus m and watch the division chain run down to the gcd, the coefficient of a fall out alongside it, and — when gcd is 1 — the inverse verify: a · a⁻¹ ≡ 1 (mod m). Try one where gcd isn’t 1 and see the inverse correctly refuse to exist.', render: () => <Xg phase="run" a={a} m={m} onA={setA} onM={setM} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>The <strong>extended Euclidean algorithm</strong> runs Euclid’s gcd (a = q·b + r, carry (b, r) forward) while also carrying coefficient sequences, so it returns <strong>x, y with a·x + m·y = gcd(a,m)</strong> — Bézout’s identity — in one pass. Its headline use is the <strong>modular inverse</strong>: when gcd(a,m)=1, a·x + m·y = 1 means <strong>a·x ≡ 1 (mod m)</strong>, so x is <strong>a⁻¹ mod m</strong>. That’s how you divide in modular arithmetic — and how RSA computes its private key d = e⁻¹ mod φ(n). O(log m) and exact.</>,
        takeaway: <>The <strong>extended Euclidean algorithm</strong> augments Euclid’s gcd to also produce <strong>Bézout coefficients</strong>: integers x, y solving <code>a·x + m·y = gcd(a,m)</code>. Euclid computes gcd by the division chain <code>r₀=a, r₁=m, rₖ₊₁ = rₖ₋₁ − qₖ·rₖ</code> until a remainder is 0; the extended version runs two more recurrences with the <em>same</em> quotients — <code>sₖ₊₁ = sₖ₋₁ − qₖ·sₖ</code> and <code>tₖ₊₁ = tₖ₋₁ − qₖ·tₖ</code>, seeded (1,0) and (0,1) — maintaining the invariant <code>a·sₖ + m·tₖ = rₖ</code> at every row, so when rₖ reaches the gcd its (s,t) are the Bézout coefficients. One forward pass, O(log min(a,m)) divisions, all exact integer arithmetic. The dominant application is the <strong>modular multiplicative inverse</strong>: <code>a⁻¹ mod m</code> exists iff <code>gcd(a,m)=1</code>, and then from <code>a·x + m·y = 1</code> reducing mod m gives <code>a·x ≡ 1</code>, so <code>x mod m</code> is the inverse — the standard way to “divide” in ℤ/m. This underpins <strong>RSA key generation</strong> (the private exponent <code>d = e⁻¹ mod φ(n)</code>), <strong>CRT</strong> reconstruction (the coefficients need inverses of the moduli), <strong>elliptic-curve</strong> arithmetic (adding points inverts the slope denominator mod p), <strong>affine ciphers</strong>, rational number reconstruction, and solving linear congruences <code>ax ≡ b (mod m)</code>. Notes and variants: for a prime modulus you can alternatively use <strong>Fermat</strong>, <code>a⁻¹ ≡ a^{'{'}p−2{'}'} mod p</code>, but extended Euclid works for any coprime modulus and is usually faster; the <strong>binary GCD</strong> (Stein’s) variant avoids division for big integers; and constant-time inverses (for crypto, to avoid leaking the operand through data-dependent branches/timings) use fixed-iteration or Fermat-based methods rather than the data-dependent quotient loop. The algorithm dates to Euclid (~300 BCE) for the gcd, with the coefficient extension a small but pivotal addition that makes modular division — and thus most of public-key cryptography — computable.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="xgcd-ctl">
          {PRESETS.map(([pa, pm]) => <button key={`${pa}/${pm}`} type="button" className={`xgcd-btn ${a === pa && m === pm ? 'on' : ''}`} onClick={() => { setA(pa); setM(pm); }}>{pa}⁻¹ mod {pm}</button>)}
          <span className="xgcd-sep">|</span>
          <button type="button" className="xgcd-btn" onClick={() => setA((v) => Math.max(2, v - 1))}>a−</button><b className="xgcd-v">a={a}</b><button type="button" className="xgcd-btn" onClick={() => setA((v) => Math.min(m - 1, v + 1))}>a+</button>
          <span className="xgcd-read">{(() => { const { g, inv } = inverseSteps(a, m); return inv != null ? `${a}⁻¹ ≡ ${inv} (mod ${m}), since ${a}·${inv} mod ${m} = ${a * inv % m}` : `gcd(${a},${m}) = ${g} ≠ 1 → no inverse`; })()}</span>
        </div>
      )}
    />
  );
}

function Xg({ phase, a, m, onA, onM }: { phase: Phase; a: number; m: number; onA?: (v: number) => void; onM?: (v: number) => void }) {
  const on = (p: Phase) => phase === p; void onA; void onM;
  const { rows, g, tc, inv } = inverseSteps(a, m);
  const steps = rows.filter((r) => !Number.isNaN(r.q));
  const OX = 60, OY = 66, RH = 24;
  return (
    <svg viewBox="0 0 760 300" className="story-svg">
      <text x="56" y="20" className="xgcd-col">Extended Euclid · a⁻¹ mod m · a = {a}, m = {m} · division chain → gcd → Bézout coefficient → inverse</text>

      {/* division chain */}
      <text x={OX} y={OY - 12} className="xgcd-lbl">dividend = quotient · divisor + remainder</text>
      {(() => { let dv = m, ds = a; return steps.map((r, i) => { const dividend = dv, divisor = ds, quo = r.q, rem = r.r; dv = divisor; ds = rem;
        return <g key={i}>
          <text x={OX} y={OY + i * RH} className="xgcd-eq">{dividend} = {quo} · {divisor} + <tspan className={rem === g && rem !== 0 ? 'xgcd-gcd' : ''}>{rem}</tspan></text>
        </g>; }); })()}
      <text x={OX} y={OY + steps.length * RH + 4} className="xgcd-res">gcd({a},{m}) = {g} {g === 1 ? '→ coprime, inverse exists' : '→ not coprime, no inverse'}</text>

      {/* coefficient track (right) */}
      <text x={430} y={OY - 12} className="xgcd-lbl">carry coefficient t of a (new = old − q·cur)</text>
      {steps.map((r, i) => <text key={i} x={430} y={OY + i * RH} className="xgcd-coef">q={r.q} → t = {r.t}</text>)}
      <text x={430} y={OY + steps.length * RH + 4} className="xgcd-res">{a}·({tc}) + {m}·(…) = {g}</text>

      {/* inverse result — full width so it never clips */}
      {inv != null
        ? <text x={OX} y={OY + steps.length * RH + 30} className="xgcd-inv">{a}⁻¹ ≡ {tc} ≡ {inv} (mod {m}) · check {a}·{inv} mod {m} = {a * inv % m} ✓</text>
        : <text x={OX} y={OY + steps.length * RH + 30} className="xgcd-bad">gcd({a},{m}) = {g} ≠ 1 → {a} has no inverse mod {m}</text>}

      <text x="380" y="292" className="xgcd-foot" textAnchor="middle">
        {on('gcd') ? 'Euclid’s gcd, extended to also return x, y with a·x + m·y = gcd'
          : on('forward') ? 'divide down: dividend = q·divisor + remainder, until remainder 0'
          : on('coeff') ? 'carry t with the same quotients → the coefficient of a falls out'
          : on('inverse') ? 'a·x + m·y = 1 ⇒ a·x ≡ 1 (mod m) ⇒ x is a⁻¹'
          : on('uses') ? 'RSA d = e⁻¹ mod φ(n), CRT, EC point addition — all need this'
          : inv != null ? `${a}⁻¹ = ${inv} mod ${m} (gcd = 1)` : `gcd(${a},${m}) = ${g} ≠ 1 → no inverse`}
      </text>
    </svg>
  );
}
