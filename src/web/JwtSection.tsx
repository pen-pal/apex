// JWT, made visible. A real HS256 token shown jwt.io-style — header (red), payload (purple), signature (blue) —
// with the decoded claims. Toggle the admin claim and see the signature change; then forge an alg=none token and
// watch a naive verifier accept the unsigned forgery while a strict verifier (server fixes the algorithm) rejects
// it. Signing and verification are real HMAC-SHA256. Real model from jwt.ts.
import { useEffect, useState } from 'react';
import { signHS256, verifyNaive, verifyStrict, forgeAlgNone, decodeJwt, type Verdict } from './jwt';

const SECRET = 'your-256-bit-secret';

function ColoredToken({ token }: { token: string }) {
  const [h, p, s] = token.split('.');
  return (
    <div className="jwv-token">
      <span className="jwv-h">{h}</span><span className="jwv-dot">.</span>
      <span className="jwv-p">{p}</span><span className="jwv-dot">.</span>
      <span className="jwv-s">{s || '∅'}</span>
    </div>
  );
}

export function JwtSection() {
  const [admin, setAdmin] = useState(false);
  const [forged, setForged] = useState(false);
  const [token, setToken] = useState('');
  const [naive, setNaive] = useState<Verdict | null>(null);
  const [strict, setStrict] = useState<Verdict | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const legit = await signHS256({ alg: 'HS256', typ: 'JWT' }, { sub: 'alice', name: 'Alice', admin, iat: 1516239022 }, SECRET);
      const tok = forged ? forgeAlgNone(legit, { admin: true, name: 'attacker' }) : legit;
      const [n, st] = [await verifyNaive(tok, SECRET), await verifyStrict(tok, SECRET)];
      if (live) { setToken(tok); setNaive(n); setStrict(st); }
    })();
    return () => { live = false; };
  }, [admin, forged]);

  const dec = token ? decodeJwt(token) : null;

  return (
    <div className="jwv">
      <p className="jwv-intro">
        After you log in, the server hands you a <strong>JWT</strong> — a small signed <em>ticket</em> you present on every
        later request to prove who you are, so you never resend your password. It is three base64url parts —
        <span className="jwv-h"> header</span>.<span className="jwv-p">payload</span>.<span className="jwv-s">signature</span> — that are
        <strong> signed, not encrypted</strong>: anyone can read the claims (it is just base64), but only the holder of the
        server’s secret key can produce a valid signature (here HMAC-SHA256 over <code>header.payload</code>). So if you can
        trick the server into accepting a token <em>you</em> forged, you log in as anyone. The token:
      </p>

      <ColoredToken token={token} />

      {dec && (
        <div className="jwv-decoded">
          <div className="jwv-part"><span className="jwv-lbl h">header</span><pre>{JSON.stringify(dec.header, null, 1)}</pre></div>
          <div className="jwv-part"><span className="jwv-lbl p">payload</span><pre>{JSON.stringify(dec.payload, null, 1)}</pre></div>
        </div>
      )}

      <div className="jwv-controls">
        <label className="jwv-toggle"><input type="checkbox" checked={admin} disabled={forged} onChange={(e) => setAdmin(e.target.checked)} /> claim <code>admin: true</code> (re-signs honestly)</label>
        <button type="button" className={`jwv-attack ${forged ? 'on' : ''}`} onClick={() => setForged((f) => !f)}>{forged ? '↩ back to a real token' : '🔓 forge an alg=none token'}</button>
      </div>

      {naive && strict && (
        <div className="jwv-verdicts">
          <div className={`jwv-verdict ${naive.valid ? (forged ? 'bad' : 'ok') : 'ok'}`}>
            <span className="jwv-vh">naive verifier <em>(reads alg from the header)</em></span>
            <span className="jwv-vv">{naive.valid ? '✓ ACCEPTED' : '✗ rejected'}</span>
            <span className="jwv-vn">{naive.reason}</span>
          </div>
          <div className={`jwv-verdict ${strict.valid ? 'ok' : 'good-reject'}`}>
            <span className="jwv-vh">strict verifier <em>(server fixes alg=HS256)</em></span>
            <span className="jwv-vv">{strict.valid ? '✓ accepted' : '✓ rejected'}</span>
            <span className="jwv-vn">{strict.reason}</span>
          </div>
        </div>
      )}

      {forged && (
        <div className="jwv-explain">
          The forged token has <b>no signature</b> and claims <code>admin: true</code>. The naive verifier reads
          <code> alg</code> from the attacker-controlled header, sees <code>"none"</code>, and skips the check —
          privilege escalation with no key. The strict verifier refuses any algorithm but the one the server
          chose, so the forgery never gets that far.
        </div>
      )}

      <p className="jwv-foot">
        Every JWT disaster comes from the same root cause: letting the <em>token</em> tell the server how to
        verify it. Besides <strong>alg=none</strong>, the other classic is <strong>RS256→HS256 key confusion</strong>:
        a server that verifies RS256 with an RSA <em>public</em> key can be fooled by a token whose header says
        HS256 and whose signature is an HMAC computed with that public key as the secret — and the public key is,
        by definition, public. A verifier that picks the algorithm from the header will happily HMAC-verify it.
        The fixes are all variations of "the server decides": pin the expected algorithm, use separate keys for
        separate algorithms, and prefer libraries whose verify call takes the algorithm as a required argument.
        Beyond signatures, remember what a JWT is <em>not</em>: it's not encrypted, so never put secrets in the
        payload (it's base64, not encryption — trivially readable); it's hard to revoke before expiry, so keep
        lifetimes short and pair them with a refresh-token flow or a deny-list for logout; and always validate the
        standard claims — <code>exp</code> (expiry), <code>nbf</code> (not-before), <code>iss</code>/<code>aud</code>
        (who issued it and who it's for) — since a valid signature only proves the token wasn't tampered with, not
        that it's meant for you. For genuine confidentiality there's JWE (encrypted JWTs), but for most auth the
        right answer is a signed JWT verified strictly. (RFC 7519/7515; the 2015 Auth0 disclosure that made
        alg=none infamous.)
      </p>
    </div>
  );
}
