// HSTS made visible. Walk a browser through visits to a site with an attacker on the wire. On the very
// first plaintext visit, sslstrip wins — there's no HSTS entry yet (trust-on-first-use). Let the https
// response deliver the Strict-Transport-Security header, and every later http navigation is rewritten to
// https in-browser before a byte leaves: the MITM is locked out. Flip on the preload list and even the
// first visit is safe. Real model from hsts.ts.
import { useMemo, useState } from 'react';
import { navigate, record, parseHeader, type HstsStore } from './hsts';

const HOST = 'bank.example';
const HEADER = 'max-age=63072000; includeSubDomains; preload';

export function HstsSection() {
  const [seenHeader, setSeenHeader] = useState(false); // has the browser recorded the STS header yet?
  const [preload, setPreload] = useState(false);
  const [mitm, setMitm] = useState(true);

  const store: HstsStore = useMemo(
    () => (seenHeader ? record({}, HOST, parseHeader(HEADER)!, true, 0) : {}),
    [seenHeader],
  );
  const preloadSet = useMemo(() => new Set(preload ? [HOST] : []), [preload]);
  const sub = navigate('http', 'api.' + HOST, store, preloadSet, 100, mitm);
  const top = navigate('http', HOST, store, preloadSet, 100, mitm);

  return (
    <div className="hsts">
      <p className="hsts-intro">
        Type <code>bank.example</code> in the address bar and the browser tries <code>http://</code> first.
        <strong> HSTS</strong> is one response header that tells the browser: never again — always go straight
        to <code>https://</code>. That single rule defeats <strong>SSL stripping</strong>, where a
        man-in-the-middle keeps you on plaintext and reads everything. The gap it can't cover on its own is
        the <em>first</em> visit; the <strong>preload list</strong> baked into the browser closes that too.
      </p>

      <div className="hsts-controls">
        <label className={`hsts-tog ${mitm ? 'on' : ''}`}><input type="checkbox" checked={mitm} onChange={(e) => setMitm(e.target.checked)} />😈 attacker on the wire (sslstrip)</label>
        <label className={`hsts-tog ${seenHeader ? 'on' : ''}`}><input type="checkbox" checked={seenHeader} onChange={(e) => setSeenHeader(e.target.checked)} />browser has seen the STS header</label>
        <label className={`hsts-tog ${preload ? 'on' : ''}`}><input type="checkbox" checked={preload} onChange={(e) => setPreload(e.target.checked)} />host is on the preload list</label>
      </div>

      <div className="hsts-header">
        <span className="hsts-hk">Strict-Transport-Security:</span>
        <span className="hsts-hv">max-age=63072000; includeSubDomains; preload</span>
        <span className="hsts-hnote">{seenHeader || preload ? 'active for this host' : 'not yet recorded by the browser'}</span>
      </div>

      <div className="hsts-nav">
        {[{ label: HOST, r: top }, { label: 'api.' + HOST + '  (subdomain)', r: sub }].map(({ label, r }) => (
          <div key={label} className={`hsts-row ${r.intercepted ? 'bad' : r.upgraded ? 'ok' : 'warn'}`}>
            <div className="hsts-url"><span className={`hsts-scheme ${r.finalScheme}`}>{r.finalScheme}://</span>{label}</div>
            <div className="hsts-flow">
              <span className="hsts-step">browser</span>
              <span className="hsts-edge">{r.upgraded ? '↑ upgraded to https' : r.finalScheme === 'https' ? 'https' : 'http (plaintext)'}</span>
              {r.intercepted && <span className="hsts-attacker">😈 reads &amp; rewrites</span>}
              <span className="hsts-step">{HOST}</span>
            </div>
            <div className={`hsts-verdict ${r.intercepted ? 'bad' : 'ok'}`}>{r.intercepted ? '✗ intercepted' : r.upgraded ? '✓ upgraded — MITM locked out' : r.finalScheme === 'https' ? '✓ encrypted' : '… exposed'}</div>
            <div className="hsts-reason">{r.reason}</div>
          </div>
        ))}
      </div>

      <div className="hsts-key">
        <div className={`hsts-card ${!seenHeader && !preload ? 'live' : ''}`}><b>Trust-on-first-use gap</b><span>No entry, not preloaded → the first http hit is in the clear. An active MITM strips it and can even suppress the STS header so it's never recorded.</span></div>
        <div className={`hsts-card ${seenHeader && !preload ? 'live' : ''}`}><b>After the header</b><span>Once recorded, the browser upgrades http→https itself, before sending. <code>includeSubDomains</code> extends it to <code>api.</code> too. Nothing reaches the wire as plaintext.</span></div>
        <div className={`hsts-card ${preload ? 'live' : ''}`}><b>Preload</b><span>Hosts on the HSTS preload list ship inside the browser, so even the very first visit is forced to https. This is the only way to close the TOFU gap.</span></div>
      </div>

      <p className="hsts-foot">
        Rules that keep it honest (RFC 6797): an STS header received over <strong>plaintext</strong> is
        ignored (or a MITM would just inject <code>max-age=0</code>); the header is only trusted over an
        already-secure, certificate-validated connection; and a hard TLS error on an HSTS host is
        <strong> non-overridable</strong> — no "proceed anyway" click-through. Related hardening:
        <strong> upgrade-insecure-requests</strong> (CSP) rewrites mixed-content subresources, and HTTPS-only
        modes in modern browsers generalize the idea. HSTS protects the connection; it does not stop
        phishing on a look-alike domain.
      </p>
    </div>
  );
}
