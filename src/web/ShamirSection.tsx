// Shamir Secret Sharing, made visible. The dealer hides a secret in the constant
// term of a degree-(k−1) polynomial and hands out points on it. Collect any k points
// and Lagrange interpolation rebuilds f(0) = the secret; collect fewer and it stays
// perfectly hidden. Click shares to gather them and watch the vault unlock exactly at
// the threshold. Real GF(257) arithmetic (shamir.ts, tested).
import { useMemo, useState } from 'react';
import { split, reconstruct } from './shamir';

export function ShamirSection() {
  const [secret, setSecret] = useState(123);
  const [n, setN] = useState(5);
  const [k, setK] = useState(3);
  const kk = Math.min(k, n);
  const [seed, setSeed] = useState(0);
  const [picked, setPicked] = useState<Set<number>>(new Set());

  const coeffs = useMemo(
    () => Array.from({ length: kk - 1 }, () => 1 + Math.floor(Math.random() * 255)),
    [secret, n, kk, seed],
  );
  const shares = split(secret, n, kk, coeffs);

  const reset = (fn: () => void) => { fn(); setPicked(new Set()); };
  const toggle = (x: number) => setPicked((p) => { const s = new Set(p); s.has(x) ? s.delete(x) : s.add(x); return s; });

  const collected = shares.filter((s) => picked.has(s.x));
  const enough = collected.length >= kk;
  const recovered = enough ? reconstruct(collected) : null;

  const polyTerms = [`${secret}`, ...coeffs.map((c, i) => `${c}·x${i + 1 > 1 ? `^${i + 1}` : ''}`)];

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Shamir Secret Sharing — any k of n unlock it</h2></div>
        <p className="jsec-sub">
          The dealer builds a random degree-{kk - 1} polynomial whose constant term <em>is</em> the secret, then hands out points on
          it. Any <strong>{kk}</strong> points pin the polynomial down exactly (so they recover f(0)), but <strong>{kk - 1}</strong>{' '}
          leave every value equally possible. Gather shares below and watch the vault open only at the threshold.
        </p>

        <div className="sh-controls">
          <label>secret (0–255): <strong>{secret}</strong><input type="range" min={0} max={255} value={secret} onChange={(e) => reset(() => setSecret(Number(e.target.value)))} /></label>
          <label>shares n = {n}<input type="range" min={2} max={8} value={n} onChange={(e) => reset(() => { const v = Number(e.target.value); setN(v); if (k > v) setK(v); })} /></label>
          <label>threshold k = {kk}<input type="range" min={2} max={n} value={kk} onChange={(e) => reset(() => setK(Number(e.target.value)))} /></label>
          <button className="sh-reroll" onClick={() => reset(() => setSeed((s) => s + 1))}>↻ new polynomial</button>
        </div>

        <div className="sh-poly">f(x) = {polyTerms.join(' + ')} <span className="sh-mod">(mod 257)</span> &nbsp;·&nbsp; <span className="sh-hidden">secret = f(0)</span></div>

        <div className="sh-step">click to gather shares ({collected.length} / {kk} needed)</div>
        <div className="sh-shares">
          {shares.map((s) => (
            <button key={s.x} className={`sh-share ${picked.has(s.x) ? 'on' : ''}`} onClick={() => toggle(s.x)}>
              <span className="sh-s-x">share {s.x}</span>
              <span className="sh-s-pt">({s.x}, {s.y})</span>
            </button>
          ))}
        </div>

        <div className={`sh-vault ${enough ? 'open' : 'locked'}`}>
          {enough
            ? <>🔓 <strong>Reconstructed.</strong> Lagrange interpolation of {collected.length} points gives f(0) = <strong>{recovered}</strong>{recovered === secret ? ' ✓ — the secret.' : ''}</>
            : <>🔒 <strong>Locked.</strong> {collected.length} of {kk} shares — not enough. With {kk - 1} or fewer points, all 256 secrets remain equally likely. No partial information leaks.</>}
        </div>

        <p className="sh-note">
          This is threshold cryptography: split a master key, a crypto-wallet seed, or a root CA key across {n} custodians so no
          one person holds it, yet any {kk} together can recover it — and losing up to {n - kk} shares is survivable. It’s
          information-theoretically secure (no computational assumption), unlike encrypting the secret under one key.
        </p>
      </section>
    </div>
  );
}
