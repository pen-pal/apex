// DHCP DORA, made visible. Step through Discover → Offer → Request → Ack as the
// client and server talk (all broadcast, because the client has no address yet),
// then watch the lease timeline: at T1 (50%) the client renews by unicast, at T2
// (87.5%) it rebinds to any server, at 100% the lease expires. Real model (dhcp.ts).
import { useMemo, useState } from 'react';
import { doraMessages, leaseTimers, leasePhaseAt, renewMessages, type DhcpMessage } from './dhcp';

const OFFERED = '192.168.1.50', SERVER = '192.168.1.1', LEASE = 120;

export function DhcpSection() {
  const dora = useMemo(() => doraMessages(OFFERED, SERVER, LEASE), []);
  const timers = useMemo(() => leaseTimers(LEASE), []);
  const [step, setStep] = useState(0); // 0..4 DORA messages delivered
  const [elapsed, setElapsed] = useState(0);
  const [renewMsg, setRenewMsg] = useState<DhcpMessage[] | null>(null);

  const bound = step >= 4;
  const phase = leasePhaseAt(elapsed, timers);
  const pct = (s: number) => (s / LEASE) * 100;

  const renew = () => { setRenewMsg(renewMessages(OFFERED, SERVER, LEASE)); setElapsed(0); };

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>DHCP — getting an address from nothing</h2></div>
        <p className="jsec-sub">
          A device joining a network has no IP, no gateway, no DNS. DHCP hands it all of that through the
          <strong> DORA</strong> exchange — and because the client starts with <em>no address at all</em>, the first
          messages must be broadcast. Step through it, then watch the lease age toward renewal and expiry.
        </p>

        <div className="dhcp-play">
          <button className="ghost small" onClick={() => { setStep(0); setElapsed(0); setRenewMsg(null); }}>⏮ reset</button>
          <button className="ghost small" disabled={step >= 4} onClick={() => setStep((s) => Math.min(4, s + 1))}>next message →</button>
          <button className="ghost small" disabled={step >= 4} onClick={() => setStep(4)}>run DORA</button>
          <span className="dhcp-prog">{Math.min(step, 4)}/4</span>
        </div>

        <div className="dhcp-arc">
          <div className="dhcp-cols"><span className="dhcp-actor client">Client (0.0.0.0)</span><span className="dhcp-actor server">DHCP server</span></div>
          {dora.slice(0, step).map((m, i) => (
            <div key={i} className={`dhcp-msg ${m.from} ${m.broadcast ? 'bcast' : 'ucast'}`}>
              <span className="dhcp-type">{m.type}</span>
              <span className="dhcp-arrow">{m.from === 'client' ? '──▶' : '◀──'}</span>
              <span className="dhcp-tag">{m.broadcast ? 'broadcast' : 'unicast'}{m.yourIp ? ` · ${m.yourIp}` : ''}</span>
            </div>
          ))}
          {step > 0 && <p className="dhcp-note">{dora[step - 1].note}</p>}
        </div>

        {bound && (
          <>
            <div className="dhcp-lease">
              <div className="dhcp-lease-h">✓ Lease bound</div>
              <div className="dhcp-lease-grid">
                <span>address</span><code>{OFFERED}</code>
                <span>from server</span><code>{SERVER}</code>
                <span>lease</span><code>{LEASE}s · T1 {timers.t1}s · T2 {timers.t2}s</code>
                <span>state</span><code className={`dhcp-state ${phase}`}>{phase.toUpperCase()}</code>
              </div>
            </div>

            <div className="dhcp-timeline-wrap">
              <div className="dhcp-timeline">
                <div className="dhcp-band bound" style={{ left: 0, width: `${pct(timers.t1)}%` }} />
                <div className="dhcp-band renew" style={{ left: `${pct(timers.t1)}%`, width: `${pct(timers.t2 - timers.t1)}%` }} />
                <div className="dhcp-band rebind" style={{ left: `${pct(timers.t2)}%`, width: `${pct(LEASE - timers.t2)}%` }} />
                <div className="dhcp-marker" style={{ left: `${pct(timers.t1)}%` }}><span>T1 renew</span></div>
                <div className="dhcp-marker" style={{ left: `${pct(timers.t2)}%` }}><span>T2 rebind</span></div>
                <div className="dhcp-marker end" style={{ left: '100%' }}><span>expiry</span></div>
                <div className="dhcp-now" style={{ left: `${pct(elapsed)}%` }} />
              </div>
              <input className="dhcp-slider" type="range" min={0} max={LEASE} value={elapsed} onChange={(e) => { setElapsed(+e.target.value); setRenewMsg(null); }} />
              <div className="dhcp-elapsed">elapsed: {elapsed}s — {phaseNote(phase)}</div>
            </div>

            {(phase === 'renewing' || phase === 'rebinding') && (
              <button className="ghost" onClick={renew}>↻ renew lease now ({phase === 'renewing' ? 'unicast to server' : 'broadcast — rebind'})</button>
            )}
            {phase === 'expired' && <p className="dhcp-expired">⚠ The lease expired — the client must stop using {OFFERED} and start a brand-new DORA from DISCOVER.</p>}
            {renewMsg && (
              <div className="dhcp-renew">
                {renewMsg.map((m, i) => <div key={i} className={`dhcp-msg ${m.from} ucast`}><span className="dhcp-type">{m.type}</span><span className="dhcp-arrow">{m.from === 'client' ? '──▶' : '◀──'}</span><span className="dhcp-tag">unicast</span></div>)}
                <p className="dhcp-note">{renewMsg[renewMsg.length - 1].note}</p>
              </div>
            )}
          </>
        )}
        <p className="enc-note">The REQUEST is broadcast on purpose: it names which server’s offer the client took, so every <em>other</em> server
          that made an offer hears it and releases the address it had reserved. Renewal at T1 is unicast because the client already has a working
          address and just needs to extend it.</p>
      </section>
    </div>
  );
}

function phaseNote(p: string): string {
  return p === 'bound' ? 'using the address normally'
    : p === 'renewing' ? 'past T1 — time to renew with the leasing server (unicast)'
    : p === 'rebinding' ? 'past T2 — server didn’t answer; broadcasting to ANY server'
    : 'lease expired — address relinquished';
}
