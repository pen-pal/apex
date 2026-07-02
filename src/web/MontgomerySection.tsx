// Montgomery multiplication, made visible. Pick a modulus and two numbers and watch a·b mod n computed WITHOUT
// dividing by n: enter Montgomery form, multiply, then REDC reduces using only a multiply, an add, a bit-mask
// (mod R) and a bit-shift (÷R). The final answer matches ordinary (a·b) mod n. Real logic from montgomery.ts.
import { useMemo, useState } from 'react';
import { Montgomery } from './montgomery';

export function MontgomerySection() {
  const [nStr, setNStr] = useState('97');
  const [aStr, setAStr] = useState('55');
  const [bStr, setBStr] = useState('73');

  const parsed = useMemo(() => {
    let n = BigInt(Math.max(3, Math.abs(parseInt(nStr || '97', 10) || 97)));
    if (n % 2n === 0n) n += 1n; // Montgomery needs an odd modulus
    const a = BigInt(Math.abs(parseInt(aStr || '0', 10) || 0)) % n;
    const b = BigInt(Math.abs(parseInt(bStr || '0', 10) || 0)) % n;
    const m = new Montgomery(n);
    const aBar = m.toMont(a), bBar = m.toMont(b);
    const T = aBar * bBar;
    const mm = ((T & m.mask) * m.nPrime) & m.mask;
    const tPre = (T + mm * m.n) >> BigInt(m.bits);
    const tMont = tPre >= m.n ? tPre - m.n : tPre;
    const product = m.fromMont(tMont);
    return { n, a, b, m, aBar, bBar, T, mm, tPre, tMont, product, ref: (a * b) % n, reduced: tPre >= m.n };
  }, [nStr, aStr, bStr]);

  const { n, a, b, m, aBar, bBar, T, mm, tPre, tMont, product, ref, reduced } = parsed;
  const S = (x: bigint) => x.toString();

  return (
    <div className="mgy">
      <p className="mgy-intro">
        RSA and elliptic-curve crypto compute <strong>a·b mod n</strong> for a huge <em>n</em> thousands of times.
        The slow, side-channel-leaky part is the "mod n" — a full <strong>division</strong>. Montgomery's fix:
        work in a different coordinate system where reduction needs only multiplies, adds, and — because
        <strong> R = 2^k</strong> — a bit-mask (mod R) and a shift (÷R), <strong>never a division by n</strong>.
      </p>

      <div className="mgy-inputs">
        <label>n <input className="mgy-in" value={nStr} onChange={(e) => setNStr(e.target.value)} inputMode="numeric" /></label>
        <label>a <input className="mgy-in" value={aStr} onChange={(e) => setAStr(e.target.value)} inputMode="numeric" /></label>
        <label>b <input className="mgy-in" value={bStr} onChange={(e) => setBStr(e.target.value)} inputMode="numeric" /></label>
        <span className="mgy-note">(n forced odd: {S(n)})</span>
      </div>

      <div className="mgy-setup">
        <div className="mgy-row"><span>R = 2^{m.bits}</span><b>{S(m.R)}</b><em>smallest power of two &gt; n</em></div>
        <div className="mgy-row"><span>n′ = −n⁻¹ mod R</span><b>{S(m.nPrime)}</b><em>precomputed once</em></div>
        <div className="mgy-row"><span>R² mod n</span><b>{S(m.R2)}</b><em>to enter Montgomery form</em></div>
      </div>

      <div className="mgy-steps">
        <div className="mgy-step"><span className="mgy-sl">1 · to Montgomery form</span><code>ā = a·R mod n = {S(aBar)}</code><code>b̄ = b·R mod n = {S(bBar)}</code></div>
        <div className="mgy-step"><span className="mgy-sl">2 · multiply</span><code>T = ā · b̄ = {S(T)}</code></div>
        <div className="mgy-step hl"><span className="mgy-sl">3 · REDC(T) — no division by n</span>
          <code>m = (T &amp; {S(m.mask)}) · n′ &amp; {S(m.mask)} = {S(mm)}</code>
          <code>t = (T + m·n) ≫ {m.bits} = {S(tPre)}</code>
          <code>{reduced ? `t ≥ n → t − n = ${S(tMont)}` : `t < n → t = ${S(tMont)}`}</code>
        </div>
        <div className="mgy-step"><span className="mgy-sl">4 · back from Montgomery form</span><code>a·b mod n = REDC(t) = {S(product)}</code></div>
      </div>

      <div className={`mgy-verdict ${product === ref ? 'ok' : 'bad'}`}>
        {S(a)} · {S(b)} mod {S(n)} = <b>{S(product)}</b> — matches ordinary ({S(a)}·{S(b)}) mod {S(n)} = <b>{S(ref)}</b> {product === ref ? '✓' : '✗'} · computed with <strong>masks and shifts, no division by n</strong>
      </div>

      <p className="mgy-foot">
        Why REDC works is a neat piece of algebra: you want to kill the low bits of T so it becomes divisible by R.
        Adding a multiple of n doesn't change the value mod n, and choosing the multiple m = T·n′ mod R makes
        <code> T + m·n ≡ 0 (mod R)</code> exactly — because n·n′ ≡ −1 mod R — so the shift ÷R is a clean integer
        divide, and the result is T·R⁻¹ mod n. Multiply two Montgomery-form numbers and REDC, and the R's line up:
        (aR)(bR)·R⁻¹ = (ab)R, the Montgomery form of the product. The conversions in and out each cost one REDC, but
        a single 2048-bit exponentiation does thousands of multiplies between them, so the setup is free in
        practice — which is why essentially every big-integer and crypto library (OpenSSL, GMP, Go's math/big) keeps
        operands in Montgomery form for the whole exponentiation. The other payoff is security: the operation is the
        <em> same fixed sequence</em> of multiply-mask-shift no matter what the operands are (with a careful,
        always-subtract "constant-time" variant of the final <code>if t ≥ n</code>), so it doesn't branch on secret
        bits — a key defense against timing attacks on RSA and ECDSA. Its cousin <strong>Barrett reduction</strong>
        precomputes an estimate of 1/n instead and is preferred when you reduce many independent products rather than
        one long exponentiation. (Montgomery, Math. Comp. 1985.)
      </p>
    </div>
  );
}
