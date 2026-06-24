// Schnorr's zero-knowledge proof, made visible. The prover convinces the verifier it
// knows the secret x behind Y = xG, in three moves, without revealing x. Slide the
// secret, the commitment randomness, and the challenge and watch sG == T + cY hold.
// Then flip to "cheat": a prover without x can only pass if it knew the challenge
// first — which is why the verifier picks it after the commitment. Real curve math
// (schnorr.ts on the ecc.ts toy curve, tested).
import { useState } from 'react';
import { publicKey, commit, respond, verify, forgeCommit, N } from './schnorr';
import { type Pt } from './ecc';

const show = (p: Pt) => (p === null ? 'O' : `(${p.x},${p.y})`);

export function SchnorrSection() {
  const [x, setX] = useState(7);
  const [r, setR] = useState(4);
  const [c, setC] = useState(5);
  const [cheat, setCheat] = useState(false);

  const Y = publicKey(x);
  // honest run
  const T = commit(r);
  const s = respond(r, c, x);
  const ok = verify(Y, T, c, s);

  // cheat run: attacker (no x) fixes s and a GUESSED challenge cg, back-solves T
  const [sg, setSg] = useState(12);
  const [cg, setCg] = useState(5);
  const Tforge = forgeCommit(Y, cg, sg);
  const passesGuess = verify(Y, Tforge, cg, sg);
  const realC = (cg + c) % N; // the verifier's actual (different) challenge
  const passesReal = verify(Y, Tforge, realC, sg);

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Prove you know a secret — without revealing it</h2></div>
        <p className="jsec-sub">
          The prover holds a secret scalar <strong>x</strong>; everyone knows <strong>Y = xG</strong>. In three messages the prover
          convinces the verifier it knows x, and the verifier learns <em>nothing</em> about x — only that the prover knows it.
        </p>

        <div className="sch-flow">
          <div className="sch-move">
            <span className="sch-actor p">prover</span>
            <div className="sch-step">① commit: pick random r, send <strong>T = rG</strong></div>
            <label>secret x = {x}<input type="range" min={1} max={N - 1} value={x} onChange={(e) => setX(Number(e.target.value))} /></label>
            <label>random r = {r}<input type="range" min={1} max={N - 1} value={r} onChange={(e) => setR(Number(e.target.value))} /></label>
            <div className="sch-pt">Y = xG = <code>{show(Y)}</code> · T = rG = <code>{show(T)}</code></div>
          </div>
          <div className="sch-move">
            <span className="sch-actor v">verifier</span>
            <div className="sch-step">② challenge: send random <strong>c</strong> (only after seeing T)</div>
            <label>challenge c = {c}<input type="range" min={0} max={N - 1} value={c} onChange={(e) => setC(Number(e.target.value))} /></label>
          </div>
          <div className="sch-move">
            <span className="sch-actor p">prover</span>
            <div className="sch-step">③ respond: send <strong>s = r + c·x mod {N}</strong> = {s}</div>
          </div>
        </div>

        <div className={`sch-verdict ${ok ? 'ok' : 'bad'}`}>
          verifier checks <strong>sG == T + cY</strong> → <strong>{ok ? '✓ accepted' : '✗ rejected'}</strong>
          {ok && <> — and it learned only Y, T, c, s; never x. (s = r + c·x hides x behind the random r.)</>}
        </div>
      </section>

      <section className="jsec">
        <div className="jsec-head"><h2>Why the order matters (soundness)</h2></div>
        <p className="jsec-sub">
          Could a cheater without x fake it? Only by working backwards: fix the response s and a <em>guessed</em> challenge, then
          back-solve a commitment <code>T = sG − cY</code>. It passes — but only for that exact guess. A verifier who picks a fresh
          challenge <em>after</em> the commitment catches it. (This same back-solving is why the proof leaks nothing — the transcript
          is simulatable.)
        </p>
        <button className="sch-btn" onClick={() => setCheat((v) => !v)}>{cheat ? 'hide' : 'show'} the cheating attempt</button>
        {cheat && (
          <div className="sch-cheat">
            <div>attacker picks s = <input className="sch-in" type="number" value={sg} onChange={(e) => setSg(Number(e.target.value) || 0)} /> and guesses challenge c = <input className="sch-in" type="number" value={cg} onChange={(e) => setCg(Number(e.target.value) || 0)} />, back-solves T = <code>{show(Tforge)}</code></div>
            <div className={passesGuess ? 'sch-ok' : 'sch-bad'}>vs the guessed c={cg}: {passesGuess ? '✓ passes' : '✗'}</div>
            <div className={passesReal ? 'sch-ok' : 'sch-bad'}>vs the verifier’s real c={realC}: {passesReal ? '✓ passes' : '✗ rejected — the cheat fails'}</div>
          </div>
        )}
        <p className="sch-foot">
          Make the challenge a hash of the commitment (c = H(g, Y, T, message)) and the interaction disappears: that’s the{' '}
          <strong>Fiat–Shamir</strong> transform, and the resulting non-interactive proof <em>is</em> a Schnorr/EdDSA signature. The
          same structure underpins zk-SNARKs and anonymous credentials.
        </p>
      </section>
    </div>
  );
}
