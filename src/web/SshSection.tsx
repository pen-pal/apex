// SSH transport, made visible. Step the handshake and watch encryption flip on at
// NEWKEYS — everything from user-auth onward is sealed, so your password never crosses
// the wire in the clear. Then the host-key check: trust-on-first-use, a match on
// return, or a loud refusal when the fingerprint changes (a man-in-the-middle). Model
// in ssh.ts (tested).
import { useState } from 'react';
import { handshake, verifyHost, type SshStep } from './ssh';

const steps = handshake();
const PHASE: Record<SshStep['phase'], string> = { setup: 'setup', kex: 'key exchange', auth: 'authentication', channel: 'channels' };

export function SshSection() {
  const [i, setI] = useState(0);
  const [scenario, setScenario] = useState<'first' | 'return' | 'mitm'>('first');
  const s = steps[i];

  const known = scenario === 'first' ? null : 'SHA256:9bX…k2';
  const presented = scenario === 'mitm' ? 'SHA256:ev1L…xx' : 'SHA256:9bX…k2';
  const host = verifyHost(known, presented);

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>① The handshake — encryption before any secret</h2></div>
        <p className="jsec-sub">
          SSH builds an encrypted, authenticated tunnel <em>first</em>, then authenticates you inside it. The key exchange runs in
          the clear (it’s designed to), the server proves its identity by signing the transcript with its host key, and{' '}
          <strong>NEWKEYS</strong> flips encryption on — so your password or key never touches the network unprotected.
        </p>

        <div className="ssh-steps">
          {steps.map((st, k) => (
            <button key={st.n} className={`ssh-dot ${st.phase} ${k === i ? 'on' : ''} ${st.enc}`} onClick={() => setI(k)} title={st.msg}>
              {st.enc === 'encrypted' ? '🔒' : ''}{st.n}
            </button>
          ))}
        </div>

        <div className={`ssh-card ${s.enc}`}>
          <div className="ssh-card-h">
            <span className={`ssh-phase ${s.phase}`}>{PHASE[s.phase]}</span>
            <span className="ssh-msg">{s.msg}</span>
            <span className={`ssh-enc ${s.enc}`}>{s.enc === 'encrypted' ? '🔒 encrypted' : '🔓 plaintext'}</span>
          </div>
          <div className="ssh-route">{s.from} → {s.to}</div>
          <div className="ssh-note">{s.note}</div>
          {s.msg === 'NEWKEYS' && <div className="ssh-newkeys">— encryption is now on; every packet below is sealed —</div>}
        </div>
        <div className="ssh-nav">
          <button onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0}>◀ prev</button>
          <span>step {s.n} / {steps.length}</span>
          <button onClick={() => setI(Math.min(steps.length - 1, i + 1))} disabled={i === steps.length - 1}>next ▶</button>
        </div>
      </section>

      <section className="jsec">
        <div className="jsec-head"><h2>② Host-key verification (known_hosts)</h2></div>
        <p className="jsec-sub">
          The server’s host-key signature only means something if you know the key is really <em>that</em> server’s. SSH uses
          trust-on-first-use: it remembers the fingerprint, and screams if it ever changes.
        </p>
        <div className="ssh-scn">
          <button className={scenario === 'first' ? 'on' : ''} onClick={() => setScenario('first')}>first connection</button>
          <button className={scenario === 'return' ? 'on' : ''} onClick={() => setScenario('return')}>returning</button>
          <button className={scenario === 'mitm' ? 'on' : ''} onClick={() => setScenario('mitm')}>fingerprint changed</button>
        </div>
        <div className={`ssh-host ${host}`}>
          {host === 'tofu' && <>🔑 <strong>The authenticity of host ‘server’ can’t be established.</strong> Fingerprint <code>{presented}</code>. Accept? → stored in <code>known_hosts</code> (trust on first use).</>}
          {host === 'trusted' && <>✅ Fingerprint <code>{presented}</code> matches <code>known_hosts</code> — same server as before, connecting.</>}
          {host === 'changed' && <>⚠️ <strong>REMOTE HOST IDENTIFICATION HAS CHANGED!</strong> Stored <code>{known}</code> ≠ presented <code>{presented}</code>. Someone could be eavesdropping (man-in-the-middle). SSH <strong>refuses to connect</strong>.</>}
        </div>
        <p className="ssh-foot">
          That TOFU model is SSH’s pragmatic answer to the PKI problem — no certificate authority, just a fingerprint you pin on
          first contact (ideally verified out-of-band). It’s why a server reinstall triggers the scary warning, and why an actual
          MITM can’t silently slip in once you’ve connected once.
        </p>
      </section>
    </div>
  );
}
