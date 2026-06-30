// SSRF, made visible. The server fetches a URL you give it; enter an attack URL and watch where the
// request actually goes — out to the public internet, or inward to localhost, the private network, or the
// cloud metadata endpoint that hands back IAM credentials. Toggle SSRF protection (an internal-IP
// denylist) and watch the dangerous fetches get blocked while the legitimate one still works. Real
// classifier from ssrf.ts.
import { useMemo, useState } from 'react';
import { evaluate, type Category } from './ssrf';

const PRESETS: { label: string; url: string }[] = [
  { label: 'legit image', url: 'https://cdn.example.com/avatar.png' },
  { label: '☁ metadata', url: 'http://169.254.169.254/latest/meta-data/iam/security-credentials/' },
  { label: 'internal redis', url: 'http://localhost:6379' },
  { label: 'internal host', url: 'http://10.0.0.5/admin' },
];
const ZONE: Record<Category, { zone: string; icon: string }> = {
  public: { zone: 'public internet', icon: '🌐' },
  metadata: { zone: 'cloud metadata (169.254.169.254)', icon: '☁️' },
  loopback: { zone: 'localhost services', icon: '🔁' },
  private: { zone: 'internal network', icon: '🏠' },
  'link-local': { zone: 'link-local', icon: '🔗' },
};

export function SsrfSection() {
  const [url, setUrl] = useState('http://169.254.169.254/latest/meta-data/iam/security-credentials/');
  const [protection, setProtection] = useState(false);
  const r = useMemo(() => evaluate(url, protection), [url, protection]);
  const z = ZONE[r.category];

  return (
    <div className="ssrf">
      <div className="ssrf-bar">
        <label className="ssrf-url">server fetches URL <input value={url} spellCheck={false} onChange={(e) => setUrl(e.target.value)} /></label>
        <label className="ssrf-prot"><input type="checkbox" checked={protection} onChange={(e) => setProtection(e.target.checked)} /> SSRF protection (block internal IPs)</label>
      </div>
      <div className="ssrf-presets">{PRESETS.map((p) => <button key={p.label} type="button" onClick={() => setUrl(p.url)}>{p.label}</button>)}</div>

      <div className="ssrf-flow">
        <div className="ssrf-node">attacker</div>
        <span className="ssrf-arrow">→</span>
        <div className="ssrf-node srv">your server</div>
        <span className={`ssrf-arrow ${r.blocked ? 'blocked' : r.internal ? 'danger' : 'ok'}`}>{r.blocked ? '╳' : '→'}</span>
        <div className={`ssrf-target ${r.category} ${r.blocked ? 'blocked' : ''}`}>
          <span className="ssrf-ticon">{z.icon}</span>
          <span className="ssrf-tzone">{z.zone}</span>
          <span className="ssrf-thost">{r.host}</span>
        </div>
      </div>

      <div className={`ssrf-verdict ${r.blocked ? 'safe' : r.internal ? 'breach' : 'ok'}`}>
        {r.blocked
          ? <>🛡️ <b>BLOCKED</b> — the denylist rejected an internal target ({r.category}). The feature still works for public URLs.</>
          : r.internal
            ? <>🚨 <b>SSRF</b> — the server fetched an <b>internal</b> target. This {r.danger}.</>
            : <>✓ allowed — {r.danger}.</>}
      </div>

      <p className="ssrf-foot">
        The root cause is that your server is a <em>confused deputy</em>: it has network access the attacker doesn’t, and it’ll use that access on
        the attacker’s behalf. The crown-jewel target is the cloud <strong>metadata endpoint</strong> at 169.254.169.254 — one unauthenticated GET
        returns the instance’s IAM credentials (this is how the 2019 Capital One breach exfiltrated 100M records). Blocking the literal string
        “localhost” isn’t enough: attackers bypass it with <strong>DNS rebinding</strong> (a name that resolves to a public IP on first check, then
        to 127.0.0.1), redirects, IPv6, and decimal/octal IP encodings. Real defenses resolve the host and validate the <em>resolved</em> IP,
        re-check after every redirect, prefer an allowlist, and on AWS move to IMDSv2 (which requires a token a blind SSRF can’t obtain). (OWASP SSRF.)
      </p>
    </div>
  );
}
