// Content-Security-Policy, made visible. Edit a policy and fire a battery of resource
// loads — inline scripts, eval, scripts/styles/images from various hosts, a nonce'd
// script — and watch the browser allow or block each, with the directive and reason that
// decided it. Pairs with the injection section: escaping stops most XSS, CSP is the net
// underneath. Real policy engine in csp.ts (tested against the CSP rules).
import { useMemo, useState } from 'react';
import { parsePolicy, evaluate, type Load } from './csp';

const PAGE = 'app.example.com';

const LOADS: { label: string; load: Load }[] = [
  { label: 'inline <script>alert(1)</script>', load: { type: 'script', kind: 'inline' } },
  { label: 'inline <script nonce="r4nd0m">', load: { type: 'script', kind: 'inline', nonce: 'r4nd0m' } },
  { label: 'eval("…")', load: { type: 'script', kind: 'eval' } },
  { label: 'script from app.example.com', load: { type: 'script', kind: 'url', url: 'https://app.example.com/app.js' } },
  { label: 'script from cdn.example.com', load: { type: 'script', kind: 'url', url: 'https://cdn.example.com/lib.js' } },
  { label: 'script from evil.com', load: { type: 'script', kind: 'url', url: 'https://evil.com/x.js' } },
  { label: 'image from anywhere.net', load: { type: 'img', kind: 'url', url: 'https://anywhere.net/p.png' } },
  { label: 'style from fonts.example.com', load: { type: 'style', kind: 'url', url: 'https://fonts.example.com/s.css' } },
];

const PRESETS = [
  "default-src 'self'",
  "default-src 'self'; script-src 'self' cdn.example.com; img-src *",
  "default-src 'none'; script-src 'nonce-r4nd0m'; style-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
];

export function CspSection() {
  const [policy, setPolicy] = useState(PRESETS[1]);
  const parsed = useMemo(() => parsePolicy(policy), [policy]);
  const results = useMemo(() => LOADS.map((l) => ({ ...l, d: evaluate(parsed, l.load, PAGE) })), [parsed]);
  const blocked = results.filter((r) => !r.d.allowed).length;

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Content-Security-Policy — what is allowed to run</h2></div>
        <p className="jsec-sub">
          Escaping stops most injected markup from becoming HTML; CSP is the layer underneath that stops anything that slips through from
          actually <em>running</em>. The server sends a policy naming the allowed sources per resource type, and the browser
          (page origin <code>{PAGE}</code>) enforces it. Edit the policy and watch each load get allowed or blocked.
        </p>

        <textarea className="csp-policy" value={policy} onChange={(e) => setPolicy(e.target.value)} spellCheck={false} rows={2} />
        <div className="csp-presets">
          {PRESETS.map((p, i) => <button key={i} onClick={() => setPolicy(p)} className={policy === p ? 'on' : ''}>preset {i + 1}</button>)}
        </div>

        <div className="csp-summary">{results.length - blocked} allowed · <b>{blocked}</b> blocked</div>

        <div className="csp-loads">
          {results.map((r, i) => (
            <div key={i} className={`csp-load ${r.d.allowed ? 'ok' : 'bad'}`}>
              <span className="csp-verdict">{r.d.allowed ? '✓' : '✗'}</span>
              <span className="csp-what">{r.label}</span>
              <span className="csp-dir">{r.d.directive}</span>
              <span className="csp-reason">{r.d.reason}</span>
            </div>
          ))}
        </div>

        <p className="csp-foot">
          The big wins come from refusing <code>'unsafe-inline'</code> and <code>'unsafe-eval'</code>: an injected
          <code> &lt;script&gt;</code> simply won’t execute. Modern policies use a per-response <strong>nonce</strong> (or a hash) so only
          the server’s own inline scripts run — note how preset 3 allows the nonce’d script but blocks the plain inline one. CSP also
          restricts where data can be <em>sent</em> (<code>connect-src</code>, <code>form-action</code>), limiting exfiltration even if
          script does run.
        </p>
      </section>
    </div>
  );
}
