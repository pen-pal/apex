// VXLAN overlay, made visible. A tenant Ethernet frame gets wrapped layer by layer — VXLAN (VNI) →
// UDP (4789) → outer IP (VTEP→VTEP) → outer Ethernet — crosses a plain L3 underlay, and is unwrapped
// at the far VTEP. Step a two-way exchange and watch the VTEP LEARN inner-MAC → remote-VTEP, turning
// floods into unicast; flip the VNI to see tenant isolation. Encapsulation + learning from overlay.ts.
import { useMemo, useState } from 'react';
import { encapsulate, learn, lookup, VXLAN_PORT, VXLAN_OVERHEAD, type Frame, type MacTable } from './overlay';

const MAC_A = '02:00:00:00:00:0a', MAC_B = '02:00:00:00:00:0b';
const VTEP1 = '10.0.0.1', VTEP2 = '10.0.0.2';

export function VxSection() {
  const [vni, setVni] = useState(5000);
  const [step, setStep] = useState(0); // 0 = before A→B, 1 = after A→B, 2 = after B→A

  // build the learned table up to the current step
  const table = useMemo(() => {
    let t: MacTable = {};
    if (step >= 1) t = learn(t, vni, MAC_A, VTEP1); // VTEP2 learns A behind VTEP1 from the first frame
    if (step >= 2) t = learn(t, vni, MAC_B, VTEP2); // VTEP1 learns B behind VTEP2 from the reply
    return t;
  }, [step, vni]);

  const sending: { frame: Frame; from: string; to: string } | null =
    step === 0 ? { frame: { dstMac: MAC_B, srcMac: MAC_A, payload: 'GET /' }, from: VTEP1, to: VTEP2 }
      : step === 1 ? { frame: { dstMac: MAC_A, srcMac: MAC_B, payload: '200 OK' }, from: VTEP2, to: VTEP1 }
        : null;

  const pkt = sending ? encapsulate(sending.frame, vni, sending.from, sending.to) : null;
  const dstKnown = sending ? lookup(table, vni, sending.frame.dstMac) : null;

  const reset = (v: number) => { setVni(v); setStep(0); };

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>VXLAN overlay — millions of tenant networks on one wire</h2></div>
        <p className="jsec-sub">
          A cloud can’t give every tenant its own physical switch, so it builds <strong>virtual</strong> L2 networks on top of one shared L3
          fabric. A <strong>VTEP</strong> wraps each tenant frame in a <strong>VXLAN</strong> header — whose 24-bit <strong>VNI</strong> names
          the tenant network (~16M of them) — then UDP, then an outer IP header addressed VTEP→VTEP. The underlay just routes UDP/IP; the far
          VTEP unwraps and delivers the original frame. Same MAC in two VNIs? Completely separate.
        </p>

        <div className="vx-vni">
          tenant network (VNI): {[5000, 6000].map((v) => <button key={v} className={vni === v ? 'on' : ''} onClick={() => reset(v)}>VNI {v}</button>)}
        </div>

        <div className="vx-fabric">
          <div className="vx-vtep"><div className="vx-vteph">VTEP1 · {VTEP1}</div><div className="vx-vm a">VM-A<br /><span>{MAC_A}</span></div></div>
          <div className="vx-underlay">L3 underlay<br /><span>routes UDP/IP</span></div>
          <div className="vx-vtep"><div className="vx-vteph">VTEP2 · {VTEP2}</div><div className="vx-vm b">VM-B<br /><span>{MAC_B}</span></div></div>
        </div>

        {pkt && sending && (
          <div className="vx-packet">
            <div className="vx-pcap">{sending.from === VTEP1 ? 'VM-A → VM-B' : 'VM-B → VM-A'} — {dstKnown ? <span className="vx-uni">unicast to {dstKnown}</span> : <span className="vx-flood">dst MAC unknown → FLOOD to all VTEPs in VNI {vni}</span>}</div>
            <div className="vx-stack">
              <div className="vx-layer eth">Outer Ethernet <span>next-hop MACs</span></div>
              <div className="vx-layer ip">Outer IP <span>{pkt.outerIp.src} → {pkt.outerIp.dst}</span></div>
              <div className="vx-layer udp">UDP <span>:{pkt.udp.srcPort} → :{pkt.udp.dstPort} (VXLAN)</span></div>
              <div className="vx-layer vxlan">VXLAN <span>flags {pkt.vxlan.flagsHex} · VNI {pkt.vxlan.vni}</span></div>
              <div className="vx-layer inner">
                <div className="vx-innerlbl">inner tenant frame</div>
                <div className="vx-innerframe">{pkt.inner.srcMac} → {pkt.inner.dstMac} · “{pkt.inner.payload}”</div>
              </div>
            </div>
            <div className="vx-overhead">+{VXLAN_OVERHEAD} bytes overhead (Eth+IP+UDP+VXLAN) · UDP/{VXLAN_PORT}</div>
          </div>
        )}
        {!sending && <div className="vx-done">✓ Both VTEPs have learned each other’s MACs — further traffic is pure unicast across the fabric.</div>}

        <div className="vx-controls">
          <button className="vx-step" onClick={() => setStep((s) => Math.min(2, s + 1))} disabled={step >= 2}>
            {step === 0 ? 'send VM-A → VM-B ▶' : step === 1 ? 'VM-B replies → VM-A ▶' : 'exchange complete'}
          </button>
          <button onClick={() => setStep(0)} disabled={step === 0}>↺ reset</button>
        </div>

        <div className="vx-table">
          <div className="vx-tlbl">VTEP MAC-learning table (VNI {vni})</div>
          {Object.keys(table).length === 0 ? <div className="vx-tempty">empty — first unknown frame is flooded</div> : (
            <table><tbody>
              <tr><th>VNI</th><th>inner MAC</th><th>remote VTEP</th></tr>
              {Object.entries(table).map(([k, v]) => { const [vn, mac] = k.split('|'); return <tr key={k}><td>{vn}</td><td>{mac}</td><td>{v}</td></tr>; })}
            </tbody></table>
          )}
          <div className="vx-iso">Isolation check — same MAC ({MAC_A}) on VNI {vni === 5000 ? 6000 : 5000}: <b>{lookup(table, vni === 5000 ? 6000 : 5000, MAC_A) ?? 'unknown (separate network)'}</b></div>
        </div>

        <p className="vx-foot">
          The overlay decouples the tenant’s addressing from the physical network entirely: VMs keep their MACs and IPs as they migrate across
          racks, because only the outer VTEP IPs change. The trade-offs are the {VXLAN_OVERHEAD}-byte tax (so the underlay needs a larger MTU,
          ~1600+, or you fragment) and how BUM traffic and MAC learning are handled — flood-and-learn as shown, or a control plane like
          <strong> EVPN-BGP</strong> that distributes MAC→VTEP mappings so nothing has to be flooded. Geneve (RFC 8926) generalizes the same
          idea with extensible TLV options.
        </p>
      </section>
    </div>
  );
}
