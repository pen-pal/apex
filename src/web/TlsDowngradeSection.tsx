// TLS cipher-suite negotiation and the downgrade attack. The client offers suites
// strongest-first; the server picks the best it shares. An on-path attacker editing
// the ClientHello strips the strong ones to force a breakable suite — until the
// handshake is integrity-protected. Model in tlsneg.ts (tested).
import { useState } from 'react';
import { SUITES, negotiate, strip, isDowngrade, type Strength } from './tlsneg';

const CAPS: { cap: Strength; label: string }[] = [
  { cap: 'strong', label: 'no attack' },
  { cap: 'legacy', label: 'strip → legacy' },
  { cap: 'weak', label: 'strip → weak' },
  { cap: 'broken', label: 'strip → export only' },
];

export function TlsDowngradeSection() {
  const [cap, setCap] = useState<Strength>('strong');
  const [auth, setAuth] = useState(false);

  const honest = negotiate(SUITES, SUITES)!; // the suite an untouched handshake reaches
  const offered = strip(SUITES, cap); // what the server sees after the attacker
  const survived = new Set(offered.map((s) => s.id));
  const actual = negotiate(offered, SUITES)!;
  const downgraded = isDowngrade(honest, actual);
  const detected = auth && downgraded;
  const verdict = detected ? 'detected' : downgraded ? 'broken' : 'secure';

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Cipher-suite negotiation &amp; the downgrade attack</h2></div>
        <p className="jsec-sub">
          The ClientHello offers cipher suites in preference order; the server picks the strongest it also supports. But the offer
          travels <em>before</em> any encryption exists, so an active attacker can <strong>edit it</strong> — deleting the strong
          suites so the server is forced onto a weak, breakable one. FREAK, Logjam, POODLE and Sweet32 were all this attack.
        </p>

        <div className="tn-row">
          <span className="tn-row-l">attacker:</span>
          {CAPS.map((c) => (
            <button key={c.cap} className={`tn-cap ${cap === c.cap ? 'on' : ''}`} onClick={() => setCap(c.cap)}>{c.label}</button>
          ))}
        </div>

        <div className="tn-suites">
          <div className="tn-suites-h">ClientHello — offered cipher suites</div>
          {SUITES.map((s) => {
            const removed = !survived.has(s.id);
            const chosen = s.id === actual.id;
            return (
              <div key={s.id} className={`tn-suite ${s.strength} ${removed ? 'removed' : ''} ${chosen ? 'chosen' : ''}`}>
                <span className="tn-s-id">{s.id}</span>
                <span className="tn-s-enc">{s.enc}{s.fs ? '' : ' · no FS'}</span>
                <span className={`tn-s-str ${s.strength}`}>{s.strength}</span>
                {chosen && <span className="tn-s-pick">← server picks</span>}
                {removed && <span className="tn-s-cut">✂ stripped</span>}
              </div>
            );
          })}
        </div>

        <label className="tn-toggle"><input type="checkbox" checked={auth} onChange={(e) => setAuth(e.target.checked)} /> integrity-protect the handshake (Finished MAC over the transcript)</label>

        <div className={`tn-verdict ${verdict}`}>
          {verdict === 'secure' && <>🔒 Negotiated <strong>{actual.id}</strong> ({actual.enc}) — the strongest both sides support, untouched.</>}
          {verdict === 'broken' && <>☠️ Forced down to <strong>{actual.id}</strong> — <strong>{actual.attack}</strong>. The attacker can now break the session, and nothing in the handshake noticed the offer was edited.</>}
          {verdict === 'detected' && <>🛡️ Downgrade <strong>detected</strong>. The Finished MAC covers the whole handshake transcript, so the edited ClientHello doesn’t match what the client actually sent — the MAC fails and the connection aborts.</>}
        </div>

        <p className="tn-note">
          Two protections make this stick in modern TLS: the <strong>Finished</strong> message MACs the entire handshake transcript
          (any tampering changes the hash, so both ends abort), and a TLS 1.3 server that negotiates an older version writes a fixed{' '}
          <strong>downgrade sentinel</strong> into the last bytes of its ServerRandom — a 1.3-capable client sees it and refuses.
          Removing export ciphers and SSLv3/RC4/3DES from servers entirely is what finally closed FREAK, Logjam and POODLE for good.
        </p>
      </section>
    </div>
  );
}
