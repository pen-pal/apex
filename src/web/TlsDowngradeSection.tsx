// TLS cipher-suite negotiation and the downgrade attack. The client offers suites
// strongest-first; the server picks the best it shares. An on-path attacker editing
// the ClientHello strips the strong ones to force a breakable suite. The Finished MAC
// over the transcript catches that tampering — EXCEPT when the forced suite is export-
// grade, where the attacker recovers the master secret and forges a matching Finished
// (that exception is FREAK/Logjam). Model + honest verdict in tlsneg.ts (tested).
import { useState } from 'react';
import { SUITES, negotiate, strip, isDowngrade, outcome, type Strength } from './tlsneg';

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
  const verdict = outcome(actual, downgraded, auth); // 'secure' | 'detected' | 'forged' | 'broken'

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
              <div key={s.id} className={`tn-suite ${removed ? 'removed' : ''} ${chosen ? 'chosen' : ''}`}>
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
          {verdict === 'detected' && <>🛡️ Downgrade <strong>detected</strong>. The Finished MAC covers the whole transcript, and this suite’s key exchange is strong enough that the attacker can’t recover the master secret — so it can’t forge a matching Finished. The MAC mismatch aborts the connection.</>}
          {verdict === 'forged' && <>☠️ <strong>Finished MAC forged.</strong> The handshake WAS integrity-protected — but the attacker forced an <strong>export</strong> key exchange ({actual.enc}), broke it offline to recover the master secret, and computed a Finished MAC that matches the client’s transcript. Integrity didn’t help: the MAC is only as strong as the key exchange keying it. <strong>This is exactly FREAK / Logjam.</strong></>}
        </div>

        <p className="tn-note">
          The <strong>Finished</strong> message MACs the entire handshake transcript, so a stripped ClientHello normally makes the two
          ends compute different Finished values and abort — but that MAC is <em>only as strong as the key exchange keying it</em>. Force
          an <strong>export</strong> suite and the attacker recovers the master secret (factor the 512-bit RSA / solve the 512-bit DH
          offline) and forges a Finished that matches: that is precisely how <strong>FREAK</strong> and <strong>Logjam</strong> beat
          handshake integrity. Two things actually closed the hole — servers <strong>removing export/RC4/3DES/SSLv3 suites entirely</strong>{' '}
          (no weak target left to force), and, for <em>version</em> downgrade specifically, a TLS 1.3 server stamping a fixed{' '}
          <strong>downgrade sentinel</strong> into its <em>signed</em> ServerRandom that a 1.3-capable client refuses. Integrity buys you
          nothing when the crypto underneath it is breakable.
        </p>
      </section>
    </div>
  );
}
