// Threshold signatures, made visible. A signing key is split so no one party holds it; pick which
// parties join the coalition and watch them produce ONE signature that verifies under the single group
// public key — as long as at least t of them sign. Drop below t and the same machinery produces an
// invalid signature, because t−1 shares interpolate to the wrong key. Real EC math from threshold.ts.
import { useMemo, useState } from 'react';
import { deal, sign, verify, type Share } from './threshold';

const SECRET = 7;
const COEFFS = [3, 5]; // fixed polynomial coefficients (degree t−1) so the demo is deterministic
const nonceFor = (id: number) => ((id * 5 + 2) % 19) || 1; // deterministic non-zero nonce per party

export function ThresholdSection() {
  const [n, setN] = useState(3);
  const [t, setT] = useState(2);
  const [msg, setMsg] = useState('transfer 100');
  const [signers, setSigners] = useState<Set<number>>(new Set([1, 2]));

  const dealt = useMemo(() => deal(SECRET, t, n, COEFFS), [t, n]);
  const coalition: Share[] = dealt.shares.filter((s) => signers.has(s.id));
  const enough = coalition.length >= t;
  const sig = useMemo(() => (coalition.length ? sign(coalition, coalition.map((s) => nonceFor(s.id)), dealt.pub, msg) : null), [coalition, dealt, msg]);
  const ok = sig ? verify(sig, dealt.pub, msg) : false;

  const toggle = (id: number) => setSigners((s) => { const x = new Set(s); x.has(id) ? x.delete(id) : x.add(id); return x; });
  const setNclamp = (v: number) => { setN(v); setT((tt) => Math.min(tt, v)); setSigners(new Set([1, 2].filter((i) => i <= v))); };

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Threshold signatures — a key no one holds</h2></div>
        <p className="jsec-sub">
          A <strong>t-of-n</strong> threshold signature lets any <strong>t</strong> of <strong>n</strong> parties jointly produce <em>one
          ordinary signature</em> — yet no single party (and no group of fewer than t) ever holds or can reconstruct the signing key. The
          secret is <strong>Shamir-shared</strong>; signers combine <strong>partial signatures</strong> via Lagrange interpolation so the math
          cancels out to the group key without ever assembling it. It’s how exchange custody, validator keys, and FROST/MuSig wallets work.
        </p>

        <div className="thr-ctrls">
          <label>parties n <input type="range" min={3} max={5} value={n} onChange={(e) => setNclamp(+e.target.value)} /><b>{n}</b></label>
          <label>threshold t <input type="range" min={2} max={n} value={t} onChange={(e) => setT(+e.target.value)} /><b>{t}</b></label>
          <label className="thr-msg">message <input value={msg} onChange={(e) => setMsg(e.target.value)} spellCheck={false} /></label>
        </div>

        <div className="thr-key">group public key <b>Y = secret·G = ({dealt.pub?.x}, {dealt.pub?.y})</b> — this is all the verifier ever sees</div>

        <div className="thr-parties">
          {dealt.shares.map((s) => (
            <button key={s.id} className={`thr-party ${signers.has(s.id) ? 'on' : ''}`} onClick={() => toggle(s.id)}>
              <span className="thr-pid">party {s.id}</span>
              <span className="thr-share">share s{s.id} = {s.value}</span>
              <span className="thr-role">{signers.has(s.id) ? '✍ signing' : 'idle'}</span>
            </button>
          ))}
        </div>

        <div className={`thr-result ${coalition.length === 0 ? 'idle' : ok ? 'ok' : 'bad'}`}>
          {coalition.length === 0 ? <span>select some parties to form a signing coalition.</span> : (
            <>
              <div className="thr-coalition">coalition {`{${coalition.map((s) => s.id).join(', ')}}`} ({coalition.length} of {t} needed)</div>
              {sig && <div className="thr-sig">combined signature: R = ({sig.R?.x}, {sig.R?.y}), z = {sig.z}, c = {sig.c}</div>}
              <div className="thr-verdict">
                {ok
                  ? `✓ VALID — z·G = R + c·Y verifies under the group key. The ${coalition.length} partial signatures combined to a real signature; the secret key was never assembled.`
                  : enough
                    ? '✗ invalid (unexpected).'
                    : `✗ INVALID — only ${coalition.length} of ${t} parties signed. Their Lagrange interpolation reconstructs the WRONG key, so z·G ≠ R + c·Y. t−1 shares reveal nothing.`}
              </div>
            </>
          )}
        </div>

        <p className="thr-foot">
          The cancellation is the whole trick: each party computes z_i = d_i + c·λ_i·s_i with its own share and Lagrange weight, and because
          <strong> Σ λ_i·s_i = f(0) = x</strong> (Lagrange at 0), the sum is z = Σd_i + c·x — a normal Schnorr signature for the group key,
          assembled with the private key never existing in one place. Real schemes (FROST) add a careful two-round nonce protocol to stay secure
          against concurrent signing, and use a 256-bit hash; here the curve is the toy order-19 one so the numbers are legible. Compare with
          <strong> Shamir secret sharing</strong> (which <em>does</em> reconstruct the secret to use it) — threshold signing never does.
        </p>
      </section>
    </div>
  );
}
