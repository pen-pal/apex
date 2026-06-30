// Open redirect, made visible. A login link carries ?next=<target> and the app redirects there afterward.
// Type a target (or pick a payload) and watch how a BROWSER actually resolves it relative to the trusted
// origin — then see whether it stays on-site or quietly escapes to an attacker's host. The tricks are the
// lesson: a backslash becomes a slash, an @ hides the real host, a leading // is scheme-relative. Real
// model from openredirect.ts.
import { useState } from 'react';
import { classify } from './openredirect';

const ORIGIN = 'trusted.com';
const ALLOW = ['login.trusted.com'];

const PAYLOADS: { t: string; note: string }[] = [
  { t: '/dashboard', note: 'an ordinary relative path — safe' },
  { t: 'https://trusted.com/account', note: 'absolute, same host — safe' },
  { t: 'https://login.trusted.com/cb', note: 'an allowlisted host — safe' },
  { t: 'https://evil.com', note: 'a blunt off-site redirect' },
  { t: '//evil.com', note: 'scheme-relative — no http: needed' },
  { t: '/\\evil.com', note: 'backslash trick: looks like a path, browser goes off-site' },
  { t: 'https://trusted.com@evil.com', note: 'userinfo @ — the real host is after the @' },
  { t: 'https://trusted.com.evil.com', note: 'look-alike subdomain suffix' },
];

export function OpenRedirectSection() {
  const [target, setTarget] = useState('/\\evil.com');
  const v = classify(target, ORIGIN, ALLOW);

  return (
    <div className="oredir">
      <p className="oredir-intro">
        After login an app redirects to <code>?next=…</code>. If you can make that value point off-site, you
        get a link that <strong>starts on {ORIGIN}</strong> — which the victim trusts — but <strong>lands on
        your server</strong>. Great for phishing, and a classic way to steal OAuth tokens when
        <code> redirect_uri</code> is checked loosely. The hard part: browsers resolve URLs far more liberally
        than a naïve “does it start with /” check assumes.
      </p>

      <div className="oredir-bar">
        <span className="oredir-origin">https://{ORIGIN}/login?next=</span>
        <input className="oredir-input" value={target} onChange={(e) => setTarget(e.target.value)} spellCheck={false} />
      </div>

      <div className={`oredir-verdict ${v.safe ? 'safe' : 'danger'}`}>
        <div className="oredir-flow">
          <span className="oredir-node start">{ORIGIN}</span>
          <span className="oredir-arrow">browser resolves →</span>
          <span className={`oredir-node end ${v.safe ? 'ok' : 'bad'}`}>{v.effectiveHost ?? `${ORIGIN} (same origin)`}</span>
        </div>
        <div className="oredir-tag">
          <span className={`oredir-kind ${v.kind}`}>{v.kind}</span>
          <span className="oredir-msg">{v.safe ? '✓ stays on a trusted origin' : '✗ escapes to an untrusted host'}</span>
        </div>
        <div className="oredir-reason">{v.reason}{v.trick && <span className="oredir-trick"> — trick: {v.trick}</span>}</div>
      </div>

      <div className="oredir-payloads">
        <div className="oredir-ph">Try a payload:</div>
        {PAYLOADS.map((p) => (
          <button key={p.t} type="button" className={`oredir-pbtn ${target === p.t ? 'on' : ''}`} onClick={() => setTarget(p.t)}>
            <code>{p.t}</code><span>{p.note}</span>
          </button>
        ))}
      </div>

      <p className="oredir-foot">
        The right defense is <strong>not</strong> a blocklist of tricky strings — there are too many. Allowlist
        the handful of destinations you actually need, or only ever redirect to a <strong>relative path you
        rebuild yourself</strong> (strip the scheme and host, keep just the path). For OAuth, match
        <code> redirect_uri</code> against pre-registered values <strong>exactly</strong> (full string, not a
        prefix or host-suffix). When you must echo a host, parse it with the platform URL parser and compare
        the resolved host to your allowlist — never with a hand-rolled regex. (OWASP: Unvalidated Redirects
        and Forwards.)
      </p>
    </div>
  );
}
