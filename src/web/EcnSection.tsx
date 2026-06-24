// ECN, made visible. A congested router can tell TCP to slow down by MARKING a packet instead of
// dropping it. See the four ECN codepoints, walk the CE→ECE→CWR signal that carries the news from a
// congested router back to the sender, and compare a flow with ECN (marks, zero loss) against one
// without (drops + retransmits) — same congestion backoff either way. Logic from ecn.ts (tested).
import { useMemo, useState } from 'react';
import { runFlow } from './ecn';

const CODEPOINTS = [
  { bits: '00', name: 'Not-ECT', desc: 'endpoint is not ECN-capable' },
  { bits: '10', name: 'ECT(0)', desc: 'ECN-capable transport' },
  { bits: '01', name: 'ECT(1)', desc: 'ECN-capable transport' },
  { bits: '11', name: 'CE', desc: 'Congestion Experienced (set by a router)' },
];
const SIGNAL = [
  { who: 'sender', txt: 'sends a data packet marked ECT(0) — “I can take a hint”' },
  { who: 'router', txt: 'queue filling → flips the codepoint to CE instead of dropping the packet' },
  { who: 'receiver', txt: 'sees CE → sets the ECE (ECN-Echo) flag on its ACKs' },
  { who: 'sender', txt: 'on ECE → halves cwnd (just like a loss) and sets CWR on the next packet' },
  { who: 'receiver', txt: 'sees CWR → stops echoing ECE. One congestion event, zero packets lost.' },
];

export function EcnSection() {
  const [n] = useState(40);
  const [every, setEvery] = useState(8);
  const withEcn = useMemo(() => runFlow(n, every, true), [n, every]);
  const noEcn = useMemo(() => runFlow(n, every, false), [n, every]);

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>ECN — signal congestion without dropping the packet</h2></div>
        <p className="jsec-sub">
          A router’s classic way to say “slow down” is to <strong>drop</strong> a packet — TCP reads the loss and backs off, but the drop costs
          a retransmit and a latency spike. <strong>ECN</strong> (RFC 3168) lets the router <strong>mark</strong> the packet instead: two bits in
          the IP header carry the state, the receiver echoes a CE mark back, and the sender backs off exactly as it would on a loss — but nothing
          is thrown away.
        </p>

        <div className="ecn-codes">
          {CODEPOINTS.map((c) => (
            <div key={c.bits} className={`ecn-code ${c.name === 'CE' ? 'ce' : c.name === 'Not-ECT' ? 'not' : 'ect'}`}>
              <span className="ecn-bits">{c.bits}</span><span className="ecn-name">{c.name}</span><span className="ecn-desc">{c.desc}</span>
            </div>
          ))}
        </div>

        <h3 className="ecn-h3">The CE → ECE → CWR signal</h3>
        <div className="ecn-signal">
          {SIGNAL.map((s, i) => (
            <div key={i} className={`ecn-step ${s.who}`}>
              <span className="ecn-who">{s.who}</span><span className="ecn-txt">{s.txt}</span>
            </div>
          ))}
        </div>

        <h3 className="ecn-h3">Same backoff, with and without ECN</h3>
        <label className="ecn-slider">router congests every <input type="range" min={4} max={12} value={every} onChange={(e) => setEvery(+e.target.value)} /><b>{every}</b> packets</label>
        <div className="ecn-compare">
          {[{ r: withEcn, label: 'ECN on', cls: 'on' }, { r: noEcn, label: 'ECN off (drop-based)', cls: 'off' }].map(({ r, label, cls }) => (
            <div key={label} className={`ecn-flow ${cls}`}>
              <div className="ecn-flbl">{label}</div>
              <div className="ecn-stats">
                <span><b>{r.cwndHalvings}</b> cwnd backoffs</span>
                <span className={r.marks ? 'mk' : ''}><b>{r.marks}</b> marks</span>
                <span className={r.drops ? 'dp' : ''}><b>{r.drops}</b> drops</span>
                <span className={r.retransmits ? 'dp' : ''}><b>{r.retransmits}</b> retransmits</span>
                <span><b>{r.delivered}/{n}</b> delivered first-try</span>
              </div>
            </div>
          ))}
        </div>

        <p className="ecn-foot">
          Both flows cut their window the same number of times — ECN doesn’t make TCP less cautious, it just removes the <em>collateral damage</em>
          of using loss as the signal: no retransmit, no head-of-line stall while the gap is refilled, smoother latency. It needs both endpoints
          and the routers to cooperate (negotiated in the TCP handshake’s ECE/CWR flags). Modern low-latency stacks lean on it hard: DCTCP marks
          on a shallow threshold to keep datacenter queues tiny, and L4S uses ECN to hold queuing delay near zero for interactive traffic.
        </p>
      </section>
    </div>
  );
}
