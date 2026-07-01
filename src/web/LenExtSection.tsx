// The length-extension attack, made visible. A server authenticates a message with tag = H(secret ‖ message)
// and publishes the tag. You play the attacker: you never see the secret, but you know the tag, the message,
// and the secret's length. Type an extension and watch a VALID tag appear for "message ‖ glue ‖ extension" —
// the server recomputes its own MAC over your forged message and it matches. Flip to HMAC and the same trick
// fails: the nested hash hides the state, so there's nothing to extend. Real model from lenext.ts.
import { useMemo, useState } from 'react';
import { macNaive, extend, hmac, mdPad, strBytes, hex } from './lenext';

const SECRET = strBytes('S3cr3tKey'); // the attacker never sees this
const bytesHex = (b: number[]) => b.map((x) => x.toString(16).padStart(2, '0')).join(' ');
const printable = (b: number[]) => b.map((x) => (x >= 32 && x < 127 ? String.fromCharCode(x) : '·')).join('');

export function LenExtSection() {
  const [message, setMessage] = useState('user=guest');
  const [evil, setEvil] = useState('&admin=true');
  const [mode, setMode] = useState<'naive' | 'hmac'>('naive');

  const view = useMemo(() => {
    const msg = strBytes(message), ext = strBytes(evil);
    const mac = (m: number[]) => (mode === 'naive' ? macNaive(SECRET, m) : hmac(SECRET, m));
    const tag = mac(msg);
    const { forgedTag, suffix } = extend(tag, SECRET.length + msg.length, ext); // attacker: no secret used
    const serverTag = mac(msg.concat(suffix)); // server recomputes over the forged message
    const glue = mdPad(SECRET.length + msg.length);
    return { tag, forgedTag, serverTag, suffix, glue, ext, accepted: forgedTag === serverTag };
  }, [message, evil, mode]);

  return (
    <div className="lxt">
      <p className="lxt-intro">
        A server authenticates data with <code>tag = H(secret ‖ message)</code> and publishes the tag. You're an
        off-path attacker: you <strong>never learn the secret</strong>, but you know the tag, the message, and
        the secret's length. Because a Merkle–Damgård digest <strong>is</strong> the hash's internal state, you
        can resume from the tag and append your own bytes.
      </p>

      <div className="lxt-modes">
        <button type="button" className={`lxt-mode ${mode === 'naive' ? 'on' : ''}`} onClick={() => setMode('naive')}>naive MAC: H(secret ‖ msg)</button>
        <button type="button" className={`lxt-mode ${mode === 'hmac' ? 'on' : ''}`} onClick={() => setMode('hmac')}>HMAC(secret, msg)</button>
      </div>

      <div className="lxt-row">
        <div className="lxt-secret" title="the attacker never sees this">🔒 secret = <span>•••••••••</span> ({SECRET.length} bytes, length known)</div>
      </div>

      <label className="lxt-field">message (public)<input value={message} onChange={(e) => setMessage(e.target.value)} spellCheck={false} /></label>

      <div className="lxt-server">
        <span className="lxt-tag-lbl">server publishes tag =</span> <code className="lxt-tag">{hex(view.tag)}</code>
      </div>

      <div className="lxt-attack">
        <div className="lxt-ah">😈 attacker (no secret)</div>
        <label className="lxt-field">append extension<input value={evil} onChange={(e) => setEvil(e.target.value)} spellCheck={false} /></label>
        <div className="lxt-forged">
          <div className="lxt-fmsg">
            <span>forged message the server will accept:</span>
            <div className="lxt-msgbytes">
              <span className="mp msg">{message}</span>
              <span className="mp glue" title={bytesHex(view.glue)}>‖ glue[{view.glue.length}B] {printable(view.glue)}</span>
              <span className="mp ext">‖ {evil}</span>
            </div>
          </div>
          <div className="lxt-ftag"><span>forged tag =</span> <code>{hex(view.forgedTag)}</code></div>
        </div>
      </div>

      <div className={`lxt-verdict ${view.accepted ? 'bad' : 'good'}`}>
        <div className="lxt-vrow"><span>server recomputes {mode === 'naive' ? 'H(secret ‖ forged-msg)' : 'HMAC(secret, forged-msg)'} =</span> <code>{hex(view.serverTag)}</code></div>
        <div className="lxt-vresult">
          {view.accepted
            ? '⚠ FORGERY ACCEPTED — the forged tag matches. The attacker authenticated “' + printable(view.ext) + '” without ever knowing the secret.'
            : '✓ FORGERY REJECTED — the tags differ. HMAC’s outer hash hides the internal state, so there is nothing to length-extend.'}
        </div>
      </div>

      <p className="lxt-foot">
        The root cause is that Merkle–Damgård hashes (MD5, SHA-1, SHA-256) leak their full internal state as the
        output, and process input block by block — so a digest is a perfectly good "resume point." That makes
        <code> H(secret ‖ message)</code> forgeable: the attacker appends the message's own padding (the "glue")
        plus anything they want and cranks the compression function forward from the published tag. It bit real
        systems (Flickr's API signature, others). Fixes, in order of preference: use <strong>HMAC</strong>
        (RFC 2104) — its nested <code>H(k⊕opad ‖ H(k⊕ipad ‖ m))</code> never exposes an extendable state; or use
        a hash that isn't length-extendable (<strong>SHA-3/Keccak</strong>, or SHA-512/256 which truncates its
        state); or at minimum key the hash on the <em>other</em> side, <code>H(message ‖ secret)</code>, though
        that has its own collision pitfalls. Never roll your own MAC — reach for HMAC. (RFC 2104.)
      </p>
    </div>
  );
}
