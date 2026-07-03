// Guided story: RSA accumulator — commit to a whole SET with a single number, and prove membership with a single number,
// constant size regardless of set size (a Merkle tree's proofs grow as log n). Map each element to a distinct prime; the
// accumulator is acc = g^(∏ primes) mod N in a group of unknown order (RSA modulus, factorization discarded). A membership
// witness for x is w = g^(∏ of the OTHER primes); anyone checks w^x ≡ acc mod N (raising to x multiplies the exponent
// back to the full product). Faking membership for a non-member would need an x-th root of acc — hard under Strong RSA.
// Adding an element is one exponentiation acc' = acc^x. Verified in node: witnesses verify for every member, adds update
// correctly, non-members never verify. Powers stateless blockchains, revocation, anonymous credentials. CONCEPTUAL crypto.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const N = 3233n, G = 3n; // demo RSA modulus 53·61; real accumulators use N whose factorization is discarded
const modpow = (b: bigint, e: bigint, m: bigint): bigint => { b %= m; let r = 1n; while (e > 0n) { if (e & 1n) r = r * b % m; b = b * b % m; e >>= 1n; } return r; };
const PRIMES = [3n, 5n, 7n, 11n];
const prod = (ps: bigint[]) => ps.reduce((a, b) => a * b, 1n);
const acc = (ps: bigint[]) => modpow(G, prod(ps), N);
const witness = (ps: bigint[], i: number) => modpow(G, prod(ps.filter((_, j) => j !== i)), N);

type Phase = 'commit' | 'primes' | 'witness' | 'unforge' | 'dynamic' | 'run';
export function AccumulatorSection() {
  const [set, setSet] = useState(PRIMES); const [sel, setSel] = useState(2);
  const A = acc(set); const i = Math.min(sel, set.length - 1); const w = witness(set, i); const e = set[i]; const check = modpow(w, e, N);
  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <Acu phase={key} set={PRIMES} sel={2} /> });

  const scenes: StoryScene[] = [
    scene('commit', 'A whole set in one number', 'A Merkle tree commits to a set, but proving an element belongs takes a path of log(n) hashes — the proof grows with the set. An RSA accumulator commits to the entire set with a SINGLE number, and proves membership with a single number too. Constant size, whether the set has ten elements or ten million.'),
    scene('primes', 'Elements are primes; the accumulator is an exponent', 'Map each set element to a distinct prime. The accumulator is acc = g raised to the PRODUCT of all those primes, modulo N — where N is an RSA modulus whose factorization is thrown away, so the group’s order is unknown. That one group element, 975 here for {3,5,7,11}, encodes the whole set.'),
    scene('witness', 'A witness leaves one element out', 'To prove x is in the set, hand over the witness w = g raised to the product of all the OTHER primes. The verifier checks w^x ≡ acc (mod N): raising the witness to x’s own prime multiplies that prime back into the exponent, rebuilding the full product and reproducing the accumulator. One exponentiation confirms membership. (Verified.)'),
    scene('unforge', 'You can’t fake membership', 'For an x that is NOT in the set, no witness w with w^x ≡ acc exists: producing one means computing an x-th root of acc, which is hard under the Strong RSA assumption without N’s discarded factorization. So a valid witness is unforgeable proof of membership — nobody can invent one for an element they didn’t include. (Verified: non-members never verify.)'),
    scene('dynamic', 'Dynamic and always constant-size', 'Add an element with a single exponentiation: acc′ = acc^(new prime); existing witnesses update the same way. The accumulator and every witness stay one group element — never a growing path. That constant size is why accumulators appear in stateless blockchains (no need to store the whole set), certificate revocation, and anonymous credentials.'),
    { key: 'run', title: 'Prove membership, add elements', caption: 'Click an element to prove it belongs: its witness (the product of the other primes, exponentiated) appears, and the w^x ≡ acc check confirms it — one number against one number. Add a new element and the accumulator updates with a single exponentiation. The proof never grows; a Merkle tree would add another log(n) hashes per doubling.', render: () => <Acu phase="run" set={set} sel={i} onSel={setSel} onAdd={() => setSet((s) => s.length < 6 ? [...s, [13n, 17n, 19n][s.length - 4] || 13n] : s)} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>An <strong>RSA accumulator</strong> commits to an entire set with one number and proves membership with one number — <strong>constant size</strong>, unlike a Merkle tree whose proofs grow as log(n). Each element becomes a distinct prime; the accumulator is <strong>acc = g^(∏ primes) mod N</strong> in a group of unknown order. A membership <strong>witness</strong> for x is g raised to the product of the <em>other</em> primes, and anyone verifies <strong>w^x ≡ acc</strong>. Faking membership needs an x-th root of acc — hard under Strong RSA — so witnesses are unforgeable, and adds are a single exponentiation.</>,
        takeaway: <>A <strong>cryptographic accumulator</strong> is a constant-size commitment to a set that supports short membership proofs. The <strong>RSA accumulator</strong> (Benaloh–de Mare 1993, Camenisch–Lysyanskaya 2002) works in ℤ/N* for an RSA modulus N = pq whose factorization is <strong>discarded</strong>, so the group order φ(N) is unknown to everyone. Each set element is hashed to a distinct odd <strong>prime</strong> eᵢ, and the accumulator is <strong>A = g^(e₁·e₂·…·eₖ) mod N</strong> — a single group element for the whole set. The <strong>membership witness</strong> for element eᵢ is <strong>wᵢ = g^(product of all eⱼ with j ≠ i)</strong>; verification checks <strong>wᵢ raised to eᵢ ≡ A (mod N)</strong>, which holds because raising wᵢ to eᵢ restores the full product in the exponent. <strong>Security</strong> rests on the <strong>Strong RSA assumption</strong>: forging a witness for an element x not in the set requires computing g^(P/x) where x ∤ P — an x-th-root extraction that is infeasible without φ(N). The scheme is <strong>dynamic</strong>: adding y is A′ = A^y (one exponentiation), and every existing witness updates as wᵢ′ = wᵢ^y; deletion and <strong>non-membership</strong> proofs are also possible (the latter via a Bézout witness g^a·A^b with a·x + b·P = 1). The decisive property versus a <strong>Merkle tree</strong> is size: a Merkle membership proof is a path of ⌈log₂ n⌉ sibling hashes that grows with the set, while an accumulator’s witness is always one group element — enabling <strong>stateless</strong> clients that verify membership without storing the set, used in stateless-blockchain UTXO commitments, certificate/credential <strong>revocation</strong> lists, and <strong>anonymous credentials</strong> (proving you hold a valid, unrevoked credential in zero knowledge). The trade-offs: mapping to primes and modular exponentiation are heavier than hashing, witness updates require seeing each change, and the discarded-factorization <strong>trusted setup</strong> is a real assumption — which newer <strong>class-group</strong> accumulators remove by using a group of unknown order that needs no trusted setup.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="acu-ctl">
          <span className="acu-lab">prove:</span>
          {set.map((p, j) => <button key={j} type="button" className={`acu-btn ${i === j ? 'on' : ''}`} onClick={() => setSel(j)}>{p.toString()}</button>)}
          <button type="button" className="acu-btn add" onClick={() => setSet((sx) => sx.length < 6 ? [...sx, [13n, 17n, 19n][sx.length - 4] || 13n] : sx)}>+ add</button>
          <span className="acu-read">w^{e.toString()} mod {N.toString()} = {check.toString()} {check === A ? '= acc ✓' : '✗'}</span>
        </div>
      )}
    />
  );
}

function Acu({ phase, set, sel, onSel, onAdd }: { phase: Phase; set: bigint[]; sel: number; onSel?: (i: number) => void; onAdd?: () => void }) {
  const on = (p: Phase) => phase === p; void onSel; void onAdd;
  const A = acc(set); const i = Math.min(sel, set.length - 1); const w = witness(set, i); const e = set[i]; const check = modpow(w, e, N);
  const others = set.filter((_, j) => j !== i);
  return (
    <svg viewBox="0 0 760 300" className="story-svg">
      <text x="56" y="22" className="acu-col">RSA accumulator · set of {set.length} · acc = g^(∏ primes) mod {N.toString()} = {A.toString()} · one number for the whole set</text>

      {/* the set as prime chips */}
      <text x={64} y={58} className="acu-lbl">set (each element → a prime)</text>
      {set.map((p, j) => <g key={j}>
        <rect x={64 + j * 66} y={66} width={54} height={28} rx="5" className={`acu-chip ${i === j ? 'sel' : ''}`} />
        <text x={64 + j * 66 + 27} y={85} className="acu-chipt" textAnchor="middle">{p.toString()}</text>
      </g>)}

      {/* the accumulator */}
      <text x={64} y={130} className="acu-lbl">accumulator (commits to all of them)</text>
      <rect x={64} y={138} width={200} height={30} rx="5" className="acu-acc" />
      <text x={164} y={158} className="acu-acct" textAnchor="middle">acc = {A.toString()}</text>

      {/* witness + verification for the selected element */}
      {(on('witness') || on('unforge') || on('dynamic') || on('run')) && <>
        <text x={300} y={130} className="acu-lbl">membership proof for {e.toString()}</text>
        <text x={300} y={152} className="acu-wit">witness w = g^(∏ others: {others.map((p) => p.toString()).join('·')}) = {w.toString()}</text>
        <text x={300} y={176} className="acu-wit">verify: w^{e.toString()} = {w.toString()}^{e.toString()} mod {N.toString()} = <tspan className={check === A ? 'acu-ok' : 'acu-bad'}>{check.toString()} {check === A ? '= acc ✓' : '✗'}</tspan></text>
      </>}

      {/* size contrast */}
      <text x={64} y={214} className="acu-size">proof size: accumulator + witness = <tspan className="acu-hi">2 numbers</tspan>, any set size · Merkle tree: ⌈log₂ {set.length}⌉ = {Math.ceil(Math.log2(Math.max(2, set.length)))} hashes, and growing</text>

      <text x="380" y="286" className="acu-foot" textAnchor="middle">
        {on('commit') ? 'one number commits to the whole set (Merkle proofs grow as log n)'
          : on('primes') ? 'acc = g^(product of the elements’ primes) mod N'
          : on('witness') ? 'witness = g^(product of the OTHERS); w^x ≡ acc rebuilds the product'
          : on('unforge') ? 'a non-member has no x-th root of acc → can’t forge a witness'
          : on('dynamic') ? 'add = one exponentiation acc^x; witnesses stay one number'
          : `${e.toString()} ∈ set: w^${e.toString()} = ${check.toString()} = acc — proof is 2 numbers, not a growing path`}
      </text>
    </svg>
  );
}
