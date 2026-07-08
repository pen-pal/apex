// Guided story: the Chinese Remainder Theorem (CRT). A number below M = m1·m2·… (coprime moduli) is uniquely pinned by
// its remainders (x mod m1, x mod m2, …) — a "fingerprint". CRT reconstructs x from the fingerprint: x = Σ r_i·e_i mod M.
// PRODUCE: dial the fingerprint, watch the unique number reconstruct. BREAK: drop coprimality (swap 5→6) and the
// bijection collapses — the same fingerprint now belongs to three numbers, and many fingerprints belong to none. The
// math (reconstruct, preimages, coprimality) lives in crt.ts and is node-verified. Powers RSA-CRT (~4× faster) and
// residue-number-system parallel arithmetic. Sandboxed/CONCEPTUAL.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';
import { reconstruct, preimages, pairwiseCoprime, product, reachable, gcd, basis } from './crt';

const COPRIME = [3, 5, 7];
const BROKEN = [3, 6, 7]; // gcd(3,6)=3 — not coprime
const HUE = [205, 150, 40];

export function CrtSection() {
  const [rs, setRs] = useState([2, 3, 2]);
  const [broken, setBroken] = useState(false);
  const mods = broken ? BROKEN : COPRIME;
  // keep residues in range when a modulus shrinks/grows
  const clamped = rs.map((r, i) => r % mods[i]);

  const scene = (key: string, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <Crt mods={COPRIME} rs={[2, 3, 2]} broken={false} /> });

  const scenes: StoryScene[] = [
    scene('finger', 'A number’s fingerprint', 'Take a number and its remainders modulo several coprime bases — say mod 3, mod 5, mod 7. Below 3·5·7 = 105, no two numbers share the same triple of remainders: the fingerprint (2, 3, 2) belongs to exactly one number. The Chinese Remainder Theorem says that fingerprint pins the number down completely.'),
    scene('recon', 'Reconstruct from remainders', 'Given only the remainders, recover the number. CRT builds a basis: e₁ = 70 is ≡ 1 mod 3 but ≡ 0 mod 5 and 7; e₂ = 21 is ≡ 1 only mod 5; e₃ = 15 is ≡ 1 only mod 7. Then x = r₁·e₁ + r₂·e₂ + r₃·e₃ mod 105 — each term injects its remainder at its own modulus and vanishes at the others.'),
    scene('unique', 'Why it’s unique', 'The map number → (remainders) is a perfect one-to-one correspondence: there are exactly 3·5·7 = 105 possible triples and exactly 105 numbers in [0, 105), so every triple comes from exactly one number. No collisions, no gaps. (Verified: exactly one solution satisfies all three congruences.)'),
    scene('why', 'The one precondition: coprime', 'Every word of this rests on the moduli being pairwise coprime. Coprime means the triple of remainders carries M = m₁·m₂·m₃ independent pieces of information — exactly enough to name all M numbers. Share a factor and that count drops to the least common multiple, far below the product: the fingerprint can no longer tell M numbers apart. On the last scene, break it and watch.'),
    scene('rsa', 'How RSA decrypts 4× faster', 'RSA decryption is x = cᵈ mod N with N = p·q (two coprime primes). Instead of one huge exponentiation, compute it mod p and mod q separately — each with a half-size modulus and, by Fermat, a reduced exponent — then CRT-combine the two results into the answer mod N. That’s roughly 4× faster, and it’s how every real RSA library decrypts. (Verified: the round-trip is exact.)'),
    { key: 'run', title: 'Produce it — then break coprimality', caption: 'Dial the remainders and the unique number in [0, 105) reconstructs live, and the check confirms it. Then hit “break coprimality” to swap the 5 for a 6: now the moduli 3 and 6 share a factor, only lcm(3,6,7)=42 fingerprints are reachable out of 126, and the map goes three-to-one — the same fingerprint names three numbers (or, if the remainders disagree across the shared factor, none). The theorem needs coprime moduli, and here is exactly why.', render: () => <Crt mods={mods} rs={clamped} setRs={setRs} broken={broken} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>The <strong>Chinese Remainder Theorem</strong> says a number below M = m₁·m₂·… (with the mᵢ pairwise coprime) is uniquely determined by its <strong>remainders</strong> (x mod m₁, x mod m₂, …) — a fingerprint with no collisions. It reconstructs x from that fingerprint as <strong>x = Σ rᵢ·eᵢ mod M</strong>, where each basis element eᵢ is ≡ 1 at modulus mᵢ and ≡ 0 at the others. Coprimality is the whole precondition: drop it and the map stops being one-to-one. It underlies fast RSA decryption and carry-free parallel arithmetic.</>,
        takeaway: <>The <strong>Chinese Remainder Theorem</strong> states that for pairwise-coprime moduli m₁,…,m_k with product M, the system x ≡ rᵢ (mod mᵢ) has a <strong>unique</strong> solution modulo M — equivalently ℤ/M ≅ ℤ/m₁ × … × ℤ/m_k is a ring isomorphism. Reconstruction is explicit: Mᵢ = M/mᵢ, yᵢ = Mᵢ⁻¹ mod mᵢ (exists because gcd(Mᵢ, mᵢ) = 1), <strong>eᵢ = Mᵢ·yᵢ</strong> ≡ 1 (mod mᵢ), ≡ 0 (mod mⱼ≠ᵢ), so <strong>x = Σ rᵢ·eᵢ mod M</strong>. The precondition is load-bearing: if two moduli share a factor, only <strong>lcm</strong>(mᵢ) fingerprints are reachable instead of the product, so the map is many-to-one — some fingerprints collide onto several numbers and some are impossible (verified here by brute-forcing every preimage). Two big consequences of the coprime case. A <strong>residue number system</strong>: represent an integer by its remainders and add/multiply <em>component-wise</em> with no carries between lanes — fully parallel, used in DSP and crypto hardware (comparison and division are the hard operations). And <strong>RSA-CRT</strong>: compute cᵈ mod N (N = pq) as two half-width exponentiations mod p and mod q, then CRT-combine — about a <strong>4× speedup</strong> every RSA library uses (and a classic fault-injection target: a glitch in one branch leaks a factor of N via a gcd). CRT also powers Gödel numbering, integer secret sharing, Garner’s mixed-radix algorithm, and — through the same ring-isomorphism view — the number-theoretic transform for fast polynomial multiplication.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="crm-ctl">
          {mods.map((mi, i) => <span key={i} className="crm-dial">
            <span className="crm-dl" style={{ color: `hsl(${HUE[i]} 65% 62%)` }}>mod {mi}:</span>
            <button type="button" className="crm-btn" onClick={() => setRs((v) => v.map((r, j) => j === i ? (r + mi - 1) % mi : r % mods[j]))}>−</button>
            <b className="crm-rv">{clamped[i]}</b>
            <button type="button" className="crm-btn" onClick={() => setRs((v) => v.map((r, j) => j === i ? (r + 1) % mi : r % mods[j]))}>+</button>
          </span>)}
          <button type="button" className={`crm-break ${broken ? 'on' : ''}`} onClick={() => setBroken((b) => !b)}>
            {broken ? '↩ restore coprime (mod 5)' : '⚠ break coprimality (5→6)'}
          </button>
        </div>
      )}
    />
  );
}

function Crt({ mods, rs, setRs, broken }: { mods: number[]; rs: number[]; setRs?: (f: (v: number[]) => number[]) => void; broken: boolean }) {
  void setRs;
  const M = product(mods);
  const coprime = pairwiseCoprime(mods);
  const pre = preimages(rs, mods);
  const E = coprime ? basis(mods) : [];
  const x = coprime ? reconstruct(rs, mods) : (pre[0] ?? -1);
  const cx = (i: number) => 150 + i * 165;
  const badPair = broken ? mods.flatMap((m, i) => mods.map((n, j) => (i < j && gcd(m, n) > 1 ? `${m},${n}` : '')).filter(Boolean))[0] : '';

  return (
    <svg viewBox="0 0 760 300" className="story-svg">
      <text x="56" y="22" className="crm-col">Chinese Remainder Theorem · moduli {mods.join('·')} = {M} · {coprime ? 'coprime ✓' : `NOT coprime (gcd ${badPair})`}</text>

      {mods.map((mi, i) => <g key={i}>
        <rect x={cx(i) - 60} y={44} width={120} height={26} rx="4" className="crm-mod" style={{ stroke: `hsl(${HUE[i]} 60% 55%)` }} />
        <text x={cx(i)} y={62} className="crm-modt" textAnchor="middle" style={{ fill: `hsl(${HUE[i]} 65% 70%)` }}>x mod {mi} = {rs[i]}</text>
        {coprime && <text x={cx(i)} y={92} className="crm-basis" textAnchor="middle">e{sub(i + 1)} = {E[i]}</text>}
        {coprime && <text x={cx(i)} y={108} className="crm-basissub" textAnchor="middle">≡1 mod {mi}, ≡0 else</text>}
      </g>)}

      {coprime ? <>
        <text x={64} y={150} className="crm-lbl">reconstruct: x = Σ rᵢ·eᵢ mod {M}</text>
        <text x={64} y={178} className="crm-formula">{rs.map((r, i) => `${i ? ' + ' : ''}${r}·${E[i]}`).join('')} = {rs.reduce((s, r, i) => s + r * E[i], 0)}</text>
        <text x={64} y={204} className="crm-formula">mod {M} = <tspan className="crm-x">{x}</tspan></text>
        <text x={64} y={234} className="crm-verify">check: {mods.map((mi) => `${x} mod ${mi} = ${x % mi}`).join('   ')} {mods.every((mi, i) => x % mi === rs[i]) ? '✓' : '✗'}</text>
      </> : <>
        <text x={64} y={144} className="crm-lbl">reachable fingerprints = lcm({mods.join(',')}) = {reachable(mods)}, but numbers = {M}</text>
        {pre.length > 1 ? <>
          <text x={64} y={176} className="crm-collide">fingerprint ({rs.join(',')}) belongs to {pre.length} numbers: {pre.join(', ')}</text>
          <text x={64} y={202} className="crm-formula">the map is {M / reachable(mods)}-to-1 — you cannot reconstruct a unique x</text>
        </> : <>
          <text x={64} y={176} className="crm-gap">fingerprint ({rs.join(',')}) is impossible — no number has these remainders</text>
          <text x={64} y={202} className="crm-formula">mod {mods[1]} = {rs[1]} forces mod {mods[0]} = {rs[1] % mods[0]}, but you asked for {rs[0]}</text>
        </>}
        <text x={64} y={234} className="crm-verify">{pre.length} preimage{pre.length === 1 ? '' : 's'} in [0,{M}) — a bijection needs exactly 1 for every fingerprint</text>
      </>}

      <text x="380" y="284" className="crm-foot" textAnchor="middle">
        {coprime ? `fingerprint (${rs.join(',')}) → the unique number ${x} in [0,${M})`
          : pre.length > 1 ? `coprimality broken → ${pre.length} numbers share one fingerprint (a collision)`
          : 'coprimality broken → this fingerprint has no number at all (a gap)'}
      </text>
    </svg>
  );
}
const SUB = ['₀', '₁', '₂', '₃', '₄'];
const sub = (n: number) => SUB[n] || '';
