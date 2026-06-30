// Feldman VSS, made visible. Choose a secret and the polynomial's slope; the dealer publishes commitments
// to the coefficients (one-way, so the secret stays hidden). Each participant gets a share and checks it
// against the commitments — green ✓ means it provably lies on the committed polynomial. Flip the "cheat"
// switch to hand participant 1 a bad share and watch the check turn red: the dealer is caught. Then pick two
// shares and reconstruct the secret. Real model from feldman.ts.
import { useMemo, useState } from 'react';
import { commitments, share, verifyShare, reconstruct, G, P, Q } from './feldman';

const PARTIES = [1, 2, 3, 4, 5];

export function FeldmanSection() {
  const [secret, setSecret] = useState(7);
  const [slope, setSlope] = useState(3); // a1
  const [cheat, setCheat] = useState(false);
  const [picked, setPicked] = useState<number[]>([1, 2]);

  const coeffs = [secret, slope]; // f(x) = secret + slope·x  (threshold 2)
  const C = useMemo(() => commitments(coeffs), [secret, slope]);

  const shareOf = (i: number) => (cheat && i === 1 ? (share(coeffs, i) + 1) % Q : share(coeffs, i));
  const togglePick = (i: number) => setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i].slice(-2)));
  const recovered = picked.length === 2 ? reconstruct(picked.map((i) => ({ x: i, y: shareOf(i) }))) : null;

  return (
    <div className="fvss">
      <p className="fvss-intro">
        Plain Shamir sharing trusts the dealer — a cheat could hand out points that lie on no single
        polynomial, and you'd only notice when reconstruction silently went wrong. <strong>Feldman VSS</strong>
        adds public <strong>commitments</strong> <code>C_j = g<sup>a_j</sup></code> to each coefficient: each
        participant verifies <code>g<sup>s_i</sup> = ∏ C_j<sup>i^j</sup></code>, proving their share is honest —
        while the secret stays hidden behind the one-way exponentiation.
      </p>

      <div className="fvss-setup">
        <label>secret f(0) <input type="range" min={0} max={10} value={secret} onChange={(e) => setSecret(+e.target.value)} /><b>{secret}</b></label>
        <label>slope a₁ <input type="range" min={1} max={10} value={slope} onChange={(e) => setSlope(+e.target.value)} /><b>{slope}</b></label>
        <div className="fvss-poly">f(x) = {secret} + {slope}x mod {Q}</div>
      </div>

      <div className="fvss-commits">
        <span className="fvss-clbl">public commitments (g={G}, p={P}):</span>
        {C.map((c, j) => <code key={j}>C{j} = {G}<sup>{coeffs[j]}</sup> = {c}</code>)}
        <span className="fvss-cnote">the secret is hidden inside C0 — you can't invert it</span>
      </div>

      <div className="fvss-parties">
        {PARTIES.map((i) => {
          const s = shareOf(i);
          const ok = verifyShare(i, s, C);
          const isCheat = cheat && i === 1;
          const sel = picked.includes(i);
          return (
            <div key={i} className={`fvss-party ${ok ? 'ok' : 'bad'} ${sel ? 'picked' : ''}`}>
              <div className="fvss-pi">participant {i}</div>
              <div className="fvss-share">share f({i}) = <b>{s}</b>{isCheat && <span className="fvss-tampered"> (tampered)</span>}</div>
              <div className={`fvss-verify ${ok ? 'ok' : 'bad'}`}>{ok ? '✓ share verified' : '✗ rejected — bad share'}</div>
              <button type="button" className={`fvss-pick ${sel ? 'on' : ''}`} onClick={() => togglePick(i)}>{sel ? 'using for reconstruct' : 'use to reconstruct'}</button>
            </div>
          );
        })}
      </div>

      <div className="fvss-bottom">
        <label className={`fvss-cheat ${cheat ? 'on' : ''}`}>
          <input type="checkbox" checked={cheat} onChange={(e) => setCheat(e.target.checked)} />
          😈 cheat: hand participant 1 a wrong share
        </label>
        <div className={`fvss-recover ${recovered === secret ? 'ok' : 'bad'}`}>
          {picked.length < 2 ? 'pick 2 shares to reconstruct' : recovered === secret
            ? `reconstruct from shares ${picked.join(' & ')} → ${recovered} ✓ = the secret`
            : `reconstruct from shares ${picked.join(' & ')} → ${recovered} ✗ (a tampered share corrupts the result — but verification caught it first)`}
        </div>
      </div>

      <p className="fvss-foot">
        The guarantee: any t honest, verified shares reconstruct the secret; fewer than t reveal nothing
        (information-theoretically); and a dishonest dealer or a corrupted share is detected before it can do
        damage — no trusted party required. That's why Feldman VSS underpins <strong>distributed key
        generation</strong> (every party acts as a dealer and the secret key is never assembled in one place),
        threshold signatures, and verifiable e-voting. It's <em>computationally</em> hiding (the secret is safe
        only as long as discrete log is hard); <strong>Pedersen VSS</strong> swaps the commitment for an
        information-theoretically hiding one at the cost of a second generator. (Feldman, FOCS 1987.)
      </p>
    </div>
  );
}
