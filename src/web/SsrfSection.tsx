// SSRF, made visible — from the attacker's seat. The server fetches a URL you give it; point it inward and
// watch where the request actually lands. The point of the section: a naive string denylist ("block localhost /
// 127.0.0.1 / private ranges") is defeated because the OS resolver accepts the same address written as decimal,
// hex, octal, or a short form. Turn the denylist on, feed it an encoded internal IP, and watch it sail past to
// the cloud metadata endpoint — then switch to "resolve + check" and watch that same bypass get caught. Real
// classifier + inet_aton decoder from ssrf.ts.
import { useMemo, useState } from 'react';
import { evaluate, type Category, type Protection } from './ssrf';

const PRESETS: { label: string; url: string }[] = [
  { label: 'legit image', url: 'https://cdn.example.com/avatar.png' },
  { label: '☁ metadata (literal)', url: 'http://169.254.169.254/latest/meta-data/iam/security-credentials/' },
  { label: '🎭 metadata as decimal', url: 'http://2852039166/latest/meta-data/iam/security-credentials/' },
  { label: '🎭 metadata as hex', url: 'http://0xA9FEA9FE/latest/meta-data/' },
  { label: '🎭 redis as decimal', url: 'http://2130706433:6379' },
  { label: '🎭 loopback as octal', url: 'http://0177.0.0.1:6379' },
];
const ZONE: Record<Category, { zone: string; icon: string }> = {
  public: { zone: 'public internet', icon: '🌐' },
  metadata: { zone: 'cloud metadata (169.254.169.254)', icon: '☁️' },
  loopback: { zone: 'localhost services', icon: '🔁' },
  private: { zone: 'internal network', icon: '🏠' },
  'link-local': { zone: 'link-local', icon: '🔗' },
};
const MODES: { id: Protection; label: string }[] = [
  { id: 'off', label: 'no filter' },
  { id: 'naive', label: 'naive denylist (string match)' },
  { id: 'resolve', label: 'resolve + check IP' },
];

export function SsrfSection() {
  const [url, setUrl] = useState('http://2852039166/latest/meta-data/iam/security-credentials/');
  const [protection, setProtection] = useState<Protection>('naive');
  const r = useMemo(() => evaluate(url, protection), [url, protection]);
  const z = ZONE[r.category];

  return (
    <div className="ssrf">
      <div className="ssrf-bar">
        <label className="ssrf-url">server fetches URL <input value={url} spellCheck={false} onChange={(e) => setUrl(e.target.value)} /></label>
      </div>
      <div className="ssrf-presets">{PRESETS.map((p) => <button key={p.label} type="button" onClick={() => setUrl(p.url)}>{p.label}</button>)}</div>
      <div className="ssrf-prot-sel">
        <span className="ssrf-prot-lbl">server defense:</span>
        {MODES.map((m) => <button key={m.id} type="button" className={protection === m.id ? 'on' : ''} onClick={() => setProtection(m.id)}>{m.label}</button>)}
      </div>

      <div className="ssrf-flow">
        <div className="ssrf-node">attacker</div>
        <span className="ssrf-arrow">→</span>
        <div className="ssrf-node srv">your server</div>
        <span className={`ssrf-arrow ${r.blocked ? 'blocked' : r.internal ? 'danger' : 'ok'}`}>{r.blocked ? '╳' : '→'}</span>
        <div className={`ssrf-target ${r.category} ${r.blocked ? 'blocked' : ''}`}>
          <span className="ssrf-ticon">{z.icon}</span>
          <span className="ssrf-tzone">{z.zone}</span>
          <span className="ssrf-thost">{r.host}{r.note ? <em className="ssrf-note"> {r.note}</em> : null}</span>
        </div>
      </div>

      <div className={`ssrf-verdict ${r.bypassed || r.reached ? 'breach' : r.blocked ? 'safe' : 'ok'}`}>
        {r.bypassed
          ? <>🎭 <b>DENYLIST BYPASSED</b> — the filter checked the string “{r.host}” against its blocklist and let it through, but it <b>{r.note}</b>, an internal <b>{r.category}</b> target. This {r.danger}. A string denylist never runs the resolver — that is the bypass.</>
          : r.blocked
            ? <>🛡️ <b>BLOCKED</b> — {protection === 'resolve' ? <>the server resolved “{r.host}”{r.note ? ` (${r.note})` : ''} to an internal {r.category} address and refused it</> : <>the denylist matched an internal target ({r.category})</>}. Public URLs still work.</>
            : r.reached
              ? <>🚨 <b>SSRF</b> — the server fetched an <b>internal</b> {r.category} target{r.note ? ` (${r.note})` : ''}. This {r.danger}.</>
              : <>✓ allowed — {r.danger}.</>}
      </div>

      <p className="ssrf-foot">
        The root cause is that your server is a <em>confused deputy</em>: it has network access the attacker doesn’t, and it’ll use that access on
        the attacker’s behalf. The crown-jewel target is the cloud <strong>metadata endpoint</strong> at 169.254.169.254 — one unauthenticated GET
        returns the instance’s IAM credentials (this is how the 2019 Capital One breach exfiltrated 100M records). Blocking the literal string
        “localhost” isn’t enough, because the OS resolver accepts the same address written many ways: <strong>2852039166</strong>, <strong>0xA9FEA9FE</strong>,
        and <strong>0251.0376.0251.0376</strong> all connect to 169.254.169.254, and a denylist that only pattern-matched the dotted-decimal string never
        sees it. The bypass surface is wider still — <strong>DNS rebinding</strong> (a name that resolves to a public IP on first check, then to an
        internal one when actually fetched), open redirects to an internal URL, and IPv6-mapped forms. Robust defenses <strong>resolve the host and validate
        the resolved IP</strong> against a denylist (as the “resolve + check” mode does here), re-check after every redirect, prefer an allowlist, and on
        AWS move to IMDSv2 (which requires a token a blind SSRF can’t obtain). (OWASP SSRF.)
      </p>
    </div>
  );
}
