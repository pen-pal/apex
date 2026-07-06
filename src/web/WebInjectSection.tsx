// Injection attacks, made visible. Type an attacker's input and watch it both ways:
// concatenated straight into a SQL query (where a quote breaks out and the rest is
// parsed as SQL) versus bound as a parameter; and dropped into HTML (where '<' starts a
// <script>) versus HTML-escaped. The same payload that pops the vulnerable version is
// inert against the fix. Real logic in webinject.ts (tested on OWASP payloads).
import { useMemo, useState } from 'react';
import { analyzeSqli, parameterizedSqli, analyzeXss } from './webinject';

const SQLI_SAMPLES = ["' OR '1'='1", "admin'--", "x'; DROP TABLE users; --", 'Robert'];
const XSS_SAMPLES = ['<script>alert(1)</script>', '<img src=x onerror=alert(1)>', 'hello world'];

export function WebInjectSection() {
  const [tab, setTab] = useState<'sqli' | 'xss'>('sqli');
  const [sqli, setSqli] = useState("' OR '1'='1");
  const [xss, setXss] = useState('<script>alert(1)</script>');

  const sa = useMemo(() => analyzeSqli(sqli), [sqli]);
  const sp = useMemo(() => parameterizedSqli(sqli), [sqli]);
  const xa = useMemo(() => analyzeXss(xss), [xss]);

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Injection — when input becomes code</h2></div>
        <p className="jsec-sub">
          Almost every injection bug is the same mistake: untrusted input is pasted into a place where it can be interpreted as
          <em> instructions</em> instead of <em>data</em>. Fix it by keeping data as data — bind SQL parameters, escape HTML. Try a
          payload against the broken version and the hardened version side by side.
        </p>

        <div className="inj-tabs">
          <button className={tab === 'sqli' ? 'on' : ''} onClick={() => setTab('sqli')}>SQL injection</button>
          <button className={tab === 'xss' ? 'on' : ''} onClick={() => setTab('xss')}>Cross-site scripting</button>
        </div>

        {tab === 'sqli' ? (
          <>
            <label className="inj-label">attacker types into the “name” field:</label>
            <input className="inj-input" value={sqli} onChange={(e) => setSqli(e.target.value)} spellCheck={false} />
            <div className="inj-samples">{SQLI_SAMPLES.map((s) => <button key={s} onClick={() => setSqli(s)}>{s}</button>)}</div>

            <div className="inj-cols">
              <div className={`inj-card ${sa.vulnerable ? 'bad' : 'neutral'}`}>
                <h3>❌ string concatenation</h3>
                <pre className="inj-code">{sa.concatQuery}</pre>
                <ul className="inj-flags">
                  <li className={sa.breaksOut ? 'hit' : ''}>{sa.breaksOut ? '✗' : '·'} quote closes the string literal</li>
                  <li className={sa.tautology ? 'hit' : ''}>{sa.tautology ? '✗' : '·'} always-true condition (returns every row)</li>
                  <li className={sa.comments ? 'hit' : ''}>{sa.comments ? '✗' : '·'} comment truncates the rest</li>
                </ul>
                <div className={`inj-verdict ${sa.vulnerable ? 'bad' : 'ok'}`}>{sa.vulnerable ? 'INJECTED — attacker controls the query' : 'no break-out for this input'}</div>
                {sa.vulnerable && (
                  <p className="inj-outcome">
                    {/;\s*(drop|delete|update|insert|select)/i.test(sqli)
                      ? '→ the attacker appended a second statement after the “;” — it runs against the database (here, destroying the users table).'
                      : sa.tautology
                      ? '→ on a login lookup the always-true condition returns a user row, so you are logged in as the first user (admin) — with no password.'
                      : sa.comments
                      ? '→ the “--” comments out the password check that followed, so you are logged in as the account you named.'
                      : '→ the attacker’s text is now SQL, not a name — they decide what the query does.'}
                  </p>
                )}
              </div>

              <div className="inj-card ok">
                <h3>✅ parameterized query</h3>
                <pre className="inj-code">{sp.query}</pre>
                <div className="inj-bound">param 1 ⟵ <code>{sp.boundParam || '∅'}</code></div>
                <p className="inj-note">The driver sends the query and the value on separate channels. The quote is just a character in a string — it can never become syntax.</p>
                <div className="inj-verdict ok">SAFE — input stays data</div>
              </div>
            </div>
          </>
        ) : (
          <>
            <label className="inj-label">attacker posts a comment:</label>
            <input className="inj-input" value={xss} onChange={(e) => setXss(e.target.value)} spellCheck={false} />
            <div className="inj-samples">{XSS_SAMPLES.map((s) => <button key={s} onClick={() => setXss(s)}>{s}</button>)}</div>

            <div className="inj-cols">
              <div className={`inj-card ${xa.executesRaw ? 'bad' : 'neutral'}`}>
                <h3>❌ inserted as raw HTML</h3>
                <pre className="inj-code">{xa.rawHtml}</pre>
                <div className={`inj-verdict ${xa.executesRaw ? 'bad' : 'ok'}`}>{xa.executesRaw ? 'SCRIPT RUNS in every viewer’s browser' : 'no executable markup'}</div>
                {xa.executesRaw && (
                  <p className="inj-outcome">→ that script runs with the victim’s session — it can read their login cookie and send it to the attacker (account takeover), or act as them silently.</p>
                )}
              </div>

              <div className="inj-card ok">
                <h3>✅ HTML-escaped</h3>
                <pre className="inj-code">{xa.escapedHtml}</pre>
                <p className="inj-note">Escaping turns <code>&lt;</code> into <code>&amp;lt;</code>, so the browser shows the text instead of building a <code>&lt;script&gt;</code> node.</p>
                <div className="inj-verdict ok">SAFE — renders as visible text</div>
              </div>
            </div>
          </>
        )}

        <p className="inj-foot">
          The pattern generalises: command injection (shell), LDAP injection, template injection, header injection — all are the same
          data-becomes-code confusion, and all are fixed the same way: a parameterized interface plus context-aware escaping, never
          ad-hoc string building. A Content-Security-Policy adds defense in depth for XSS by refusing to run inline or unknown scripts.
        </p>
      </section>
    </div>
  );
}
