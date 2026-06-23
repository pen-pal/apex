// HTTP cookies & sessions, made visible. Define cookies (with their security
// flags), craft a request, and watch which cookies the browser attaches — and why
// the rest are withheld. The matching rules are real RFC 6265 (see cookies.ts).
import { useMemo, useState } from 'react';
import { parseSetCookie, evaluate, type Cookie, type Request } from './cookies';

const SETTER_HOST = 'example.com';
const DEFAULT_HEADERS = [
  'sid=s3cr3t; Domain=example.com; Path=/; Secure; HttpOnly; SameSite=Lax',
  'csrf=t0k3n; Path=/; SameSite=Strict',
  'prefs=dark; Path=/; SameSite=None; Secure',
  'ad_id=xyz; Domain=ads.example.com; Path=/; SameSite=None; Secure',
];

export function CookiesSection() {
  const [now] = useState(() => Math.floor(Date.now() / 1000));
  const [jar, setJar] = useState<Cookie[]>(() =>
    DEFAULT_HEADERS.map((h) => parseSetCookie({ header: h, requestHost: SETTER_HOST, requestPath: '/', now })).filter(Boolean) as Cookie[],
  );
  const [draft, setDraft] = useState('');
  const [host, setHost] = useState('example.com');
  const [path, setPath] = useState('/');
  const [https, setHttps] = useState(true);
  const [crossSite, setCrossSite] = useState(false);
  const [topLevelNav, setTopLevelNav] = useState(true);

  const req: Request = { host, path, https, crossSite, topLevelNav, now };
  const results = useMemo(() => evaluate(jar, req), [jar, host, path, https, crossSite, topLevelNav, now]);

  const add = () => {
    const c = parseSetCookie({ header: draft, requestHost: SETTER_HOST, requestPath: path, now });
    if (c) { setJar((j) => [...j.filter((x) => x.name !== c.name), c]); setDraft(''); }
  };
  const remove = (name: string) => setJar((j) => j.filter((c) => c.name !== name));
  const sentCount = results.filter((r) => r.sent).length;

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>HTTP cookies &amp; sessions — what gets sent, and why</h2></div>
        <p className="jsec-sub">
          A cookie is scoped data the browser stores and re-attaches to matching requests — how a site remembers you’re
          logged in. But it’s only sent when the <strong>Domain</strong>, <strong>Path</strong>, <strong>Secure</strong> and
          <strong> SameSite</strong> rules all pass. Craft a request and watch which cookies ride along.
        </p>

        <div className="ck-req">
          <label>host<input value={host} onChange={(e) => setHost(e.target.value)} spellCheck={false} /></label>
          <label>path<input value={path} onChange={(e) => setPath(e.target.value)} spellCheck={false} /></label>
          <label className="ck-check"><input type="checkbox" checked={https} onChange={(e) => setHttps(e.target.checked)} /> HTTPS</label>
          <label className="ck-check"><input type="checkbox" checked={crossSite} onChange={(e) => setCrossSite(e.target.checked)} /> cross-site request</label>
          <label className={`ck-check ${!crossSite ? 'dim' : ''}`}><input type="checkbox" checked={topLevelNav} disabled={!crossSite} onChange={(e) => setTopLevelNav(e.target.checked)} /> top-level navigation</label>
        </div>
        <div className="ck-summary">→ {sentCount} of {results.length} cookies attached to <code>{https ? 'https' : 'http'}://{host}{path}</code>{crossSite ? ' (cross-site)' : ''}</div>

        <div className="ck-jar">
          {results.map((r) => {
            const c = r.cookie;
            return (
              <div className={`ck-cookie ${r.sent ? 'sent' : 'held'}`} key={c.name}>
                <div className="ck-c-head">
                  <span className="ck-verdict">{r.sent ? '✓ sent' : '✕ withheld'}</span>
                  <code className="ck-nv">{c.name}={c.value}</code>
                  <button className="ck-rm" onClick={() => remove(c.name)} title="remove">✕</button>
                </div>
                <div className="ck-flags">
                  <span className="ck-flag">{c.hostOnly ? `host ${c.domain}` : `domain .${c.domain}`}</span>
                  <span className="ck-flag">path {c.path}</span>
                  {c.secure && <span className="ck-flag sec">Secure</span>}
                  {c.httpOnly && <span className="ck-flag http">HttpOnly</span>}
                  <span className={`ck-flag ss-${c.sameSite.toLowerCase()}`}>SameSite={c.sameSite}</span>
                  {c.expires !== null && <span className="ck-flag">{c.expires <= now ? 'expired' : `expires +${c.expires - now}s`}</span>}
                </div>
                <div className="ck-reason">{r.reason}</div>
              </div>
            );
          })}
        </div>

        <div className="ck-add">
          <input className="enc-input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Set-Cookie:  name=value; Domain=…; Path=/; Secure; SameSite=Lax" spellCheck={false} onKeyDown={(e) => e.key === 'Enter' && add()} />
          <button className="ghost small" onClick={add}>+ Set-Cookie</button>
        </div>

        <div className="ck-flags-legend">
          <div><strong>HttpOnly</strong> — JavaScript can’t read it (<code>document.cookie</code> hides it), so an XSS payload can’t steal the session.</div>
          <div><strong>Secure</strong> — only ever sent over HTTPS, so it can’t leak on a plaintext request.</div>
          <div><strong>SameSite</strong> — <em>Strict</em> blocks all cross-site sends; <em>Lax</em> allows only top-level GET navigations; <em>None</em> sends everywhere (and must be Secure). This is the main CSRF defense.</div>
        </div>
      </section>
    </div>
  );
}
