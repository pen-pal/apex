// Kerberos, made visible. Step through the six messages of the three exchanges and
// watch the tickets stay opaque to Alice — she relays the TGT and the service ticket
// without ever reading them, and her password never goes on the wire. Model in
// kerberos.ts (tested). The encryption is shown honestly: a blob she can't decrypt is
// a sealed box, not invented plaintext.
import { useState } from 'react';
import { flow, type Blob } from './kerberos';

const steps = flow();
const PARTIES = ['client', 'KDC', 'service'] as const;
const partyOf = (name: string) => (name.startsWith('client') ? 'client' : name.includes('KDC') ? 'KDC' : 'service');
const EXCH: Record<string, string> = { AS: 'Authentication Server', TGS: 'Ticket-Granting Server', AP: 'Application server' };

export function KerberosSection() {
  const [i, setI] = useState(0);
  const s = steps[i];
  const fromP = partyOf(s.from), toP = partyOf(s.to);

  const blobCard = (b: Blob) => {
    const opaqueToClient = b.readableBy !== 'client';
    const relayedByClient = opaqueToClient && s.from === 'client';
    return (
      <div key={b.label} className={`kb-blob ${b.readableBy}`}>
        <div className="kb-blob-h">
          <span className="kb-blob-label">{b.label}</span>
          <span className="kb-seal">🔒 {b.encWith}</span>
        </div>
        <div className="kb-blob-body">{b.contents.map((c) => <span key={c} className="kb-item">{c}</span>)}</div>
        <div className="kb-blob-who">
          {relayedByClient
            ? <>opaque to Alice — she relays it blindly; only the <strong>{b.readableBy}</strong> can open it</>
            : <>opens with <strong>{b.encWith}</strong> — readable by the <strong>{b.readableBy}</strong></>}
        </div>
      </div>
    );
  };

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Kerberos — single sign-on without sending a password</h2></div>
        <p className="jsec-sub">
          Three request/reply exchanges. The <strong>KDC</strong> shares a long-term key with every principal, so it can hand each
          side a session key sealed under a key only that side holds — and the tickets are <em>opaque to Alice</em>, who just relays
          them. Step through and watch what she can and can’t read.
        </p>

        <div className="kb-stage">
          {PARTIES.map((p) => (
            <div key={p} className={`kb-party ${fromP === p ? 'from' : ''} ${toP === p ? 'to' : ''}`}>
              {p === 'client' ? 'Alice (client)' : p === 'KDC' ? 'KDC (AS + TGS)' : 'Service'}
            </div>
          ))}
        </div>
        <div className={`kb-msg ${s.exchange}`}>
          <span className="kb-arrow">{s.from} → {s.to}</span>
          <span className="kb-msg-name">{s.msg}</span>
          <span className="kb-exch">{EXCH[s.exchange]} exchange</span>
        </div>

        <div className="kb-blobs">{s.blobs.map(blobCard)}</div>
        <div className="kb-note">{s.note}</div>

        <div className="kb-steps">
          <button onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0}>◀</button>
          {steps.map((st, k) => (
            <button key={k} className={`kb-dot ${st.exchange} ${k === i ? 'on' : ''}`} onClick={() => setI(k)} title={st.msg}>{st.msg}</button>
          ))}
          <button onClick={() => setI(Math.min(steps.length - 1, i + 1))} disabled={i === steps.length - 1}>▶</button>
        </div>

        <p className="kb-foot">
          Three properties fall out of this design: the <strong>password never travels</strong> (only a key derived from it, used to
          open the AS reply); <strong>single sign-on</strong> — the TGT is reused for every service, no re-auth; and the{' '}
          <strong>KDC can be offline</strong> for the AP exchange, since the service validates the ticket with its own key. The
          weak point is the KDC’s knowledge of every key — and that an authenticated user can request a <strong>service ticket</strong>{' '}
          (sealed with the service account’s key Ksvc) and crack it offline to recover that account’s password: “Kerberoasting”.
        </p>
      </section>
    </div>
  );
}
