// Oblivious transfer, made visible. The sender holds two secrets; pick which one you (the receiver) want
// and step the EGL exchange. You get exactly your pick — and the panel shows the OTHER secret coming out
// as garbage, while the sender's view never reveals which one you chose. Two privacy guarantees at once,
// from a few lines of modular arithmetic. Real model from ot.ts.
import { useMemo, useState } from 'react';
import { runOT } from './ot';

const M0 = 42, M1 = 1234; // the sender's two secrets (e.g. two database rows, two signing keys)

export function OtSection() {
  const [choice, setChoice] = useState<0 | 1>(0);
  const [k, setK] = useState(7);
  const t = useMemo(() => runOT(M0, M1, choice, k, 100, 2500), [choice, k]);
  const chosenMsg = choice === 0 ? M0 : M1;
  const otherMsg = choice === 0 ? M1 : M0;

  return (
    <div className="obt">
      <p className="obt-intro">
        The <strong>sender</strong> holds two secrets, <code>m0={M0}</code> and <code>m1={M1}</code>. You,
        the <strong>receiver</strong>, want exactly one of them. Oblivious transfer guarantees two things at
        once: <strong>you</strong> learn only your pick (the other stays hidden), and <strong>the sender</strong>
        never learns which one you took. It's the primitive that makes secure multi-party computation possible.
      </p>

      <div className="obt-pick">
        <span>I want</span>
        <button type="button" className={`obt-cbtn ${choice === 0 ? 'on' : ''}`} onClick={() => setChoice(0)}>m0</button>
        <button type="button" className={`obt-cbtn ${choice === 1 ? 'on' : ''}`} onClick={() => setChoice(1)}>m1</button>
        <label className="obt-k">blinding k <input type="range" min={1} max={120} value={k} onChange={(e) => setK(+e.target.value)} /><b>{k}</b></label>
      </div>

      <div className="obt-wire">
        <div className="obt-party sender"><div className="obt-ph">🅂 sender</div><div className="obt-pv">holds m0={M0}, m1={M1}<br />picks pads x0={t.x0}, x1={t.x1}</div></div>
        <div className="obt-msgs">
          <div className="obt-m down"><i>1.</i> (N, e), x0={t.x0}, x1={t.x1} →</div>
          <div className="obt-m up">← <i>2.</i> v = x<sub>b</sub> + k<sup>e</sup> = {t.v} <em>(b is hidden inside v)</em></div>
          <div className="obt-m down"><i>3.</i> enc0={t.enc0}, enc1={t.enc1} → <em>(sender keys both, blind to b)</em></div>
        </div>
        <div className="obt-party receiver"><div className="obt-ph">🅁 receiver</div><div className="obt-pv">wants m{choice}<br />secret k={k}</div></div>
      </div>

      <div className="obt-result">
        <div className="obt-out ok">
          <div className="obt-ol">your chosen branch: enc{choice} − k</div>
          <div className="obt-ov">= {t.output}</div>
          <div className={`obt-ok ${t.output === chosenMsg ? 'good' : 'bad'}`}>{t.output === chosenMsg ? `✓ recovered m${choice} = ${chosenMsg}` : 'mismatch'}</div>
        </div>
        <div className="obt-out bad">
          <div className="obt-ol">the other branch: enc{choice === 0 ? 1 : 0} − k</div>
          <div className="obt-ov">= {t.otherAttempt}</div>
          <div className="obt-ok bad">✗ garbage — the real m{choice === 0 ? 1 : 0} is {otherMsg}, unrecoverable without the sender's key</div>
        </div>
      </div>

      <div className="obt-priv">
        <div className="obt-pcard"><b>Receiver privacy</b><span>The query <code>v = x<sub>b</sub> + k<sup>e</sup></code> is one number masked by the receiver's secret <code>k</code>. To the sender it's uniformly random — it could encode either choice, so b never leaks.</span></div>
        <div className="obt-pcard"><b>Sender privacy</b><span>The sender computes a key for <em>both</em> branches and sends both encryptions, but only <code>(v − x<sub>b</sub>)<sup>d</sup> = k</code> for the branch the receiver actually queried. The other key is unknowable to the receiver, so m<sub>1−b</sub> stays sealed.</span></div>
      </div>

      <p className="obt-foot">
        This is the EGL construction (Even–Goldreich–Lempel, 1985), the textbook RSA-based 1-2 OT on a toy
        modulus for clarity. Real systems use far cheaper <strong>OT extension</strong> (Ishai–Kilian–Nissim–
        Petrank 2003) to turn a handful of "base" OTs into millions, and OT underpins <strong>Yao's garbled
        circuits</strong>, private set intersection, and most of practical MPC. Rabin's original 1981 OT
        delivered a message with probability ½; the 1-2 form shown here is the one everything builds on.
      </p>
    </div>
  );
}
