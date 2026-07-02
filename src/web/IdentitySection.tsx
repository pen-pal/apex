// Identity & Auth — the things that prove *who* a request is from.
//   • JWT   — decode a token, see the claims anyone can read, verify the HS256
//             signature, and watch the `alg:none` forgery get flagged.
//   • TOTP  — the live 6-digit 2FA code (RFC 6238), with its HMAC truncation shown.
//   • OAuth — step through the Authorization Code + PKCE flow.
import { useEffect, useMemo, useState } from 'react';
import { decodeJwt, verifyHs256 } from './jwt';
import { hotpTrace, base32Decode, type HotpTrace } from './otp';
import { codeChallenge, runFlow, type Params } from './oauth';

const hx = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');

type Tool = 'jwt' | 'totp' | 'oauth';
const TOOLS: { id: Tool; label: string }[] = [
  { id: 'jwt', label: 'JWT decoder' },
  { id: 'totp', label: 'TOTP (2FA)' },
  { id: 'oauth', label: 'OAuth flow' },
];

export function IdentitySection() {
  const [tool, setTool] = useState<Tool>('jwt');
  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Identity &amp; Auth</h2></div>
        <p className="jsec-sub">How a system proves who you are and what you may do — tokens, one-time codes, and the
          delegated-access dance that powers “Sign in with…”.</p>
        <nav className="subtabs">
          {TOOLS.map((t) => <button key={t.id} className={tool === t.id ? 'on' : ''} onClick={() => setTool(t.id)}>{t.label}</button>)}
        </nav>
        {tool === 'jwt' && <JwtTool />}
        {tool === 'totp' && <TotpTool />}
        {tool === 'oauth' && <OAuthTool />}
      </section>
    </div>
  );
}

const SAMPLE_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

function JwtTool() {
  const [token, setToken] = useState(SAMPLE_JWT);
  const [secret, setSecret] = useState('your-256-bit-secret');
  const [verified, setVerified] = useState<boolean | null>(null);
  const parsed = useMemo(() => decodeJwt(token), [token]);

  useEffect(() => {
    let cancelled = false;
    if (!parsed.ok || parsed.alg !== 'HS256') { setVerified(null); return; }
    verifyHs256(token, secret).then((v) => { if (!cancelled) setVerified(v); }).catch(() => { if (!cancelled) setVerified(null); });
    return () => { cancelled = true; };
  }, [token, secret, parsed.ok, parsed.alg]);

  const parts = token.trim().split('.');
  return (
    <>
      <p className="jsec-sub">A JWT is <strong>signed, not encrypted</strong> — the header and payload are just
        base64url JSON that anyone can read. Only the signature (and the secret) stop forgery. Paste any token.</p>
      <textarea className="jwt-input" value={token} onChange={(e) => setToken(e.target.value)} spellCheck={false} rows={4} />
      {parts.length === 3 && (
        <div className="jwt-colored">
          <span className="jp h">{parts[0]}</span>.<span className="jp p">{parts[1]}</span>.<span className="jp s">{parts[2] || '∅'}</span>
        </div>
      )}
      {parsed.error && <p className="enc-err">{parsed.error}</p>}
      {parsed.warnings.map((w, i) => <p key={i} className="jwt-warn">⚠ {w}</p>)}
      {parsed.ok && (
        <>
          <div className="jwt-cols">
            <div className="jwt-box h"><div className="jb-title">HEADER · algorithm &amp; type</div>
              <pre>{JSON.stringify(parsed.header, null, 2)}</pre></div>
            <div className="jwt-box p"><div className="jb-title">PAYLOAD · claims</div>
              <pre>{JSON.stringify(parsed.payload, null, 2)}</pre></div>
          </div>
          {parsed.alg === 'HS256' ? (
            <div className="jwt-verify">
              <label className="crypto-input"><span>HMAC secret</span>
                <input value={secret} onChange={(e) => setSecret(e.target.value)} spellCheck={false} /></label>
              {verified === true && <span className="ed-ok">✓ signature valid — this secret signed the token.</span>}
              {verified === false && <span className="ed-bad">✗ signature does not match this secret.</span>}
            </div>
          ) : (
            <p className="enc-note">Live signature check here is for HS256; this token uses <code>{parsed.alg || 'none'}</code>.</p>
          )}
        </>
      )}
    </>
  );
}

function TotpTool() {
  const [b32, setB32] = useState('JBSWY3DPEHPK3PXP');
  const [tick, setTick] = useState(0);
  const [trace, setTrace] = useState<HotpTrace | null>(null);
  const [counter, setCounter] = useState(0);
  const [remain, setRemain] = useState(30);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const secret = base32Decode(b32);
      if (!secret.length) { setTrace(null); return; }
      const nowSec = Math.floor(Date.now() / 1000);
      const c = Math.floor(nowSec / 30);
      const tr = await hotpTrace(secret, c, 6);
      if (!cancelled) { setTrace(tr); setCounter(c); setRemain(30 - (nowSec % 30)); }
    })();
    return () => { cancelled = true; };
  }, [b32, tick]);

  return (
    <>
      <p className="jsec-sub">Your authenticator app and the server share one secret. Every 30 seconds both compute
        <code> HOTP(secret, unixtime/30)</code> — no network needed. The code below is <strong>live</strong> and matches
        what an RFC 6238 authenticator would show for this secret right now.</p>
      <label className="crypto-input"><span>shared secret (base32)</span>
        <input value={b32} onChange={(e) => setB32(e.target.value)} spellCheck={false} /></label>
      {trace ? (
        <>
          <div className="totp-code">
            <span className="tc-digits">{trace.code.slice(0, 3)}&nbsp;{trace.code.slice(3)}</span>
            <div className="tc-ring">
              <span className="tc-remain">{remain}s</span>
              <div className="tc-bar"><div className="tc-fill" style={{ width: `${(remain / 30) * 100}%` }} /></div>
            </div>
          </div>
          <div className="enc-grid">
            <Row k="time-step counter" val={`${counter}  (unixtime / 30)`} />
            <Row k="HMAC-SHA1(secret, counter)" val={hx(trace.hmac)} />
            <Row k="dynamic-trunc offset" val={`${trace.offset}  (last nibble of the HMAC)`} />
            <Row k="31-bit value mod 10⁶" val={`${trace.binary} → ${trace.code}`} />
          </div>
          <p className="enc-note">The offset picks 4 bytes from the HMAC, masks the sign bit, and takes the last 6
            decimal digits — that’s the entire mechanism. Lose the secret and 2FA is gone, which is why backup codes exist.</p>
        </>
      ) : <p className="enc-err">Enter a base32 secret (A–Z, 2–7).</p>}
    </>
  );
}

interface Step { from: string; to: string; label: string; detail: string }
const OAUTH_STEPS: Step[] = [
  { from: 'User', to: 'Client', label: '1 · “Log in with Acme”', detail: 'The user clicks login in your app (the Client).' },
  { from: 'Client', to: 'Browser', label: '2 · redirect to /authorize', detail: 'Client sends the browser to the Authorization Server with client_id, redirect_uri, scope, a random state (anti-CSRF) and a PKCE code_challenge.' },
  { from: 'Browser', to: 'Auth Server', label: '3 · authenticate + consent', detail: 'The user logs in at the Authorization Server and approves the requested scopes. The Client never sees the password.' },
  { from: 'Auth Server', to: 'Client', label: '4 · redirect back with ?code', detail: 'Browser is redirected to redirect_uri carrying a short-lived authorization code and the same state value.' },
  { from: 'Client', to: 'Auth Server', label: '5 · exchange code at /token', detail: 'The Client’s BACK END posts the code + client_secret + PKCE code_verifier. This server-to-server step keeps the secret out of the browser.' },
  { from: 'Auth Server', to: 'Client', label: '6 · access_token (+ refresh, id_token)', detail: 'The token endpoint returns an access token (and often a refresh token and OIDC id_token).' },
  { from: 'Client', to: 'Resource', label: '7 · call API with Bearer token', detail: 'The Client calls the Resource Server with Authorization: Bearer <access_token>. Done.' },
];

function OAuthTool() {
  const [i, setI] = useState(0);
  const [verifier, setVerifier] = useState('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk');
  const step = OAUTH_STEPS[i];
  const challenge = useMemo(() => codeChallenge(verifier), [verifier]);
  return (
    <>
      <p className="jsec-sub">OAuth 2.0 lets an app act on your behalf <em>without ever seeing your password</em>. This is
        the Authorization Code flow with <strong>PKCE</strong> — the current best practice. Step through it.</p>
      <div className="oauth-pkce">
        <div className="oauth-pkce-row"><span>code_verifier</span><input value={verifier} onChange={(e) => setVerifier(e.target.value)} spellCheck={false} /></div>
        <div className="oauth-pkce-arrow">BASE64URL( SHA-256( verifier ) ) =</div>
        <div className="oauth-pkce-row"><span>code_challenge</span><code>{challenge}</code></div>
        <p className="oauth-pkce-note">Live, real PKCE: the app sends only this <em>challenge</em> up front and proves it holds the
          matching <em>verifier</em> when redeeming the code — so a stolen code is useless. (RFC 7636 S256.)</p>
      </div>
      <div className="oauth-actors">
        {['User', 'Browser', 'Client', 'Auth Server', 'Resource'].map((a) => (
          <span key={a} className={`oa-actor ${step.from === a ? 'from' : ''} ${step.to === a ? 'to' : ''}`}>{a}</span>
        ))}
      </div>
      <div className="oauth-step">
        <div className="os-arrow">{step.from} → {step.to}</div>
        <div className="os-label">{step.label}</div>
        <div className="os-detail">{step.detail}</div>
      </div>
      <div className="oauth-nav">
        <button className="ghost small" disabled={i === 0} onClick={() => setI(i - 1)}>← back</button>
        <span className="os-count">{i + 1} / {OAUTH_STEPS.length}</span>
        <button className="ghost small" disabled={i === OAUTH_STEPS.length - 1} onClick={() => setI(i + 1)}>next →</button>
      </div>
      <div className="oauth-track">
        {OAUTH_STEPS.map((_, k) => <span key={k} className={`ot-dot ${k <= i ? 'on' : ''}`} onClick={() => setI(k)} />)}
      </div>
      <OAuthDefenses verifier={verifier} />
      <p className="enc-note"><strong>state</strong> blocks CSRF; <strong>PKCE</strong> (code_challenge/verifier) stops a
        stolen authorization code from being redeemed by an attacker; the <strong>client_secret</strong> never touches the browser.</p>
    </>
  );
}

function OAuthDefenses({ verifier }: { verifier: string }) {
  const params: Params = { clientId: 'app123', redirectUri: 'https://app.example/cb', scope: 'profile', state: 'xyz789', verifier };
  const honest = runFlow(params);
  const csrf = runFlow(params, { wrongState: true });
  const stolen = runFlow(params, { attackerStealsCode: true });
  const row = (label: string, f: ReturnType<typeof runFlow>) => (
    <div className={`oauth-def ${f.tokenIssued ? 'ok' : 'bad'}`}>
      <span className="oauth-def-k">{label}</span>
      <span className="oauth-def-v">{f.tokenIssued ? '✓ token issued' : `✗ ${f.reason}`}</span>
    </div>
  );
  return (
    <div className="oauth-defs">
      <div className="oauth-defs-h">Defenses in action (live):</div>
      {row('honest flow', honest)}
      {row('attacker replays response with wrong state', csrf)}
      {row('attacker steals the code, lacks the verifier', stolen)}
    </div>
  );
}

function Row({ k, val }: { k: string; val: string }) {
  return <div className="enc-line"><span className="k">{k}</span><code>{val}</code></div>;
}
