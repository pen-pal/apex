// X3DH, made visible. Bob is OFFLINE — his prekey bundle sits on the server. Alice fetches it, makes a
// fresh ephemeral key, and combines four Diffie-Hellman results into a shared secret. When Bob later
// comes online he recomputes the same four DHs and derives the identical key — no live handshake. Each
// leg buys a security property. Real modular-exp DH (teaching group) + SHA-256 KDF, from x3dh.ts (tested).
import { useMemo } from 'react';
import { keypair, aliceDerive, bobDerive, LABELS, WHY } from './x3dh';

const p = 2147483647n, g = 7n;
const kp = (priv: bigint) => keypair(priv, p, g);
const ikA = kp(123456n), ekA = kp(777n);
const ikB = kp(999n), spkB = kp(424242n), opkB = kp(55555n);
const short = (b: bigint) => { const s = b.toString(); return s.length > 8 ? s.slice(0, 6) + '…' : s; };

export function X3dhSection() {
  const { alice, bob } = useMemo(() => ({
    alice: aliceDerive(p, ikA, ekA, ikB.pub, spkB.pub, opkB.pub),
    bob: bobDerive(p, ikB, spkB, opkB, ikA.pub, ekA.pub),
  }), []);
  const agree = alice.sk === bob.sk;

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>X3DH — agreeing on a key with someone who’s offline</h2></div>
        <p className="jsec-sub">
          Signal can start an encrypted chat with a contact who isn’t online. The trick is <strong>X3DH</strong>: Bob publishes a
          <strong> prekey bundle</strong> (identity key, a signed prekey, one-time prekeys) to the server ahead of time. Alice grabs it, adds a
          fresh <strong>ephemeral</strong> key, and folds <strong>four Diffie-Hellman</strong> results into one shared secret. Bob derives the
          same secret whenever he reconnects — no round trip needed.
        </p>

        <div className="x3dh-parties">
          <div className="x3dh-party">
            <div className="x3dh-phead">🟢 Alice (online)</div>
            <div className="x3dh-key">IK_A <code>{short(ikA.pub)}</code></div>
            <div className="x3dh-key eph">EK_A <code>{short(ekA.pub)}</code> <span>fresh ephemeral</span></div>
          </div>
          <div className="x3dh-server">
            <div className="x3dh-phead">🗄️ server — Bob’s prekey bundle</div>
            <div className="x3dh-key">IK_B <code>{short(ikB.pub)}</code></div>
            <div className="x3dh-key">SPK_B <code>{short(spkB.pub)}</code> <span>signed by IK_B</span></div>
            <div className="x3dh-key">OPK_B <code>{short(opkB.pub)}</code> <span>one-time</span></div>
            <div className="x3dh-offline">💤 Bob is offline</div>
          </div>
        </div>

        <div className="x3dh-legs">
          {LABELS.map((label, i) => (
            <div key={i} className="x3dh-leg">
              <div className="x3dh-lhead"><b>{label}</b><span className="x3dh-why">{WHY[i]}</span></div>
              <div className="x3dh-lval">
                <span>Alice computes <code>{short(alice.dh[i])}</code></span>
                <span className="x3dh-eq">{alice.dh[i] === bob.dh[i] ? '=' : '≠'}</span>
                <span>Bob computes <code>{short(bob.dh[i])}</code></span>
              </div>
            </div>
          ))}
        </div>

        <div className="x3dh-combine">↓ SK = SHA-256( DH1 ‖ DH2 ‖ DH3 ‖ DH4 )</div>
        <div className={`x3dh-sk ${agree ? 'ok' : 'no'}`}>
          <div className="x3dh-skrow">Alice’s session key <code>{alice.sk}</code></div>
          <div className="x3dh-skrow">Bob’s session key <code>{bob.sk}</code></div>
          <div className="x3dh-skverdict">{agree ? '✓ identical — and Bob was never online during the handshake' : '✗ mismatch'}</div>
        </div>

        <p className="x3dh-foot">
          Each leg earns its place: DH1 (Alice’s identity × Bob’s signed prekey) gives mutual authentication; the ephemeral in DH2–DH4 gives
          forward secrecy — steal today’s keys and you still can’t read yesterday’s messages, because that ephemeral is long gone. The one-time
          prekey (DH4) is used once and discarded for extra protection, and the whole thing is deniable (no signatures over the messages
          themselves). The resulting SK seeds the <strong>Double Ratchet</strong>, which takes over and rekeys every message from there. (Real
          X3DH runs on Curve25519; this uses a small prime-field group so the numbers are legible.)
        </p>
      </section>
    </div>
  );
}
