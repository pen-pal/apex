// RSA made visible — pick two primes and watch the public/private keypair fall
// out, encrypt a number the public way and undo it the private way, sign and
// verify, and see that the whole secret rests on n being hard to factor. Real
// BigInt arithmetic (rsa.ts); a teaching keypair, never a real private key.
import { useMemo, useState } from 'react';
import { rsaKeygen, rsaDecrypt, rsaSign, rsaVerify, modpowTrace, factor, gcd, SMALL_PRIMES } from './rsa';

export function RsaSection() {
  const [p, setP] = useState(61n);
  const [q, setQ] = useState(53n);
  const [e, setE] = useState(17n);
  const [m, setM] = useState(65n);
  const [forge, setForge] = useState(false);

  const key = useMemo(() => {
    try {
      if (p === q) return { err: 'p and q must be different primes' as const };
      const k = rsaKeygen(p, q, e);
      return { k };
    } catch (err) {
      return { err: (err as Error).message };
    }
  }, [p, q, e]);

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>① Key generation — a public lock, a private key</h2></div>
        <p className="jsec-sub">
          RSA’s security is a <strong>trapdoor</strong>: multiplying two primes is easy, factoring the product back is not.
          Pick the primes and the whole keypair follows. Everyone gets the public <code>(n, e)</code>; only you hold <code>d</code>.
        </p>
        <div className="rsa-pick">
          <label>p = <select value={String(p)} onChange={(ev) => setP(BigInt(ev.target.value))}>
            {SMALL_PRIMES.map((x) => <option key={String(x)} value={String(x)}>{String(x)}</option>)}</select></label>
          <label>q = <select value={String(q)} onChange={(ev) => setQ(BigInt(ev.target.value))}>
            {SMALL_PRIMES.map((x) => <option key={String(x)} value={String(x)}>{String(x)}</option>)}</select></label>
          <label>e = <input type="number" value={String(e)} onChange={(ev) => setE(BigInt(Math.max(2, Number(ev.target.value) || 2)))} /></label>
        </div>

        {'err' in key ? (
          <div className="rsa-err">⚠ {key.err}{e !== 17n && <> — try e = 65537 or a small prime coprime with φ.</>}</div>
        ) : (
          <Keypair p={p} q={q} k={key.k} m={m} setM={setM} forge={forge} setForge={setForge} />
        )}
      </section>
    </div>
  );
}

function Keypair({ p, q, k, m, setM, forge, setForge }: {
  p: bigint; q: bigint; k: ReturnType<typeof rsaKeygen>; m: bigint; setM: (n: bigint) => void; forge: boolean; setForge: (b: boolean) => void;
}) {
  const mc = ((m % k.n) + k.n) % k.n; // keep message in [0, n)
  const encTrace = useMemo(() => modpowTrace(mc, k.e, k.n), [mc, k.e, k.n]);
  const c = encTrace.value;
  const back = rsaDecrypt(c, k);

  const h = mc; // stand-in: a message hash < n
  const sig = rsaSign(h, k);
  const shown = forge ? sig + 1n : sig;
  const recovered = rsaVerify(shown, k);
  const sigOk = recovered === h;

  const fac = factor(k.n);

  return (
    <>
      <div className="rsa-keys">
        <div className="rsa-step">n = p · q = {String(p)} · {String(q)} = <b>{String(k.n)}</b></div>
        <div className="rsa-step">φ(n) = (p−1)(q−1) = {String(p - 1n)} · {String(q - 1n)} = <b className="priv">{String(k.phi)}</b></div>
        <div className="rsa-step">d = e⁻¹ mod φ(n) = {String(k.e)}⁻¹ mod {String(k.phi)} = <b className="priv">{String(k.d)}</b></div>
        <div className="rsa-keypair">
          <div className="rsa-pub">🔓 public key (n, e) = ({String(k.n)}, {String(k.e)})</div>
          <div className="rsa-prv">🔑 private key d = {String(k.d)} <span>(keep secret)</span></div>
        </div>
        <div className="rsa-trap">
          Break it by factoring: <code>{String(k.n)} = {fac ? `${fac[0]} · ${fac[1]}` : '?'}</code> → φ → d. Trivial here; for a
          real 2048-bit n there is no known feasible factorisation. <span className="rsa-coprime">gcd(e, φ) = {String(gcd(k.e, k.phi))}</span>
        </div>
      </div>

      <div className="jsec-head" style={{ marginTop: 20 }}><h2>② Encrypt (public) → decrypt (private)</h2></div>
      <p className="jsec-sub">Encryption is c = m<sup>e</sup> mod n by square-and-multiply — anyone with the public key can do it; only d undoes it.</p>
      <label className="rsa-mfield">message m (0…{String(k.n - 1n)}) =
        <input type="number" value={String(m)} onChange={(ev) => setM(BigInt(Number(ev.target.value) || 0))} /></label>
      <div className="rsa-flow">
        <code className="rsa-pub">m = {String(mc)}</code>
        <span className="rsa-arrow">— m<sup>{String(k.e)}</sup> mod {String(k.n)} →</span>
        <code className="rsa-ct">c = {String(c)}</code>
        <span className="rsa-arrow">— c<sup>{String(k.d)}</sup> mod {String(k.n)} →</span>
        <code className="rsa-pub">{String(back)}</code>
        <span className={back === mc ? 'rsa-ok' : 'rsa-bad'}>{back === mc ? '✓ recovered' : '✗'}</span>
      </div>
      <details className="rsa-trace">
        <summary>square-and-multiply: {String(mc)}<sup>{String(k.e)}</sup> mod {String(k.n)} ({encTrace.steps.length} bits of e)</summary>
        <table>
          <thead><tr><th>bit of e</th><th>square</th><th>× m?</th><th>value</th></tr></thead>
          <tbody>
            {encTrace.steps.map((s, i) => (
              <tr key={i}><td>{s.bit}</td><td>{String(s.afterSquare)}</td><td>{s.multiplied ? '× m' : '—'}</td><td>{String(s.value)}</td></tr>
            ))}
          </tbody>
        </table>
      </details>

      <div className="jsec-head" style={{ marginTop: 20 }}><h2>③ Sign (private) → verify (public)</h2></div>
      <p className="jsec-sub">A signature runs RSA the other way: only d can produce s = h<sup>d</sup>, and anyone can check h = s<sup>e</sup> mod n. Forge the signature to watch verification fail.</p>
      <div className="rsa-flow">
        <code className="priv">h = {String(h)}</code>
        <span className="rsa-arrow">— sign h<sup>{String(k.d)}</sup> →</span>
        <code className="rsa-ct">s = {String(shown)}</code>
        <span className="rsa-arrow">— verify s<sup>{String(k.e)}</sup> →</span>
        <code className="rsa-pub">{String(recovered)}</code>
      </div>
      <label className="rsa-forge"><input type="checkbox" checked={forge} onChange={(ev) => setForge(ev.target.checked)} /> forge the signature (s + 1)</label>
      <div className={`rsa-verdict ${sigOk ? 'good' : 'bad'}`}>
        {sigOk ? <>✅ <strong>signature valid</strong> — recovered h matches.</> : <>🚫 <strong>invalid signature</strong> — recovered {String(recovered)} ≠ {String(h)}. A forgery needs d.</>}
      </div>
    </>
  );
}
