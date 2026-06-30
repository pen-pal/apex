// Paillier homomorphic encryption, made visible. Pick two numbers; encrypt each (note the same number
// gives a different ciphertext every time — semantic security). Then MULTIPLY the two ciphertexts: the
// result decrypts to the SUM of your numbers, and the server that did the multiply never saw either value.
// The voting strip drives it home: encrypted ballots add up to an encrypted tally only the key-holder can
// open. Real model from paillier.ts.
import { useState } from 'react';
import { encrypt, decrypt, add, N } from './paillier';

// small coprime-to-77 randomizers, cycled so each encryption looks different
const RS = [2, 3, 5, 13, 17, 19, 23, 26, 30, 41];
const enc = (m: number, i: number) => encrypt(m, RS[i % RS.length]);

export function PaillierSection() {
  const [a, setA] = useState(30);
  const [b, setB] = useState(12);
  const [ri, setRi] = useState(0); // bump to re-randomize

  const ea = enc(a, ri), eb = enc(b, ri + 1);
  const product = add(ea, eb); // ciphertext multiplication = plaintext addition
  const sum = decrypt(product);

  const BALLOTS = [1, 0, 1, 1, 0, 1, 1, 0];
  const encBallots = BALLOTS.map((v, i) => enc(v, i + ri));
  const tally = encBallots.reduce((acc, c) => add(acc, c));

  return (
    <div className="pai">
      <p className="pai-intro">
        <strong>Homomorphic</strong> encryption lets you compute on data you can't read. Paillier is
        <strong> additively</strong> homomorphic: multiply two ciphertexts and you get an encryption of the
        <strong> sum</strong> of the plaintexts — no private key, no decryption of the inputs. A server can
        total encrypted votes or salaries and only the key-holder ever sees a result.
      </p>

      <div className="pai-calc">
        <div className="pai-operand">
          <label>a <input type="range" min={0} max={38} value={a} onChange={(e) => setA(+e.target.value)} /><b>{a}</b></label>
          <div className="pai-ct"><span>E(a)</span><code>{ea}</code></div>
        </div>
        <div className="pai-op">×</div>
        <div className="pai-operand">
          <label>b <input type="range" min={0} max={38} value={b} onChange={(e) => setB(+e.target.value)} /><b>{b}</b></label>
          <div className="pai-ct"><span>E(b)</span><code>{eb}</code></div>
        </div>
        <div className="pai-op">=</div>
        <div className="pai-result">
          <div className="pai-ct big"><span>E(a)·E(b) mod n²</span><code>{product}</code></div>
          <div className="pai-dec">decrypt → <b>{sum}</b> = a + b {a + b >= N && <i>(mod {N})</i>}</div>
        </div>
      </div>

      <div className="pai-server">
        <span className="pai-eye">🖥️ what the server sees</span>
        <code>{ea} × {eb} = {product}</code>
        <span className="pai-eye-note">— just big numbers; it computed your sum without learning a or b.</span>
        <button type="button" className="pai-rerand" onClick={() => setRi((x) => x + 2)}>↻ re-encrypt</button>
      </div>

      <div className="pai-vote">
        <div className="pai-vote-h">Private tally — eight encrypted yes/no ballots:</div>
        <div className="pai-ballots">
          {BALLOTS.map((v, i) => (
            <div key={i} className="pai-ballot">
              <span className="pai-bv">{v ? 'yes' : 'no'}</span>
              <code title="encrypted ballot — indistinguishable">{encBallots[i]}</code>
            </div>
          ))}
        </div>
        <div className="pai-vote-sum">
          multiply all ciphertexts → <code>{tally}</code> → decrypt → <b>{decrypt(tally)} yes</b>
          <span className="pai-vote-note">The talliers never see any single ballot — only the final count.</span>
        </div>
      </div>

      <p className="pai-foot">
        How it works: a ciphertext is <code>c = g<sup>m</sup>·r<sup>n</sup> mod n²</code>. Multiply two and the
        exponents add — <code>g<sup>m₁</sup>·g<sup>m₂</sup> = g<sup>m₁+m₂</sup></code> — so the product decrypts
        to <code>m₁+m₂</code>; the random <code>r<sup>n</sup></code> factors just combine into fresh
        randomness. You can also add a public constant (multiply by <code>g<sup>k</sup></code>) or multiply by
        a public scalar (raise to the <code>k</code>). What you <em>can't</em> do is multiply two encrypted
        values — that needs <strong>fully homomorphic encryption</strong> (Gentry 2009; BFV/CKKS), which
        supports both add and multiply at far higher cost. Paillier's narrow power is exactly enough for
        private sums: <strong>e-voting, federated analytics, encrypted aggregation</strong>. (Paillier 1999.)
      </p>
    </div>
  );
}
