// The NTT, made visible. Edit two polynomials in Z₁₇[x]/(x⁸+1); watch each get transformed to the
// evaluation domain, multiplied POINTWISE (the expensive O(n²) convolution collapses to n cheap
// products), then transformed back — and confirm the result matches the schoolbook negacyclic product
// exactly. This is the engine inside Kyber/Dilithium. Real arithmetic from ntt.ts.
import { useMemo, useState } from 'react';
import { ntt, pointwise, intt, negamul, TOY } from './ntt';

const { q, psi, n } = TOY;
const PRESETS: Record<string, [number[], number[]]> = {
  'small': [[1, 2, 3, 4, 0, 0, 0, 0], [5, 6, 7, 0, 0, 0, 0, 0]],
  'times x': [[1, 2, 3, 4, 5, 6, 7, 8], [0, 1, 0, 0, 0, 0, 0, 0]],
  'all ones': [[16, 16, 16, 16, 16, 16, 16, 16], [1, 1, 1, 1, 1, 1, 1, 1]],
};

const Row = ({ label, vals, tone }: { label: string; vals: number[]; tone?: string }) => (
  <div className="ntt-row">
    <span className="ntt-rlabel">{label}</span>
    <div className="ntt-cells">{vals.map((v, i) => <span key={i} className={`ntt-cell ${tone ?? ''}`}>{v}</span>)}</div>
  </div>
);

export function NttSection() {
  const [a, setA] = useState<number[]>(PRESETS['small'][0]);
  const [b, setB] = useState<number[]>(PRESETS['small'][1]);

  const ahat = useMemo(() => ntt(a, q, psi), [a]);
  const bhat = useMemo(() => ntt(b, q, psi), [b]);
  const chat = useMemo(() => pointwise(ahat, bhat, q), [ahat, bhat]);
  const c = useMemo(() => intt(chat, q, psi), [chat]);
  const school = useMemo(() => negamul(a, b, q), [a, b]);
  const matches = c.every((v, i) => v === school[i]);

  const editCoeff = (which: 'a' | 'b', i: number, val: number) => {
    const v = ((val % q) + q) % q;
    (which === 'a' ? setA : setB)((arr) => arr.map((x, k) => (k === i ? v : x)));
  };

  return (
    <div className="ntt">
      <div className="ntt-presets">
        {Object.keys(PRESETS).map((k) => (
          <button key={k} type="button" className="ntt-preset" onClick={() => { setA(PRESETS[k][0]); setB(PRESETS[k][1]); }}>{k}</button>
        ))}
        <span className="ntt-params">n={n}, q={q}, ψ={psi}</span>
      </div>

      <div className="ntt-edit">
        {(['a', 'b'] as const).map((which) => (
          <div key={which} className="ntt-poly">
            <span className="ntt-rlabel">{which}(x)</span>
            <div className="ntt-cells">
              {(which === 'a' ? a : b).map((v, i) => (
                <input key={i} type="number" className="ntt-input" value={v} min={0} max={q - 1}
                  onChange={(e) => editCoeff(which, i, +e.target.value)} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="ntt-stage">
        <div className="ntt-stage-h">1 · transform both to the evaluation domain (NTT)</div>
        <Row label="NTT(a)" vals={ahat} tone="t" />
        <Row label="NTT(b)" vals={bhat} tone="t" />
      </div>

      <div className="ntt-stage">
        <div className="ntt-stage-h">2 · multiply POINTWISE — n cheap products instead of an n² convolution</div>
        <Row label="∘ product" vals={chat} tone="p" />
      </div>

      <div className="ntt-stage">
        <div className="ntt-stage-h">3 · transform back (inverse NTT) → the product polynomial</div>
        <Row label="result" vals={c} tone="r" />
      </div>

      <div className={`ntt-check ${matches ? 'ok' : 'bad'}`}>
        <Row label="schoolbook" vals={school} />
        <div className="ntt-verdict">{matches
          ? '✓ identical to the direct negacyclic product a·b mod (x⁸+1) — the NTT computed the same answer, the fast way.'
          : '✗ mismatch'}</div>
      </div>

      <p className="ntt-foot">
        The win is asymptotic: schoolbook multiplication is <strong>O(n²)</strong>, but transform → pointwise → inverse-transform is
        <strong> O(n log n)</strong> with the butterfly NTT (here we show the direct O(n²) transform for legibility). Because lattice schemes
        multiply polynomials constantly — in <strong>Kyber/ML-KEM</strong> key generation, encryption and decryption — they pick a modulus q
        with the right roots of unity (Kyber uses q=3329, n=256) and keep keys and ciphertexts <em>in the NTT domain</em> so the transforms
        almost never have to run. The negacyclic ψ-weighting is what bakes the ring’s <code>x^n = −1</code> wrap into an ordinary NTT. (FIPS 203.)
      </p>
    </div>
  );
}
