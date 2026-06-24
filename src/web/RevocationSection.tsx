// Certificate revocation & transparency, made visible. A cert can be valid for a year
// but compromised today — pick how a browser learns to distrust it (CRL / OCSP /
// stapling) and see the privacy/latency/freshness trade. Then watch Certificate
// Transparency catch a mis-issued cert: every cert is logged publicly, browsers
// require the log proof (SCT), and a domain owner monitoring the logs spots the one
// they never requested. Model in revocation.ts (tested).
import { useState } from 'react';
import { METHODS, byId, monitor, browserAccepts, type RevMethod, type CtEntry } from './revocation';

const LOG: CtEntry[] = [
  { serial: 1, domain: 'mybank.com', issuedBy: 'Legit CA', sct: true },
  { serial: 47, domain: 'shop.example.com', issuedBy: 'Legit CA', sct: true },
  { serial: 99, domain: 'mybank.com', issuedBy: 'Sketchy CA', sct: true }, // mis-issued
  { serial: 53, domain: 'cdn.example.com', issuedBy: 'Legit CA', sct: false }, // would be rejected
];

export function RevocationSection() {
  const [method, setMethod] = useState<RevMethod>('stapling');
  const m = byId(method);
  const flagged = monitor(LOG, 'mybank.com', new Set([1])); // I only requested serial 1

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>① The problem: revoke a cert before it expires</h2></div>
        <p className="jsec-sub">
          A leaf cert is valid for months, but its private key can be stolen <em>today</em>. The expiry date won’t save you — the
          browser needs a way to learn “this cert is no longer trustworthy”. Three mechanisms, three trade-offs.
        </p>
        <div className="rv-cert">🔑 <strong>shop.example.com</strong> · valid 11 months · <span className="rv-bad">key compromised today</span> → must be revoked now</div>
      </section>

      <section className="jsec">
        <div className="jsec-head"><h2>② How the browser checks: CRL · OCSP · stapling</h2></div>
        <div className="rv-tabs">
          {METHODS.map((x) => <button key={x.id} className={method === x.id ? 'on' : ''} onClick={() => setMethod(x.id)}>{x.label}</button>)}
        </div>
        <div className="rv-flow">
          <div className="rv-actor">🌐 browser</div>
          <div className="rv-link">{method === 'stapling' ? '— handshake (stapled proof) —' : method === 'crl' ? '— downloads list —' : '— asks per cert —'}</div>
          <div className="rv-actor">🖥️ server</div>
          {m.clientContactsCA
            ? <><div className="rv-link up">{method === 'ocsp' ? '↗ leaks which site' : '↗ fetch list'}</div><div className="rv-actor ca">🏛️ CA</div></>
            : <><div className="rv-link up ok">server fetched it ✓</div><div className="rv-actor ca dim">🏛️ CA</div></>}
        </div>
        <div className="rv-badges">
          <span className={`rv-badge ${m.clientContactsCA ? 'no' : 'yes'}`}>{m.clientContactsCA ? 'browser must call out' : 'no extra call'}</span>
          <span className={`rv-badge ${m.privacy === 'leaks' ? 'no' : 'yes'}`}>{m.privacy === 'leaks' ? 'leaks browsing to CA' : 'private'}</span>
          <span className="rv-badge neutral">freshness: {m.freshness}</span>
          <span className="rv-badge neutral">cost: {m.cost}</span>
        </div>
        <div className="rv-note">{m.note}</div>
      </section>

      <section className="jsec">
        <div className="jsec-head"><h2>③ Certificate Transparency — catch mis-issuance in public</h2></div>
        <p className="jsec-sub">
          Revocation only helps once you <em>know</em> a cert is bad. Certificate Transparency makes every issued cert public:
          CAs append each one to tamper-evident <span className="rv-ref">Merkle-tree logs</span>, browsers require a log proof (an
          <strong> SCT</strong>) or they reject the cert, and domain owners monitor the logs for certs they never asked for.
        </p>
        <table className="rv-log">
          <thead><tr><th>serial</th><th>domain</th><th>issued by</th><th>SCT</th><th>browser</th></tr></thead>
          <tbody>
            {LOG.map((e) => {
              const mine = e.domain === 'mybank.com';
              const bad = flagged.includes(e);
              return (
                <tr key={e.serial} className={bad ? 'flag' : ''}>
                  <td>{e.serial}</td>
                  <td>{e.domain}{mine && ' 👈 mine'}</td>
                  <td>{e.issuedBy}</td>
                  <td>{e.sct ? '✓' : '✗'}</td>
                  <td>{browserAccepts(e) ? 'accepts' : '🚫 rejects (no SCT)'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="rv-monitor">
          🔭 monitoring <strong>mybank.com</strong> (I only requested serial 1): flagged{' '}
          <strong>serial {flagged[0].serial}</strong> issued by <strong>{flagged[0].issuedBy}</strong> — a cert for my domain I
          never asked for. <strong>Mis-issuance caught</strong>, in public, before it could be widely abused.
        </div>
        <p className="rv-foot">
          CT is why a rogue or compromised CA can no longer quietly mint certs for your domain — DigiNotar (2011) issued a fraudulent
          *.google.com and went undetected long enough to spy on Iranian users; CT was the response. Revocation handles the cert you
          know is bad; CT is how you find out.
        </p>
      </section>
    </div>
  );
}
