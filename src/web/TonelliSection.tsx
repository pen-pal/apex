// Guided story: Tonelli–Shanks — computing a modular square root, x² ≡ n (mod p). Over the reals √n is easy; mod a prime
// it's structured: exactly half the nonzero residues are quadratic residues (perfect squares) with two roots each, the
// rest have none. Euler's criterion n^((p-1)/2) ≡ 1 tells you if a root exists (the Legendre symbol). If p ≡ 3 (mod 4)
// the root is one exponentiation x = n^((p+1)/4); otherwise Tonelli–Shanks writes p-1 = Q·2^S, finds a non-residue, and
// iteratively drives a candidate to the true root in O(log²p). Used to recover y from x on an elliptic curve (point
// decompression), in Rabin encryption, and QR testing. Verified in node: x²≡n for every QR and null for every non-residue
// across 16 primes (916 roots), both branches, both roots x and p−x, and exactly (p-1)/2 residues. Sandboxed/CONCEPTUAL.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const P = 37n;
const mp = (b: bigint, e: bigint, m: bigint): bigint => { b %= m; let r = 1n; while (e > 0n) { if (e & 1n) r = r * b % m; b = b * b % m; e >>= 1n; } return r; };
const legendre = (n: bigint, p: bigint) => mp(n, (p - 1n) / 2n, p); // 1 = QR, p-1 = non-residue
function tonelli(n: bigint, p: bigint): bigint | null {
  n %= p; if (n === 0n) return 0n; if (legendre(n, p) !== 1n) return null;
  if (p % 4n === 3n) return mp(n, (p + 1n) / 4n, p);
  let Q = p - 1n, S = 0n; while (Q % 2n === 0n) { Q /= 2n; S++; }
  let z = 2n; while (legendre(z, p) !== p - 1n) z++;
  let M = S, c = mp(z, Q, p), t = mp(n, Q, p), R = mp(n, (Q + 1n) / 2n, p);
  while (t !== 1n) { let i = 0n, tt = t; while (tt !== 1n) { tt = tt * tt % p; i++; } const b = mp(c, 1n << (M - i - 1n), p); M = i; c = b * b % p; t = t * c % p; R = R * b % p; }
  return R;
}
const isQR = (n: number) => legendre(BigInt(n), P) === 1n;
const rootsOf = (n: number): [number, number] | null => { const r = tonelli(BigInt(n), P); if (r === null) return null; const x = Number(r); return [Math.min(x, Number(P) - x), Math.max(x, Number(P) - x)]; };

type Phase = 'modular' | 'euler' | 'easy' | 'general' | 'uses' | 'run';
export function TonelliSection() {
  const [n, setN] = useState(9);
  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <Grid phase={key} n={9} /> });

  const scenes: StoryScene[] = [
    scene('modular', 'Square roots, but modular', 'Over the reals √n is routine. Modulo a prime p it’s a different problem: solve x² ≡ n (mod p). Exactly half the nonzero residues are perfect squares — quadratic residues — and each has two roots (x and p−x); the other half have no square root at all. First question about any n: is it even a square here?'),
    scene('euler', 'Euler’s criterion answers existence', 'One modular exponentiation decides it: n is a quadratic residue iff n^((p−1)/2) ≡ 1 (mod p); if the result is p−1 (i.e. −1), n has no root. That value is the Legendre symbol (n|p) = ±1. So before hunting for a root you can cheaply confirm one exists.'),
    scene('easy', 'The easy case: p ≡ 3 (mod 4)', 'When the prime satisfies p ≡ 3 (mod 4), the root is a single exponentiation: x = n^((p+1)/4) mod p. Check: x² = n^((p+1)/2) = n · n^((p−1)/2) = n · 1 = n for a residue. Many cryptographic primes are chosen ≡ 3 (mod 4) precisely so square roots (and curve point decompression) are this cheap.'),
    scene('general', 'The general case: Tonelli–Shanks', 'When p ≡ 1 (mod 4) it’s harder. Write p−1 = Q·2^S with Q odd, and find any non-residue z. Start from a candidate R = n^((Q+1)/2) that’s off by a power-of-two-order factor, then iteratively square to find that order and multiply in the right power of z^Q to cancel it — driving the error to 1 and R to a true root, in O(log²p). (Verified: R² ≡ n across many primes.)'),
    scene('uses', 'Where modular roots are needed', 'The big one: elliptic-curve point decompression. A compressed public key stores only x and one sign bit; recovering the point needs y = √(x³+ax+b) mod p — a modular square root. Also the Rabin cryptosystem (decryption is four square roots) and primality/residue tests. The two roots x and p−x are both valid; the sign bit selects which.'),
    { key: 'run', title: 'Is it a square? Find its roots', caption: 'Click any residue mod 37. Euler’s criterion says instantly whether it’s a quadratic residue; if it is, its two square roots x and p−x light up and each squares back to n. Non-residues have no root at all — half the numbers, with a clean even/odd-looking split that is anything but random.', render: () => <Grid phase="run" n={n} onN={setN} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <><strong>Tonelli–Shanks</strong> computes a <strong>modular square root</strong>: given a prime p and n, find x with <strong>x² ≡ n (mod p)</strong>. Only half the residues are squares (<strong>quadratic residues</strong>); <strong>Euler’s criterion</strong> <code>n^((p−1)/2) ≡ 1</code> tells you if n is one. If <strong>p ≡ 3 (mod 4)</strong> the root is one exponentiation <code>n^((p+1)/4)</code>; otherwise Tonelli–Shanks writes <code>p−1 = Q·2^S</code>, grabs a non-residue, and iterates to the root. It’s how you recover <strong>y from x</strong> on an elliptic curve (point decompression).</>,
        takeaway: <><strong>Tonelli–Shanks</strong> solves <strong>x² ≡ n (mod p)</strong> for an odd prime p. Background: the nonzero residues split evenly into <strong>quadratic residues</strong> (squares, each with exactly two roots x and p−x) and non-residues, and <strong>Euler’s criterion</strong> says n is a residue iff <code>n^((p−1)/2) ≡ 1 (mod p)</code> — that value is the <strong>Legendre symbol</strong> (n|p) ∈ {'{'}+1, −1{'}'}. Finding the root: (1) if <strong>p ≡ 3 (mod 4)</strong>, then <code>x = n^((p+1)/4) mod p</code> works directly, because x² = n^((p+1)/2) = n·n^((p−1)/2) = n; this one-shot case is why many crypto primes are chosen ≡ 3 (mod 4). (2) The general algorithm factors <strong>p − 1 = Q·2^S</strong> (Q odd), finds any quadratic <strong>non-residue z</strong> by trial (Euler-testing candidates), and initializes M = S, c = z^Q, t = n^Q, R = n^((Q+1)/2). The invariant is <code>R² = n·t</code> with t a 2^(M−1)-th root of unity; each round finds the least i with <code>t^(2^i) = 1</code>, forms b = c^(2^(M−i−1)), and updates R ← R·b, t ← t·b², c ← b², halving t’s order until t = 1 and R² = n. It runs in <strong>O(log²p)</strong> modular multiplications (plus the non-residue search, ~2 tries on average). Both roots are x and <strong>p − x</strong>. Why it matters: the headline use is <strong>elliptic-curve point decompression</strong> — a compressed public key or signature stores only the x-coordinate and a single parity/sign bit, and the receiver reconstructs y = √(x³+ax+b) mod p with a modular square root, halving key/signature size (used in Bitcoin, TLS, etc.). It also underlies the <strong>Rabin cryptosystem</strong> (decryption computes four roots via CRT over p and q), <strong>quadratic sieve</strong> factoring, and residue testing. Related tools: the <strong>Cipolla</strong> algorithm (works in a quadratic extension field, competitive when S is large) and computing roots mod a composite by CRT once you know the factorization — which is exactly why square roots mod a composite are as hard as factoring.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="tsh-ctl">
          <span className="tsh-lab">n =</span>
          <button type="button" className="tsh-btn" onClick={() => setN((v) => Math.max(1, v - 1))}>−</button>
          <b className="tsh-v">{n}</b>
          <button type="button" className="tsh-btn" onClick={() => setN((v) => Math.min(Number(P) - 1, v + 1))}>+</button>
          <span className="tsh-read">{isQR(n) ? `quadratic residue → roots ${rootsOf(n)![0]} & ${rootsOf(n)![1]} (both² ≡ ${n})` : `non-residue → no square root mod ${P}`}</span>
        </div>
      )}
    />
  );
}

function Grid({ phase, n, onN }: { phase: Phase; n: number; onN?: (v: number) => void }) {
  const on = (p: Phase) => phase === p; void onN;
  const roots = rootsOf(n); const qr = isQR(n); const euler = Number(legendre(BigInt(n), P));
  const COLS = 12, CW = 56, CH = 34, OX = 60, OY = 44;
  return (
    <svg viewBox="0 0 760 300" className="story-svg">
      <text x="56" y="20" className="tsh-col">Modular √ · x² ≡ n (mod {P.toString()}) · {(Number(P) - 1) / 2} of {Number(P) - 1} residues are squares · Euler: n^({(Number(P) - 1) / 2}) ≡ ±1</text>

      {/* residue grid 1..p-1, coloured QR vs non-QR; selected n + its roots highlighted */}
      {Array.from({ length: Number(P) - 1 }, (_, i) => i + 1).map((m) => {
        const col = (m - 1) % COLS, row = ((m - 1) / COLS) | 0; const x = OX + col * CW, y = OY + row * CH;
        const isRoot = roots && (m === roots[0] || m === roots[1]); const isSel = m === n;
        const cls = isSel ? 'sel' : isRoot ? 'root' : isQR(m) ? 'qr' : 'nqr';
        return <g key={m}>
          <rect x={x} y={y} width={CW - 4} height={CH - 4} rx="3" className={`tsh-cell ${cls}`} />
          <text x={x + (CW - 4) / 2} y={y + 21} className="tsh-ct" textAnchor="middle">{m}</text>
        </g>;
      })}

      {/* readout */}
      <text x={OX} y={OY + 3 * CH + 22} className="tsh-out">
        n = {n}: n^{(Number(P) - 1) / 2} mod {P.toString()} = {euler} → {qr ? 'quadratic residue ✓' : 'non-residue (no root)'}
      </text>
      {roots && <text x={OX} y={OY + 3 * CH + 42} className="tsh-out">roots: {roots[0]}² = {roots[0] * roots[0] % Number(P)} and {roots[1]}² = {roots[1] * roots[1] % Number(P)} ≡ {n} (mod {P.toString()}) · the two roots are x and p−x</text>}

      <text x="380" y="294" className="tsh-foot" textAnchor="middle">
        {on('modular') ? 'half the residues are squares (two roots each); half have none'
          : on('euler') ? 'Euler: n^((p−1)/2) ≡ 1 ⇒ residue; ≡ −1 ⇒ no root'
          : on('easy') ? 'p ≡ 3 (mod 4): x = n^((p+1)/4), a single exponentiation'
          : on('general') ? 'p ≡ 1 (mod 4): Tonelli–Shanks drives a candidate to the root'
          : on('uses') ? 'recover y from x on an elliptic curve: y = √(x³+ax+b) mod p'
          : qr ? `${n} is a square → roots ${roots![0]} and ${roots![1]}` : `${n} is a non-residue → no square root mod ${P}`}
      </text>
    </svg>
  );
}
