// CORS & the Same-Origin Policy, made visible. Set the page's origin, the URL it fetches,
// the request shape, and the server's CORS headers, then watch the browser decide: same
// origin (no checks), a simple cross-origin request (sent, but the response is hidden
// unless Allow-Origin matches), or a preflighted one (an OPTIONS asks permission first).
// The credentials toggle shows the stricter no-wildcard rule. Real logic in cors.ts.
import { useMemo, useState } from 'react';
import { evaluate, isSimple, type Request, type ServerCORS } from './cors';

const METHODS = ['GET', 'POST', 'PUT', 'DELETE'];
const CTYPES = ['', 'text/plain', 'application/json'];

export function CorsSection() {
  const [page, setPage] = useState('https://app.com');
  const [target, setTarget] = useState('https://api.example.com/data');
  const [method, setMethod] = useState('GET');
  const [contentType, setContentType] = useState('');
  const [customHeader, setCustomHeader] = useState(false);
  const [credentials, setCredentials] = useState(false);

  const [allowOrigin, setAllowOrigin] = useState('*');
  const [allowMethods, setAllowMethods] = useState('GET, POST');
  const [allowHeaders, setAllowHeaders] = useState('Content-Type');
  const [allowCredentials, setAllowCredentials] = useState(false);

  const req: Request = useMemo(() => ({
    method, contentType, credentials, customHeaders: customHeader ? ['X-Custom-Token'] : [],
  }), [method, contentType, credentials, customHeader]);

  const server: ServerCORS = useMemo(() => ({
    allowOrigin: allowOrigin.trim(),
    allowMethods: allowMethods.split(',').map((s) => s.trim()).filter(Boolean),
    allowHeaders: allowHeaders.split(',').map((s) => s.trim()).filter(Boolean),
    allowCredentials,
  }), [allowOrigin, allowMethods, allowHeaders, allowCredentials]);

  const decision = useMemo(() => {
    try { return evaluate(page, target, req, server); } catch { return null; }
  }, [page, target, req, server]);

  const simple = isSimple(req);

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Same-Origin Policy &amp; CORS — who is allowed to read this?</h2></div>
        <p className="jsec-sub">
          A browser will run a fetch to another site, but it hides the <em>response</em> from your JavaScript unless that site opts in
          with CORS headers. An origin is <strong>scheme + host + port</strong> — all three must match to skip the policy. Configure both
          sides and watch the decision.
        </p>

        <div className="cors-panels">
          <div className="cors-panel">
            <h3>🧭 The page &amp; request</h3>
            <label>page origin <input value={page} onChange={(e) => setPage(e.target.value)} spellCheck={false} /></label>
            <label>fetch URL <input value={target} onChange={(e) => setTarget(e.target.value)} spellCheck={false} /></label>
            <label>method
              <select value={method} onChange={(e) => setMethod(e.target.value)}>{METHODS.map((m) => <option key={m}>{m}</option>)}</select>
            </label>
            <label>Content-Type
              <select value={contentType} onChange={(e) => setContentType(e.target.value)}>{CTYPES.map((c) => <option key={c} value={c}>{c || '(none)'}</option>)}</select>
            </label>
            <label className="cors-chk"><input type="checkbox" checked={customHeader} onChange={(e) => setCustomHeader(e.target.checked)} /> send custom header <code>X-Custom-Token</code></label>
            <label className="cors-chk"><input type="checkbox" checked={credentials} onChange={(e) => setCredentials(e.target.checked)} /> send credentials (cookies)</label>
            <div className={`cors-kind ${simple ? 'simple' : 'pre'}`}>{simple ? 'simple request — no preflight' : 'non-simple — needs an OPTIONS preflight'}</div>
          </div>

          <div className="cors-panel">
            <h3>🖥️ The server's CORS headers</h3>
            <label>Access-Control-Allow-Origin <input value={allowOrigin} onChange={(e) => setAllowOrigin(e.target.value)} spellCheck={false} /></label>
            <label>Access-Control-Allow-Methods <input value={allowMethods} onChange={(e) => setAllowMethods(e.target.value)} spellCheck={false} /></label>
            <label>Access-Control-Allow-Headers <input value={allowHeaders} onChange={(e) => setAllowHeaders(e.target.value)} spellCheck={false} /></label>
            <label className="cors-chk"><input type="checkbox" checked={allowCredentials} onChange={(e) => setAllowCredentials(e.target.checked)} /> Access-Control-Allow-Credentials: true</label>
          </div>
        </div>

        {decision && (
          <div className="cors-flow">
            <div className={`cors-step ${decision.sameOrigin ? 'on' : ''}`}>
              <b>1 · origin check</b>
              <span>{decision.sameOrigin ? 'same origin → policy does not apply, response readable' : 'cross-origin → CORS rules apply'}</span>
            </div>
            {!decision.sameOrigin && decision.needsPreflight && (
              <div className={`cors-step ${decision.preflight?.ok ? 'ok' : 'bad'}`}>
                <b>2 · OPTIONS preflight</b>
                <span>{decision.preflight?.ok ? '✓ ' : '✗ '}{decision.preflight?.reason}</span>
              </div>
            )}
            {!decision.sameOrigin && (
              <div className={`cors-step ${decision.actual.ok ? 'ok' : 'bad'}`}>
                <b>{decision.needsPreflight ? '3' : '2'} · actual request</b>
                <span>{decision.actual.ok ? '✓ ' : '✗ '}{decision.actual.reason}</span>
              </div>
            )}
            <div className={`cors-verdict ${decision.readable ? 'ok' : 'bad'}`}>
              {decision.readable
                ? '✓ Your JavaScript can read the response.'
                : '✗ Blocked — the request may even reach the server, but the browser hides the response from your script (the classic CORS error in the console).'}
            </div>
          </div>
        )}

        <p className="cors-foot">
          Key subtleties: the Same-Origin Policy is enforced by the <em>browser</em>, not the server — a blocked response often still
          executed on the server (which is why CORS is not a substitute for CSRF protection). A <code>*</code> wildcard can’t be combined
          with credentials, so cookie-bearing APIs must echo the exact origin. And <code>https://a.com</code> and
          <code> https://sub.a.com</code> are <em>different</em> origins.
        </p>
      </section>
    </div>
  );
}
