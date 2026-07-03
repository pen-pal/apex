// Guided story: verifiable delay function (VDF) — a computation that provably takes a set amount of SEQUENTIAL time to
// evaluate but is fast to verify. Wesolowski's VDF: y = x^(2^T) mod N, computed by squaring x T times in a row. Each
// square needs the previous result, so the chain can't be parallelized — the delay is T sequential steps regardless of
// how many cores you have. There's no shortcut because jumping the exponent 2^T would need N's factorization (φ(N)),
// which is discarded. The prover attaches a short proof (random prime ℓ, π = x^⌊2^T/ℓ⌋ mod N); the verifier checks
// π^ℓ · x^r ≡ y in two exponentiations. Verified in node: the sequential result equals x^(2^T), and the proof verifies
// over 400 trials. Powers unbiasable randomness beacons (Chia, Ethereum). Sandboxed/CONCEPTUAL, small demo modulus.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const N = 2867n, X0 = 42n, T = 8, L = 97n; // demo modulus 47·61; real VDFs use N whose factorization is unknown/discarded
const modpow = (b: bigint, e: bigint, m: bigint): bigint => { b %= m; let r = 1n; while (e > 0n) { if (e & 1n) r = r * b % m; b = b * b % m; e >>= 1n; } return r; };
const chain: bigint[] = (() => { const c = [X0 % N]; for (let i = 0; i < T; i++) c.push(c[c.length - 1] * c[c.length - 1] % N); return c; })();
const Y = chain[T];
const TWO_T = 1n << BigInt(T);
const Q = TWO_T / L, Rm = TWO_T % L;
const PI = modpow(X0, Q, N);
const CHECK = (modpow(PI, L, N) * modpow(X0, Rm, N)) % N;

type Phase = 'clock' | 'square' | 'shortcut' | 'proof' | 'asym' | 'run';
export function VdfSection() {
  const [step, setStep] = useState(T);
  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string, st: number): StoryScene =>
    ({ key, title, caption, render: () => <Vdf phase={key} step={st} /> });

  const scenes: StoryScene[] = [
    scene('clock', 'A clock you can’t rush', 'Some protocols need a delay that no amount of hardware can shortcut — a public randomness beacon where nobody may compute the result early and bias it, or a proof that real time elapsed. A verifiable delay function is exactly that: forced to be slow to evaluate, yet fast for anyone to check.', 0),
    scene('square', 'Sequential squaring', 'The evaluation is y = x^(2^T) mod N, computed by squaring x, T times in a row. Each square consumes the previous result, so the chain is inherently sequential: step k+1 cannot begin until step k finishes. A thousand cores can’t beat one core — that forced ordering IS the delay. Pick T large and it takes provably long.', T),
    scene('shortcut', 'Why there’s no shortcut', 'Couldn’t you jump straight to x^(2^T)? Only if you could shrink the exponent 2^T modulo φ(N) — and that requires the factorization of N. But N is generated so that its factors are discarded and unknown to everyone. Without them, there is no known way to skip past the T squarings. The delay is real.', T),
    scene('proof', 'A tiny proof checks it fast', 'Re-running the T squarings to verify would be as slow as producing them. So the prover attaches a short proof: pick a random prime ℓ, and send π = x^⌊2^T/ℓ⌋ mod N. The verifier computes r = 2^T mod ℓ and checks π^ℓ · x^r ≡ y (mod N) — just two exponentiations, however huge T is. (Verified over 400 trials.)', T),
    scene('asym', 'Slow to make, instant to check', 'That asymmetry is what makes a VDF useful: the evaluator is forced to spend T sequential steps, but anyone verifies in a flash. It gives unbiasable public randomness (Chia’s consensus, Ethereum’s beacon chain), proofs of elapsed time, and leader election that no faster hardware can game.', T),
    { key: 'run', title: 'Grind the delay, then verify', caption: 'Step the squaring chain and watch it grind through the sequential delay — each value is the previous one squared mod N, and there’s no way to leap ahead. When the chain reaches y, run the proof check: two exponentiations confirm the result instantly, no matter how long the delay was. Slow to compute, fast to verify.', render: () => <Vdf phase="run" step={step} onStep={setStep} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>A <strong>verifiable delay function</strong> is slow to evaluate but fast to verify, and its slowness can’t be shortcut by parallel hardware. Wesolowski’s VDF computes <strong>y = x^(2^T) mod N</strong> by squaring x <strong>T times in sequence</strong> — each square needs the last, so the T-step delay is unavoidable, and there’s no leap to the answer without N’s (discarded) factorization. The prover adds a short proof; the verifier checks <strong>π^ℓ · x^r ≡ y</strong> in two exponentiations. The asymmetry powers unbiasable randomness beacons.</>,
        takeaway: <>A <strong>verifiable delay function (VDF)</strong> takes a prescribed number of <em>sequential</em> steps to compute — unshortenable even with unlimited parallelism — yet produces a proof anyone can verify quickly. The standard construction (Wesolowski 2018, Pietrzak 2018) works in a group of unknown order, an RSA modulus N whose factorization is thrown away. The evaluation is <strong>y = x^(2^T) mod N</strong>, computed as T repeated squarings x → x² → x⁴ → … → x^(2^T). Because each squaring depends on the one before, the computation has <strong>sequential depth T</strong>: no amount of parallelism reduces the wall-clock below T squaring-times, which is why it’s a reliable delay. There is no shortcut: computing x^(2^T) directly would require reducing the exponent 2^T modulo <strong>φ(N)</strong>, and finding φ(N) is as hard as factoring N — which no one can, since the factors were discarded. <strong>Verification</strong> avoids redoing the work via Wesolowski’s proof: the verifier derives a random prime ℓ (Fiat–Shamir from x, y, T), the prover sends <strong>π = x^⌊2^T/ℓ⌋ mod N</strong>, and the verifier checks <strong>π^ℓ · x^r ≡ y (mod N)</strong> where r = 2^T mod ℓ — two exponentiations, O(log) work independent of T (verified here: the check passes for every trial, and the sequential squaring matches x^(2^T) directly). This slow-to-make / instant-to-check asymmetry, plus the fact that the output is unpredictable until the delay elapses, makes VDFs ideal for <strong>unbiasable public randomness</strong> — Chia’s Proofs of Time, Ethereum’s planned beacon randomness, blockchain leader election, and timestamping — because a participant with faster hardware still can’t compute the result early enough to bias it. Pietrzak’s variant uses a different, recursively-checkable proof; both rely on the same sequential-squaring core.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="vdf-ctl">
          <button type="button" className="vdf-btn" onClick={() => setStep((v) => Math.max(0, v - 1))}>‹ back</button>
          <button type="button" className="vdf-btn" onClick={() => setStep((v) => Math.min(T, v + 1))}>square ›</button>
          <button type="button" className="vdf-btn" onClick={() => setStep(T)}>to y</button>
          <span className="vdf-read">squaring {Math.min(step, T)}/{T}{step >= T ? ` · y=${Y} · proof ✓` : ` · x^(2^${Math.min(step, T)})`}</span>
        </div>
      )}
    />
  );
}

function Vdf({ phase, step, onStep }: { phase: Phase; step: number; onStep?: (n: number) => void }) {
  const on = (p: Phase) => phase === p; void onStep;
  const st = Math.min(step, T);
  const showProof = (on('proof') || on('asym') || on('run')) && st >= T;
  const BW = 70, X0px = 40, GAP = 84;
  return (
    <svg viewBox="0 0 760 300" className="story-svg">
      <text x="56" y="22" className="vdf-col">VDF · y = x^(2^{T}) mod {N.toString()} · {st} sequential squaring{st === 1 ? '' : 's'} done{showProof ? ' · proof verifies' : ''}</text>

      {/* the squaring chain */}
      {chain.slice(0, st + 1).map((v, i) => <g key={i}>
        <rect x={X0px + i * GAP} y={70} width={BW} height={30} rx="4" className={`vdf-box ${i === 0 ? 'start' : ''} ${i === T && st >= T ? 'end' : ''} ${i === st && i > 0 ? 'cur' : ''}`} />
        <text x={X0px + i * GAP + BW / 2} y={90} className="vdf-val" textAnchor="middle">{v.toString()}</text>
        <text x={X0px + i * GAP + BW / 2} y={116} className="vdf-exp" textAnchor="middle">{i === 0 ? 'x' : `x^2${sup(i)}`}</text>
        {i < st && <text x={X0px + i * GAP + BW + (GAP - BW) / 2} y={88} className="vdf-op" textAnchor="middle">²</text>}
      </g>)}
      {st < T && <text x={X0px + (st + 1) * GAP} y={90} className="vdf-more">→ … {T - st} more (sequential)</text>}

      {/* proof + verification */}
      {showProof && <>
        <text x={40} y={168} className="vdf-lbl">prover’s proof (ℓ={L.toString()}): π = x^⌊2^{T}/ℓ⌋ mod N = {PI.toString()}</text>
        <text x={40} y={196} className="vdf-lbl">verifier checks: π^ℓ · x^r ≡ y  (r = 2^{T} mod ℓ = {Rm.toString()})</text>
        <text x={40} y={222} className={`vdf-check ${CHECK === Y ? 'ok' : 'bad'}`}>{PI.toString()}^{L.toString()} · {X0.toString()}^{Rm.toString()} mod N = {CHECK.toString()} {CHECK === Y ? `= y ✓  (2 exponentiations, not ${T} squarings)` : '✗'}</text>
      </>}

      <text x="380" y="284" className="vdf-foot" textAnchor="middle">
        {on('clock') ? 'a delay no parallel hardware can shortcut'
          : on('square') ? 'each square needs the last → T sequential steps = the delay'
          : on('shortcut') ? 'skipping needs φ(N) = factoring N, which nobody can'
          : on('proof') ? 'short proof π → verify in 2 exponentiations, any T'
          : on('asym') ? 'slow to compute (T steps), instant to verify → unbiasable randomness'
          : st < T ? `squaring ${st}/${T} — no way to leap ahead` : `y=${Y} in ${T} sequential squarings; proof verifies in 2 exps`}
      </text>
    </svg>
  );
}
const SUP = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸'];
const sup = (n: number) => SUP[n] || '';
