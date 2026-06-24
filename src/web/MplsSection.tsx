// MPLS, made visible. Step a packet down a label-switched path and watch the label
// get pushed at the ingress, swapped by an exact-match lookup at each core router, and
// popped one hop early so the egress does a single IP lookup. The label — not the
// destination address — chooses the path. Model in mpls.ts (tested).
import { useState } from 'react';
import { journey, PATH, type Action } from './mpls';

const hops = journey();
const ACT: Record<Action, { verb: string; cls: string }> = {
  push: { verb: 'PUSH label', cls: 'push' },
  swap: { verb: 'SWAP label', cls: 'swap' },
  pop: { verb: 'POP label (PHP)', cls: 'pop' },
  ip: { verb: 'IP lookup → exit', cls: 'ip' },
};
const wire = (label: number | null) => (label === null ? 'IP' : `L=${label}`);

export function MplsSection() {
  const [step, setStep] = useState(0);
  const cur = hops[step];

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>MPLS — forward on a label, not an address</h2></div>
        <p className="jsec-sub">
          Instead of a longest-prefix IP lookup at every router, MPLS does one <strong>exact-match</strong> on a short label. The
          ingress <strong>pushes</strong> a label, each core router <strong>swaps</strong> it for the next hop, and the penultimate
          router <strong>pops</strong> it (PHP) so the egress does a single IP lookup. Step the packet through.
        </p>

        <div className="mpls-path">
          <div className="mpls-ce">CE1</div>
          <div className="mpls-wire">{wire(hops[0].inLabel)}</div>
          {hops.map((h, i) => (
            <span key={h.router} className="mpls-seg">
              <div className={`mpls-r ${PATH[i].role} ${i === step ? 'on' : ''}`} onClick={() => setStep(i)}>
                <div className="mpls-r-name">{h.router}</div>
                <div className="mpls-r-role">{PATH[i].role}</div>
              </div>
              <div className={`mpls-wire ${h.outLabel !== null ? 'labeled' : ''}`}>{wire(h.outLabel)}</div>
            </span>
          ))}
          <div className="mpls-ce">CE2</div>
        </div>

        <div className="mpls-stepper">
          <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>◀</button>
          <span>hop {step + 1} / {hops.length}</span>
          <button onClick={() => setStep(Math.min(hops.length - 1, step + 1))} disabled={step === hops.length - 1}>▶</button>
        </div>

        <div className={`mpls-action ${ACT[cur.action].cls}`}>
          <strong>{cur.router}</strong> — <strong>{ACT[cur.action].verb}</strong>
          {cur.action === 'push' && <> : classify the packet’s destination into a forwarding class, push label <code>{cur.outLabel}</code>, send to {cur.next}. One IP lookup, at the edge, ever.</>}
          {cur.action === 'swap' && <> : exact-match label <code>{cur.inLabel}</code> in the LFIB → swap to <code>{cur.outLabel}</code>, send to {cur.next}. No IP lookup at all.</>}
          {cur.action === 'pop' && <> : this is the penultimate hop, so it pops label <code>{cur.inLabel}</code> and forwards a plain IP packet to {cur.next} — saving the egress a redundant lookup.</>}
          {cur.action === 'ip' && <> : the egress receives an unlabeled packet and does a normal IP lookup to reach {cur.next}.</>}
        </div>

        <p className="mpls-foot">
          Because the label decides the path, MPLS can pin a flow to an engineered route (RSVP-TE), stack a second label to carry a
          VPN customer’s traffic across a shared core (L3VPN), or fast-reroute around a failure in &lt;50 ms — none of which plain
          destination-based IP routing can express. The forwarding itself is just push/swap/pop on a 20-bit number.
        </p>
      </section>
    </div>
  );
}
