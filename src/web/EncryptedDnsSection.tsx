// Encrypted DNS — the same lookup over four transports, and what a network observer
// still learns from each. Classic Do53 leaks the name in the clear; DoT/DoQ hide it
// but their port 853 still says "DNS"; DoH buries it in HTTPS on 443. The wire view
// for the encrypted transports shows only the opaque record shape — never invented
// plaintext. Model in encdns.ts (tested).
import { useState } from 'react';
import { TRANSPORTS, byId, wireView, type TransportId } from './encdns';

const Badge = ({ on, hidden, label }: { on: boolean; hidden?: boolean; label: string }) => (
  <span className={`ed-badge ${on ? 'see' : 'hide'}`}>{on ? '👁 ' : '🔒 '}{label}{!on && hidden ? ' hidden' : ''}</span>
);

export function EncryptedDnsSection() {
  const [qname, setQname] = useState('news.example.com');
  const [id, setId] = useState<TransportId>('Do53');
  const t = byId(id);
  const rows = wireView(t, qname || 'example.com');

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Encrypted DNS — who can still see your lookups</h2></div>
        <p className="jsec-sub">
          A DNS query says which sites you’re about to visit. Classic DNS sends it in <strong>plaintext</strong>, so your network and
          ISP read every name. DoT, DoH and DoQ wrap the same messages in TLS/QUIC — but they leak different amounts. Pick a transport
          and watch what an on-path observer captures.
        </p>

        <label className="ed-field"><span>look up</span>
          <input value={qname} onChange={(e) => setQname(e.target.value)} spellCheck={false} /></label>

        <div className="ed-tabs">
          {TRANSPORTS.map((tr) => (
            <button key={tr.id} className={tr.id === id ? 'on' : ''} onClick={() => setId(tr.id)}>
              {tr.id} <span className="ed-port">:{tr.port}</span>
            </button>
          ))}
        </div>

        <div className="ed-wire">
          <div className="ed-wire-h">on the wire — what a passive observer captures</div>
          {rows.map((r, i) => (
            <div key={i} className={`ed-row ${r.opaque ? 'opaque' : ''}`}>
              <span className="ed-row-l">{r.label}</span>
              <span className="ed-row-v">{r.opaque ? <>🔒 {r.value}</> : r.value}</span>
            </div>
          ))}
        </div>

        <div className="ed-learns">
          <span className="ed-learns-l">observer learns:</span>
          <Badge on={t.sees.name} hidden label="the query name" />
          <Badge on={t.sees.isDns} hidden label="that it’s DNS" />
          <Badge on={t.sees.resolver} label="the resolver IP" />
        </div>
        <div className="ed-blurb">{t.blurb}</div>

        <table className="ed-table">
          <thead><tr><th>transport</th><th>port</th><th>encrypted</th><th>name hidden</th><th>looks like DNS?</th></tr></thead>
          <tbody>
            {TRANSPORTS.map((tr) => (
              <tr key={tr.id} className={tr.id === id ? 'on' : ''} onClick={() => setId(tr.id)}>
                <td>{tr.id}</td><td>{tr.port}</td>
                <td>{tr.encrypted ? '✓' : '—'}</td>
                <td>{!tr.sees.name ? '✓' : '—'}</td>
                <td>{tr.sees.isDns ? 'yes (visible)' : 'no (hidden in HTTPS)'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="ed-note">
          Encryption hides the <em>name</em>, not the <em>connection</em>: you always reveal the resolver you talk to, and the very
          next thing you do is open a TLS connection whose <strong>SNI</strong> can name the site anyway — which is why Encrypted
          ClientHello (ECH) matters. DoH’s real advantage is blending into 443 so it can’t be singled out and blocked. None of these
          stop the resolver itself from logging you — that’s a trust choice, not a crypto one.
        </p>
      </section>
    </div>
  );
}
