// WPA2 4-way handshake, made visible. The AP and station share a PMK (from the Wi-Fi
// password); step through the four messages and watch each side gather the nonces and
// derive the SAME session key (PTK) without ever transmitting it. Change a nonce and the
// key changes — fresh per session. Real HMAC derivation in wpa.ts (tested).
import { useMemo, useState } from 'react';
import { handshake } from './wpa';

const PMK = 'pmk◂password';
const AP_MAC = 'aa:bb:cc:11:22:33';
const STA_MAC = 'dd:ee:ff:44:55:66';

export function WpaSection() {
  const [aNonce, setANonce] = useState('A-7f3c91');
  const [sNonce, setSNonce] = useState('S-2b8e04');
  const h = useMemo(() => handshake(PMK, AP_MAC, STA_MAC, aNonce, sNonce), [aNonce, sNonce]);
  const [step, setStep] = useState(4);

  const shown = Math.min(step, 4);
  const apKnows = shown >= 3;
  const staKnows = shown >= 2;
  const reseed = () => { setANonce('A-' + Math.random().toString(16).slice(2, 8)); setSNonce('S-' + Math.random().toString(16).slice(2, 8)); };

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>WPA2 4-way handshake — a session key from a shared password</h2></div>
        <p className="jsec-sub">
          Your device and the access point already share the <strong>PMK</strong> (derived from the Wi-Fi password). They never reuse it
          directly — instead they exchange two random <strong>nonces</strong> and each independently computes a fresh
          <strong> PTK</strong> for this session. The PTK encrypts your traffic and is <em>never</em> sent over the air; a MIC proves
          each side really knows the PMK.
        </p>

        <div className="wpa-parties">
          <div className={`wpa-party ${apKnows ? 'has' : ''}`}>
            <h3>📡 Access Point</h3>
            <div className="wpa-field">MAC <code>{AP_MAC}</code></div>
            <div className="wpa-field">PMK <code>shared secret</code></div>
            <div className="wpa-field">ANonce <code>{aNonce}</code></div>
            <div className="wpa-ptk">{apKnows ? <>PTK <code>{h.apPtk.slice(0, 24)}…</code></> : 'PTK: waiting for SNonce'}</div>
          </div>
          <div className={`wpa-party ${staKnows ? 'has' : ''}`}>
            <h3>📱 Station (you)</h3>
            <div className="wpa-field">MAC <code>{STA_MAC}</code></div>
            <div className="wpa-field">PMK <code>shared secret</code></div>
            <div className="wpa-field">SNonce <code>{sNonce}</code></div>
            <div className="wpa-ptk">{staKnows ? <>PTK <code>{h.staPtk.slice(0, 24)}…</code></> : 'PTK: waiting'}</div>
          </div>
        </div>

        <div className="wpa-msgs">
          {h.messages.map((m) => (
            <div key={m.n} className={`wpa-msg ${m.n <= shown ? 'sent' : ''} ${m.from === 'AP' ? 'ap' : 'sta'}`}>
              <span className="wpa-mnum">M{m.n}</span>
              <span className="wpa-arrow">{m.from === 'AP' ? '→' : '←'}</span>
              <span className="wpa-carries">{m.carries}</span>
              {m.n <= shown && <span className="wpa-mnote">{m.note}</span>}
            </div>
          ))}
        </div>

        <div className="wpa-controls">
          <button onClick={() => setStep(Math.max(0, shown - 1))} disabled={shown === 0}>◀</button>
          <span className="wpa-count">message {shown} / 4</span>
          <button onClick={() => setStep(shown + 1)} disabled={shown >= 4}>▶</button>
          <button onClick={reseed} className="wpa-reseed">↻ new nonces</button>
        </div>

        {shown >= 3 && (
          <div className={`wpa-verdict ${h.match ? 'ok' : 'bad'}`}>
            {h.match ? '🔐 Both sides derived the identical PTK — without it ever crossing the air. Encryption begins.' : 'PTK mismatch (shouldn’t happen with the same PMK).'}
            <div className="wpa-eq">PTK = PRF(PMK, “Pairwise key expansion”, sorted MACs ‖ sorted nonces)</div>
          </div>
        )}

        <p className="wpa-foot">
          The nonces make every session’s key unique, so capturing the handshake doesn’t reveal past or future keys. What it <em>does</em>
          allow is an offline dictionary attack on a weak password — the captured nonces + MIC let an attacker test guesses, which is why
          Wi-Fi passwords should be long. The infamous <strong>KRACK</strong> attack forced a nonce reset (replaying message 3) to make
          the device reinstall an already-used key; WPA3’s SAE handshake replaces this scheme with a password-authenticated key exchange
          that resists offline guessing entirely.
        </p>
      </section>
    </div>
  );
}
