// Cross-Site Request Forgery — an attacker page makes your browser send an authenticated request to a site you're
// logged into, because the browser attaches cookies by destination. Auto-cycles the site's defenses (SameSite / CSRF
// token) and shows when the forged transfer succeeds; toggle them yourself. Model + verdict in csrf.ts.
import { useEffect, useState } from 'react';
import { forge, type SameSite, type Defenses } from './csrf';

const SEQ: Defenses[] = [
  { sameSite: 'none', csrfToken: false },
  { sameSite: 'none', csrfToken: true },
  { sameSite: 'lax', csrfToken: false },
  { sameSite: 'strict', csrfToken: false },
];

export function CsrfSection() {
  const [d, setD] = useState<Defenses>(SEQ[0]);
  const [auto, setAuto] = useState(true);
  const [ai, setAi] = useState(0);
  useEffect(() => {
    if (!auto) return;
    setD(SEQ[ai]);
    const t = setTimeout(() => setAi((i) => (i + 1) % SEQ.length), 2600);
    return () => clearTimeout(t);
  }, [auto, ai]);

  const v = forge(d);
  const set = (patch: Partial<Defenses>) => { setAuto(false); setD((c) => ({ ...c, ...patch })); };

  return (
    <div className="csr">
      <p className="csr-intro">
        You’re logged into <strong>bank.com</strong> — your browser holds its session cookie. You open a page on
        <strong> evil.com</strong>, which silently makes your browser <code>POST</code> a money transfer to bank.com. Here’s the
        trap: the browser attaches cookies by <em>destination</em>, not by who started the request — so bank.com’s cookie
        rides along, and the bank sees a request it can’t tell from a real one. Flip the defenses and watch.
      </p>

      <div className="csr-controls">
        <span className="csr-c-lbl">bank.com’s defenses:</span>
        <span className="csr-seg">SameSite
          {(['strict', 'lax', 'none'] as SameSite[]).map((s) => (
            <button key={s} type="button" className={d.sameSite === s ? 'on' : ''} onClick={() => set({ sameSite: s })}>{s}</button>
          ))}
        </span>
        <button type="button" className={`csr-tok ${d.csrfToken ? 'on' : ''}`} onClick={() => set({ csrfToken: !d.csrfToken })}>{d.csrfToken ? '✓ ' : ''}CSRF token</button>
        <button type="button" className={`csr-play ${auto ? 'on' : ''}`} onClick={() => setAuto((a) => !a)}>{auto ? '❚❚' : '▶'}</button>
      </div>

      <div className="csr-flow">
        <div className="csr-node evil"><span className="csr-ico">😈</span><b>evil.com</b><em>hidden auto-submitting form</em></div>
        <div className="csr-arrow">POST /transfer<br />$5000 →</div>
        <div className={`csr-node browser ${v.cookieSent ? 'sends' : 'blocks'}`}>
          <span className="csr-ico">🧑</span><b>your browser</b>
          <em>{v.cookieSent ? '🍪 attaches bank.com cookie' : '🚫 withholds the cookie'}</em>
        </div>
        <div className={`csr-arrow ${v.cookieSent ? 'lit' : 'dead'}`}>{v.cookieSent ? '→' : '✗'}</div>
        <div className={`csr-node bank ${v.accepted ? 'hit' : 'safe'}`}><span className="csr-ico">🏦</span><b>bank.com</b><em>{v.accepted ? '💸 transfer executed' : '⛔ rejected'}</em></div>
      </div>

      <div className={`csr-verdict ${v.accepted ? 'bad' : 'ok'}`}>
        {v.accepted ? '☠ CSRF succeeded — $5000 moved, and you never clicked anything' : '🔒 attack blocked'} — {v.reason}
      </div>

      <p className="csr-foot">
        Two defenses close it. <strong>SameSite cookies</strong> tell the browser not to send the cookie on cross-site
        requests at all (<code>Lax</code>, now the default, blocks cross-site POSTs; <code>Strict</code> blocks even
        cross-site navigation) — so the forged request arrives with no session. A <strong>CSRF token</strong> is a
        per-request secret embedded in the real page; the server rejects any state change without it, and the
        <strong> same-origin policy</strong> stops evil.com from reading it. Checking the <code>Origin</code>/<code>Referer</code>
        header helps too. The root cause is the same as every ambient-authority bug: the request carried the victim’s
        credentials automatically, so the server must demand proof of <em>intent</em>, not just identity. (OWASP CSRF.)
      </p>
    </div>
  );
}
