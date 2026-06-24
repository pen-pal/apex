// 802.1X, made visible. Three roles guard a network port: the device (supplicant), the switch/AP
// (authenticator), and the RADIUS server. Toggle accept/reject and step the EAP exchange — watch the
// authenticator blindly relay EAP between EAPOL (to the device) and RADIUS (to the server), and the
// port stay UNAUTHORIZED until the server says yes. Exchange + port state from dot1x.ts (tested).
import { useMemo, useState } from 'react';
import { exchange, type Outcome } from './dot1x';

export function DotxSection() {
  const [outcome, setOutcome] = useState<Outcome>('accept');
  const [step, setStep] = useState(99);
  const msgs = useMemo(() => exchange(outcome), [outcome]);
  const shown = msgs.slice(0, step + 1);
  const port = shown.length ? shown[shown.length - 1].port : 'unauthorized';
  const atEnd = step >= msgs.length - 1;

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>802.1X — proving who you are before you get on the network</h2></div>
        <p className="jsec-sub">
          Plugging into a corporate switch port (or joining WPA2-Enterprise Wi-Fi) doesn’t give you network access — the port is
          <strong> blocked</strong> to everything but authentication traffic until you pass 802.1X. The switch (<strong>authenticator</strong>)
          is just a gatekeeper that relays <strong>EAP</strong> between your device (<strong>supplicant</strong>) and a
          <strong> RADIUS</strong> server; only the server checks credentials, and only it can open the port.
        </p>

        <div className="dot1x-lanes">
          <div className="dot1x-role">📱 supplicant<span>your device</span></div>
          <div className="dot1x-role">🔌 authenticator<span>switch / AP</span></div>
          <div className="dot1x-role">🗄️ RADIUS<span>auth server</span></div>
        </div>

        <div className={`dot1x-port ${port}`}>
          port is <b>{port.toUpperCase()}</b> {port === 'authorized' ? '— normal traffic flows' : '— only EAPOL allowed through'}
        </div>

        <div className="dot1x-controls">
          <div className="dot1x-outcome">
            outcome: <button className={outcome === 'accept' ? 'on' : ''} onClick={() => { setOutcome('accept'); setStep(99); }}>✓ valid credential</button>
            <button className={outcome === 'reject' ? 'on' : ''} onClick={() => { setOutcome('reject'); setStep(99); }}>✗ bad credential</button>
          </div>
          <div className="dot1x-step">
            <button onClick={() => setStep(0)}>⏮</button>
            <button onClick={() => setStep((s) => Math.max(0, Math.min(msgs.length - 1, s) - 1))}>‹</button>
            <button onClick={() => setStep((s) => Math.min(msgs.length - 1, s + 1))} disabled={atEnd}>step ›</button>
            <button onClick={() => setStep(99)} disabled={atEnd}>all</button>
          </div>
        </div>

        <ol className="dot1x-seq">
          {shown.map((m) => (
            <li key={m.n} className={`dot1x-msg ${m.proto.toLowerCase()} ${m.label.includes('Success') ? 'ok' : m.label.includes('Failure') || m.label.includes('Reject') ? 'bad' : ''}`}>
              <div className="dot1x-mhead">
                <span className={`dot1x-proto ${m.proto.toLowerCase()}`}>{m.proto}</span>
                <span className="dot1x-route">{m.from} → {m.to}</span>
                <span className="dot1x-label">{m.label}</span>
              </div>
              <div className="dot1x-note">{m.note}</div>
            </li>
          ))}
        </ol>

        <p className="dot1x-foot">
          The design separates policy from enforcement: the switch enforces (open/close the port) but holds no user database, while the RADIUS
          server decides and scales to the whole org. Because the EAP method (EAP-TLS, PEAP) runs inside a TLS tunnel end-to-end between supplicant
          and server, the authenticator — and anyone on the wire — never sees the password. On success the server also hands the authenticator a
          session key (the MSK), which on Wi-Fi seeds WPA2’s 4-way handshake. This is the backbone of enterprise NAC, and MAB/guest VLANs are the
          fallbacks for devices that can’t speak 802.1X.
        </p>
      </section>
    </div>
  );
}
