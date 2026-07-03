// Guided story: the sumcheck protocol — the workhorse of modern interactive proofs and SNARKs (GKR, Spartan, Hyrax). A
// prover claims Σ over all 2^v boolean assignments of a low-degree polynomial f equals C. Verifying by summing 2^v terms
// is exponential; sumcheck does it in v rounds where the verifier only evaluates f ONCE. Each round the prover sends a
// univariate polynomial g_i (f summed over the remaining variables, as a function of x_i); the verifier checks
// g_i(0)+g_i(1) == the running claim, folds in a random challenge r_i (new claim = g_i(r_i)), and recurses on one fewer
// variable. After v rounds a single evaluation f(r_1..r_v) must equal the last claim. Verified in node over a prime field:
// the honest prover passes every round and the final check, a wrong claim is caught, and the initial claim equals the
// brute-force hypercube sum (soundness by Schwartz–Zippel). CONCEPTUAL crypto, small field p=97.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const P = 97, V = 3;
const md = (x: number) => ((x % P) + P) % P;
const add = (a: number, b: number) => md(a + b), sub = (a: number, b: number) => md(a - b), mul = (a: number, b: number) => md(a * b);
const VALS = [3, 1, 4, 1, 5, 9, 2, 6]; // f on the 8 hypercube points (mod 97)
const CH = [7, 11, 5];                 // verifier's random challenges
function mle(vals: number[], r: number[]): number { let s = 0; for (let x = 0; x < 8; x++) { let w = 1; for (let i = 0; i < V; i++) { const xi = (x >> i) & 1; w = mul(w, xi ? r[i] : sub(1, r[i])); } s = add(s, mul(vals[x], w)); } return s; }
function gEval(vals: number[], fixed: number[], i: number, c: number): number { let s = 0; const free = V - i; for (let m = 0; m < (1 << free); m++) { const r: number[] = []; for (let k = 0; k < i - 1; k++) r.push(fixed[k]); r.push(c); for (let k = 0; k < free; k++) r.push((m >> k) & 1); s = add(s, mle(vals, r)); } return s; }
type Round = { i: number; g0: number; g1: number; claim: number; sum: number; ok: boolean; r: number; next: number };
function run(vals: number[], claim0: number): { rounds: Round[]; fr: number; finalClaim: number; finalOK: boolean } {
  let claim = claim0; const rs: number[] = []; const rounds: Round[] = [];
  for (let i = 1; i <= V; i++) { const g0 = gEval(vals, rs, i, 0), g1 = gEval(vals, rs, i, 1); const sum = add(g0, g1); const ok = sum === claim; const r = CH[i - 1]; const next = add(g0, mul(r, sub(g1, g0))); rounds.push({ i, g0, g1, claim, sum, ok, r, next }); rs.push(r); claim = next; }
  const fr = mle(vals, rs); return { rounds, fr, finalClaim: claim, finalOK: fr === claim };
}
const HCSUM = VALS.reduce((a, b) => add(a, b), 0);

type Phase = 'exp' | 'round' | 'fold' | 'final' | 'cheat' | 'run';
export function SumcheckSection() {
  const [step, setStep] = useState(V + 1); const [cheat, setCheat] = useState(false);
  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string, st: number, ch: boolean): StoryScene =>
    ({ key, title, caption, render: () => <SC phase={key} step={st} cheat={ch} /> });

  const scenes: StoryScene[] = [
    scene('exp', 'The exponential sum', 'A prover claims that the sum of a function f over all 2ᵛ boolean inputs equals C. Checking it directly means the verifier adds up 2ᵛ terms — exponential, hopeless at scale. The sumcheck protocol lets the verifier be convinced in just v rounds, evaluating f a single time. Here v=3, so 8 terms sum to C — but the method scales to millions.', 0, false),
    scene('round', 'One variable at a time', 'Round 1: the prover sends a small polynomial g₁(x₁) — the sum of f over all the OTHER variables, left as a function of x₁ alone (degree 1 here, since f is multilinear). The verifier’s only check: g₁(0) + g₁(1) must equal the claimed total C. That collapses x₁’s two branches back to the whole sum.', 1, false),
    scene('fold', 'Fold in a random challenge', 'The check passed, so the verifier picks a random field element r₁ and updates the claim to g₁(r₁). Now the prover must prove the sum with x₁ pinned to r₁ — a problem with one fewer variable. Round 2 does the same for x₂, round 3 for x₃, each shrinking the claim.', 2, false),
    scene('final', 'One evaluation closes it', 'After v rounds every variable is fixed to a random challenge (r₁,r₂,r₃). The verifier now makes its ONE call to the real function — f̃(r₁,r₂,r₃) — and checks it equals the final claim. Total verifier work: v cheap checks plus a single evaluation, never the 2ᵛ-term sum. (Verified: honest prover passes every round and this final check.)', V + 1, false),
    scene('cheat', 'Why a liar is caught', 'Suppose the prover lied about C. Then some g_i it sends is a wrong polynomial. Two different low-degree polynomials agree at only a handful of points, so the verifier’s random challenge r_i almost certainly lands where they differ — and the lie surfaces, here immediately at round 1’s check. Soundness error ≤ v·degree / field size (Schwartz–Zippel). (Verified: a wrong claim is caught.)', 1, true),
    { key: 'run', title: 'Run the protocol', caption: 'Step through the rounds. Each shows the prover’s g_i, the verifier’s g_i(0)+g_i(1) = claim check, the random challenge folded in, and the shrinking claim — ending in one evaluation of f. Flip to a cheating prover (a wrong total) and watch the very first check fail. The verifier never summed all eight terms.', render: () => <SC phase="run" step={step} cheat={cheat} onStep={setStep} onCheat={setCheat} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>The <strong>sumcheck protocol</strong> proves that a polynomial f sums to C over all 2ᵛ boolean inputs, without the verifier ever computing that exponential sum. Over v rounds the prover sends a one-variable polynomial g_i (f summed over the remaining variables); the verifier checks <strong>g_i(0) + g_i(1) = the running claim</strong>, folds in a random challenge r_i so the claim becomes g_i(r_i), and recurses on one fewer variable. A single evaluation f(r₁…r_v) at the end closes it. A cheating prover is caught because a wrong low-degree polynomial differs from the true one at a random point.</>,
        takeaway: <>The <strong>sumcheck protocol</strong> (Lund–Fortnow–Karloff–Nisan, 1992) is the engine inside most modern proof systems — GKR, Hyrax, Spartan, and many SNARK/STARK constructions. The claim is H = Σ over all x ∈ {'{0,1}'}ᵛ of f(x) for a polynomial f of low degree in each variable, over a finite field. A direct check is 2ᵛ additions — exponential. Instead, in <strong>round i</strong> the prover sends the univariate polynomial g_i(X) = Σ over the remaining variables of f(r₁,…,rᵢ₋₁, X, xᵢ₊₁,…,x_v), keeping x_i symbolic. The verifier does two cheap things: check <strong>g_i(0) + g_i(1)</strong> equals the current claim (this is exactly the sum over x_i ∈ {'{0,1}'}), then send a uniformly random challenge r_i and set the next claim to g_i(r_i). After v rounds all variables are bound to random field elements and the verifier performs a <strong>single evaluation</strong> of f at (r₁,…,r_v), checking it against the last claim. Verifier cost is O(v·d) field operations plus one oracle call to f, versus the prover’s exponential sum — the asymmetry that makes verifiable computation practical. <strong>Soundness</strong> rests on Schwartz–Zippel: if the prover ever lies, the g_i it sends differs from the honest polynomial, and two distinct degree-d polynomials agree on at most d points, so a random r_i exposes the discrepancy with probability ≥ 1 − d/|𝔽|; over v rounds the total error is ≤ v·d/|𝔽|, negligible for a large field (this demo uses a tiny field p=97 for readable numbers). Combined with a multilinear extension of a witness, sumcheck reduces a statement about an exponential object to a single point evaluation — the core trick behind interactive proofs for #P and today’s succinct arguments.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="su-ctl">
          <button type="button" className="su-btn" onClick={() => setStep((v) => Math.max(0, v - 1))}>‹ back</button>
          <button type="button" className="su-btn" onClick={() => setStep((v) => Math.min(V + 1, v + 1))}>next round ›</button>
          <button type="button" className={`su-btn ${cheat ? 'on' : ''}`} onClick={() => { setCheat((c) => !c); setStep(1); }}>{cheat ? 'cheating prover' : 'honest prover'}</button>
          <span className="su-read">claim C = {cheat ? add(HCSUM, 1) : HCSUM}{cheat ? ' (lied +1)' : ''}</span>
        </div>
      )}
    />
  );
}

function SC({ phase, step, cheat, onStep, onCheat }: { phase: Phase; step: number; cheat: boolean; onStep?: (n: number) => void; onCheat?: (c: boolean) => void }) {
  const on = (p: Phase) => phase === p; void onStep; void onCheat;
  const claim0 = cheat ? add(HCSUM, 1) : HCSUM;
  const { rounds, fr, finalClaim, finalOK } = run(VALS, claim0);
  const st = Math.min(step, V + 1);
  return (
    <svg viewBox="0 0 760 300" className="story-svg">
      <text x="56" y="22" className="su-col">sumcheck · f over {'{0,1}'}³ (mod {P}) · claim C = Σ f(x) = {claim0}{cheat ? ' ← LIE' : ''}</text>

      {/* the 8 hypercube values */}
      <text x={64} y={48} className="su-lbl">f on the hypercube (8 points) → Σ = {HCSUM}</text>
      {VALS.map((v, x) => <g key={x}>
        <rect x={70 + x * 44} y={54} width={38} height={22} rx="3" className="su-hc" />
        <text x={70 + x * 44 + 19} y={69} className="su-hct" textAnchor="middle">{x.toString(2).padStart(3, '0')}:{v}</text>
      </g>)}

      {/* the rounds */}
      {rounds.map((rd, i) => { const shown = st >= rd.i; if (!shown) return null; const failed = !rd.ok; return <g key={i}>
        <text x={64} y={108 + i * 40} className="su-rn">x{rd.i}</text>
        <text x={96} y={108 + i * 40} className="su-rv">g{rd.i}(0)={rd.g0}  g{rd.i}(1)={rd.g1}  →  {rd.g0}+{rd.g1}={rd.sum}</text>
        <text x={420} y={108 + i * 40} className={`su-check ${failed ? 'bad' : 'ok'}`}>{failed ? `≠ ${rd.claim} ✗ caught!` : `= claim ${rd.claim} ✓`}</text>
        {!failed && <text x={600} y={108 + i * 40} className="su-fold">r={rd.r} → claim {rd.next}</text>}
      </g>; })}

      {/* final check */}
      {st > V && !cheat && <text x={64} y={108 + V * 40 + 8} className={`su-final ${finalOK ? 'ok' : 'bad'}`}>final: evaluate f̃(r₁,r₂,r₃) = {fr}  {finalOK ? `= claim ${finalClaim} ✓  — one evaluation, never the 8-term sum` : `≠ ${finalClaim} ✗`}</text>}

      <text x="380" y="292" className="su-foot" textAnchor="middle">
        {on('exp') ? 'Σ over 2ᵛ inputs = C — checking directly is exponential'
          : on('round') ? 'prover sends g₁(x₁); verifier checks g₁(0)+g₁(1) = C'
          : on('fold') ? 'pick random r₁, new claim = g₁(r₁) — one fewer variable'
          : on('final') ? 'v checks + ONE evaluation of f — never the full sum'
          : on('cheat') ? 'a lie makes some g_i wrong → the random challenge exposes it'
          : cheat ? 'cheating prover: g₁(0)+g₁(1) ≠ the lied claim → caught at round 1' : `honest: ${st > V ? 'final evaluation confirms — done' : `round ${st} check passed`}`}
      </text>
    </svg>
  );
}
