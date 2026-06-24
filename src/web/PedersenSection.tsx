// Pedersen commitments, made visible. Commit to a value with a blinding factor and see the
// commitment point; change the blinding and watch the commitment move while the value stays
// hidden (hiding). Then commit two values and add the commitments — the sum opens to the
// sum of the values, the homomorphism behind confidential transactions. Real toy-curve math
// in pedersen.ts (tested).
import { useMemo, useState } from 'react';
import { commit, open, addCommit, generators, ptStr } from './pedersen';

const { N } = generators();

export function PedersenSection() {
  const [v, setV] = useState(4);
  const [r, setR] = useState(11);
  const [v2, setV2] = useState(3);
  const [r2, setR2] = useState(7);

  const C = useMemo(() => commit(v, r), [v, r]);
  const C2 = useMemo(() => commit(v2, r2), [v2, r2]);
  const sum = useMemo(() => addCommit(C, C2), [C, C2]);
  const sumOpens = open(sum, (v + v2) % N, (r + r2) % N);

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Pedersen commitments — hide a value, prove things about it</h2></div>
        <p className="jsec-sub">
          A commitment is a sealed envelope: <code>C = v·G + r·H</code>, where <strong>v</strong> is your secret value and
          <strong> r</strong> is a random blinding factor. It’s <strong>hiding</strong> (the random r means C reveals nothing about v)
          and <strong>binding</strong> (you can’t later claim a different v without breaking discrete log). Toy curve order {N}.
        </p>

        <div className="ped-commit">
          <div className="ped-inputs">
            <label>value v <input type="range" min={0} max={N - 1} value={v} onChange={(e) => setV(+e.target.value)} /><b>{v}</b></label>
            <label>blinding r <input type="range" min={1} max={N - 1} value={r} onChange={(e) => setR(+e.target.value)} /><b>{r}</b></label>
          </div>
          <div className="ped-arrow">→</div>
          <div className="ped-out">
            <span className="ped-label">commitment C</span>
            <code>{ptStr(C)}</code>
            <span className="ped-hint">the same C; an observer can’t recover v from it</span>
          </div>
        </div>

        <div className="ped-hidingnote">
          Try holding <b>v = {v}</b> fixed and sliding <b>r</b>: the commitment jumps around the curve, so two commitments to the same
          value look unrelated. That’s hiding.
        </div>

        <div className="ped-homo">
          <div className="jsec-head"><h2>The homomorphism: commitments add</h2></div>
          <p className="jsec-sub">Commit two values separately, then add the <em>commitments</em> — the result is a commitment to the sum, without ever opening either one.</p>
          <div className="ped-homo-grid">
            <div className="ped-term">
              <label>v₁ <input type="range" min={0} max={N - 1} value={v} onChange={(e) => setV(+e.target.value)} /><b>{v}</b></label>
              <label>r₁ <input type="range" min={1} max={N - 1} value={r} onChange={(e) => setR(+e.target.value)} /><b>{r}</b></label>
              <code>C₁ = {ptStr(C)}</code>
            </div>
            <span className="ped-plus">+</span>
            <div className="ped-term">
              <label>v₂ <input type="range" min={0} max={N - 1} value={v2} onChange={(e) => setV2(+e.target.value)} /><b>{v2}</b></label>
              <label>r₂ <input type="range" min={1} max={N - 1} value={r2} onChange={(e) => setR2(+e.target.value)} /><b>{r2}</b></label>
              <code>C₂ = {ptStr(C2)}</code>
            </div>
            <span className="ped-plus">=</span>
            <div className="ped-term sum">
              <div className="ped-sumval">C₁ + C₂ = {ptStr(sum)}</div>
              <div className={`ped-check ${sumOpens ? 'ok' : 'bad'}`}>{sumOpens ? '✓' : '✗'} opens to v = {(v + v2) % N}, r = {(r + r2) % N}</div>
            </div>
          </div>
        </div>

        <p className="ped-foot">
          This is the engine of <strong>confidential transactions</strong>: represent each input and output amount as a Pedersen
          commitment, and prove the inputs balance the outputs by checking that <code>Σ inputs − Σ outputs</code> commits to zero — all
          without revealing a single amount. Add a <em>range proof</em> (Bulletproofs) to show each hidden amount is non-negative, and you
          have private money (Monero, Mimblewimble). The same hiding-then-prove pattern is a building block across zero-knowledge systems.
        </p>
      </section>
    </div>
  );
}
