// Guided story: the Chinese Remainder Theorem (CRT). A number below M = m1·m2·… (coprime moduli) is uniquely pinned by
// its remainders (x mod m1, x mod m2, …) — a "fingerprint". CRT reconstructs x from the fingerprint: x = Σ r_i·e_i mod M,
// where e_i = M_i·(M_i⁻¹ mod m_i), M_i = M/m_i, is the basis element that is ≡1 at modulus m_i and ≡0 at the others. So
// x picks out r_i at each modulus. Verified in node: reconstruction satisfies every congruence, the solution is unique in
// [0,M), and the round-trip x→residues→x is exact. Powers RSA-CRT decryption (~4× faster) and residue-number-system
// parallel arithmetic. Classic example x≡2(3), x≡3(5), x≡2(7) → x=23. Sandboxed/CONCEPTUAL.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const MODS = [3, 5, 7]; const M = MODS.reduce((a, b) => a * b, 1); // 105
const modinv = (a: number, m: number) => { a = ((a % m) + m) % m; for (let x = 1; x < m; x++) if (a * x % m === 1) return x; return 1; };
const E = MODS.map((mi) => { const Mi = M / mi; return Mi * modinv(Mi, mi); }); // basis: E[i] ≡ 1 (mod m_i), ≡ 0 (mod m_j≠i) → [70,21,15]
const reconstruct = (rs: number[]) => rs.reduce((s, r, i) => s + r * E[i], 0) % M;
const HUE = [205, 150, 40];

type Phase = 'finger' | 'recon' | 'unique' | 'rns' | 'rsa' | 'run';
export function CrtSection() {
  const [rs, setRs] = useState([2, 3, 2]);
  const x = reconstruct(rs);
  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <Crt phase={key} rs={[2, 3, 2]} /> });

  const scenes: StoryScene[] = [
    scene('finger', 'A number’s fingerprint', 'Take a number and its remainders modulo several coprime bases — say mod 3, mod 5, mod 7. Below 3·5·7 = 105, no two numbers share the same triple of remainders: the fingerprint (2, 3, 2) belongs to exactly one number. The Chinese Remainder Theorem says that fingerprint pins the number down completely.'),
    scene('recon', 'Reconstruct from remainders', 'Given only the remainders, recover the number. CRT builds a basis: e₁ = 70 is ≡ 1 mod 3 but ≡ 0 mod 5 and 7; e₂ = 21 is ≡ 1 only mod 5; e₃ = 15 is ≡ 1 only mod 7. Then x = r₁·e₁ + r₂·e₂ + r₃·e₃ mod 105 — each term injects its remainder at its own modulus and vanishes at the others.'),
    scene('unique', 'Why it’s unique', 'The map number → (remainders) is a perfect one-to-one correspondence: there are exactly 3·5·7 = 105 possible triples and exactly 105 numbers in [0, 105), so every triple comes from exactly one number. No collisions, no gaps. (Verified: exactly one solution satisfies all three congruences.)'),
    scene('rns', 'Parallel arithmetic with no carries', 'Because remainders never interact across moduli, you can add or multiply two numbers by combining their fingerprints component-wise — (a mod mᵢ) op (b mod mᵢ) for each i independently, with no carries rippling between lanes. This residue number system splits big-integer arithmetic into independent parallel channels.'),
    scene('rsa', 'How RSA decrypts 4× faster', 'RSA decryption is x = cᵈ mod N with N = p·q. Instead of one huge exponentiation, compute it mod p and mod q separately — each with a half-size modulus and, by Fermat, a reduced exponent — then CRT-combine the two results into the answer mod N. That’s roughly 4× faster, and it’s how every real RSA library decrypts. (Verified: the round-trip is exact.)'),
    { key: 'run', title: 'Set a fingerprint, get the number', caption: 'Dial the remainders modulo 3, 5, and 7. The unique number in [0, 105) with that fingerprint reconstructs live as x = r₁·70 + r₂·21 + r₃·15 mod 105, and the check below confirms x really does leave those remainders. Every one of the 105 triples maps to its own number — a lossless coordinate system for integers.', render: () => <Crt phase="run" rs={rs} setRs={setRs} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>The <strong>Chinese Remainder Theorem</strong> says a number below M = m₁·m₂·… (with the mᵢ pairwise coprime) is uniquely determined by its <strong>remainders</strong> (x mod m₁, x mod m₂, …) — a fingerprint with no collisions. It reconstructs x from that fingerprint as <strong>x = Σ rᵢ·eᵢ mod M</strong>, where each basis element eᵢ is ≡ 1 at modulus mᵢ and ≡ 0 at the others, so each remainder is injected at its own modulus. It underlies fast RSA decryption and carry-free parallel arithmetic.</>,
        takeaway: <>The <strong>Chinese Remainder Theorem</strong> states that for pairwise-coprime moduli m₁,…,m_k with product M, the system of congruences x ≡ rᵢ (mod mᵢ) has a <strong>unique</strong> solution modulo M. Equivalently, the ring ℤ/M is isomorphic to the product ℤ/m₁ × … × ℤ/m_k — mapping a number to its tuple of remainders is a structure-preserving bijection. The reconstruction is explicit: let Mᵢ = M/mᵢ and yᵢ = Mᵢ⁻¹ mod mᵢ (which exists because gcd(Mᵢ, mᵢ) = 1); then <strong>eᵢ = Mᵢ·yᵢ</strong> satisfies eᵢ ≡ 1 (mod mᵢ) and eᵢ ≡ 0 (mod mⱼ) for j ≠ i, so <strong>x = Σ rᵢ·eᵢ mod M</strong> reproduces every remainder (verified here: reconstruction satisfies all congruences, is the unique value in [0, M), and round-trips exactly). Two big consequences. First, a <strong>residue number system</strong>: represent an integer by its remainders and do addition, subtraction, and multiplication <em>component-wise</em> with no carries between moduli — fully parallel lanes, used in signal processing and some cryptographic hardware (comparison and division are the hard operations). Second, <strong>RSA-CRT</strong>: to compute m = cᵈ mod N with N = pq, compute m_p = c^(d mod p−1) mod p and m_q = c^(d mod q−1) mod q, then CRT-combine — two half-width modular exponentiations instead of one full-width one, about a <strong>4× speedup</strong> that every RSA implementation uses (and a classic fault-injection target: a glitch in one branch leaks a factor of N via a gcd). CRT also powers Gödel numbering, secret sharing over integers, and Garner’s mixed-radix algorithm, and its ring-isomorphism view is the same idea behind the number-theoretic transform used to multiply large polynomials.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="crm-ctl">
          {MODS.map((mi, i) => <span key={i} className="crm-dial">
            <span className="crm-dl" style={{ color: `hsl(${HUE[i]} 65% 62%)` }}>mod {mi}:</span>
            <button type="button" className="crm-btn" onClick={() => setRs((v) => v.map((r, j) => j === i ? (r + mi - 1) % mi : r))}>−</button>
            <b className="crm-rv">{rs[i]}</b>
            <button type="button" className="crm-btn" onClick={() => setRs((v) => v.map((r, j) => j === i ? (r + 1) % mi : r))}>+</button>
          </span>)}
          <span className="crm-read">→ x = {x}</span>
        </div>
      )}
    />
  );
}

function Crt({ phase, rs, setRs }: { phase: Phase; rs: number[]; setRs?: (f: (v: number[]) => number[]) => void }) {
  const on = (p: Phase) => phase === p; void setRs;
  const x = reconstruct(rs);
  const terms = rs.map((r, i) => r * E[i]);
  const sum = terms.reduce((a, b) => a + b, 0);
  const cx = (i: number) => 150 + i * 165;
  return (
    <svg viewBox="0 0 760 300" className="story-svg">
      <text x="56" y="22" className="crm-col">Chinese Remainder Theorem · moduli {MODS.join('·')} = {M} · number {x} ↔ fingerprint ({rs.join(',')})</text>

      {/* moduli + residues + basis */}
      {MODS.map((mi, i) => <g key={i}>
        <rect x={cx(i) - 60} y={44} width={120} height={26} rx="4" className="crm-mod" style={{ stroke: `hsl(${HUE[i]} 60% 55%)` }} />
        <text x={cx(i)} y={62} className="crm-modt" textAnchor="middle" style={{ fill: `hsl(${HUE[i]} 65% 70%)` }}>x mod {mi} = {rs[i]}</text>
        <text x={cx(i)} y={92} className="crm-basis" textAnchor="middle">e{sub(i + 1)} = {E[i]}</text>
        <text x={cx(i)} y={108} className="crm-basissub" textAnchor="middle">≡1 mod {mi}, ≡0 else</text>
      </g>)}

      {/* reconstruction formula */}
      <text x={64} y={150} className="crm-lbl">reconstruct: x = Σ rᵢ·eᵢ mod {M}</text>
      <text x={64} y={178} className="crm-formula">
        {rs.map((r, i) => `${i ? ' + ' : ''}${r}·${E[i]}`).join('')} = {sum}
      </text>
      <text x={64} y={204} className="crm-formula">{sum} mod {M} = <tspan className="crm-x">{x}</tspan></text>

      {/* verification */}
      <text x={64} y={234} className="crm-verify">check: {MODS.map((mi) => `${x} mod ${mi} = ${x % mi}`).join('   ')} {MODS.every((mi, i) => x % mi === rs[i]) ? '✓' : '✗'}</text>

      <text x="380" y="284" className="crm-foot" textAnchor="middle">
        {on('finger') ? 'remainders mod coprime bases = a collision-free fingerprint'
          : on('recon') ? 'x = r₁·70 + r₂·21 + r₃·15 mod 105 — basis injects each remainder'
          : on('unique') ? '105 triples ↔ 105 numbers: a perfect one-to-one map'
          : on('rns') ? 'add/multiply fingerprints component-wise — no carries, parallel'
          : on('rsa') ? 'RSA: work mod p and mod q, CRT-combine → ~4× faster decryption'
          : `fingerprint (${rs.join(',')}) → the unique number ${x} in [0,${M})`}
      </text>
    </svg>
  );
}
const SUB = ['₀', '₁', '₂', '₃', '₄'];
const sub = (n: number) => SUB[n] || '';
