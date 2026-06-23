// Certificate-chain / PKI trust-path validator, made visible. The browser walks
// the chain leaf → intermediate → root, checking signatures, dates, CA flags, and
// the trust anchor. Inject a flaw (expire a cert, forge a signature, untrust the
// root, mismatch the host) and watch validation fail at exactly that link. The
// validation logic is real RFC 5280 §6 (see certchain.ts).
import { useMemo, useState } from 'react';
import { validateChain, type Cert } from './certchain';

const DAY = 86400;

export function CertChainSection() {
  const [now] = useState(() => Math.floor(Date.now() / 1000));
  const [host, setHost] = useState('shop.example.com');
  const [expireInter, setExpireInter] = useState(false);
  const [breakSig, setBreakSig] = useState(false);
  const [interNotCA, setInterNotCA] = useState(false);
  const [untrust, setUntrust] = useState(false);

  const chain: Cert[] = useMemo(() => [
    { subject: 'CN=shop.example.com', issuer: 'CN=Example TLS Intermediate', notBefore: now - 30 * DAY, notAfter: now + 60 * DAY, isCA: false, sans: ['shop.example.com', '*.example.com'], signatureValidByParent: !breakSig },
    { subject: 'CN=Example TLS Intermediate', issuer: 'CN=Example Root CA', notBefore: now - 800 * DAY, notAfter: expireInter ? now - DAY : now + 1500 * DAY, isCA: !interNotCA, sans: [], signatureValidByParent: true },
    { subject: 'CN=Example Root CA', issuer: 'CN=Example Root CA', notBefore: now - 3000 * DAY, notAfter: now + 4000 * DAY, isCA: true, sans: [], signatureValidByParent: true },
  ], [now, breakSig, expireInter, interNotCA]);

  const roots = useMemo(() => new Set(untrust ? [] : ['CN=Example Root CA']), [untrust]);
  const result = useMemo(() => validateChain(chain, host, now, roots), [chain, host, now, roots]);

  const labels = ['leaf (server)', 'intermediate CA', 'root CA'];
  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Certificate chain — why your browser trusts a site</h2></div>
        <p className="jsec-sub">
          A TLS server sends a chain of certificates. Your browser only trusts it if <em>every</em> link checks out: each
          cert is signed by the one above, the signers are CAs, none are expired, the chain ends at a root your browser
          already trusts, and the leaf is actually valid for the site you asked for. Break a link and watch it fail.
        </p>

        <div className="cert-controls">
          <label>requesting host<input value={host} onChange={(e) => setHost(e.target.value)} spellCheck={false} /></label>
          <label className="cert-flaw"><input type="checkbox" checked={expireInter} onChange={(e) => setExpireInter(e.target.checked)} /> expire the intermediate</label>
          <label className="cert-flaw"><input type="checkbox" checked={breakSig} onChange={(e) => setBreakSig(e.target.checked)} /> forge the leaf signature</label>
          <label className="cert-flaw"><input type="checkbox" checked={interNotCA} onChange={(e) => setInterNotCA(e.target.checked)} /> intermediate not a CA</label>
          <label className="cert-flaw"><input type="checkbox" checked={untrust} onChange={(e) => setUntrust(e.target.checked)} /> remove root from trust store</label>
        </div>

        <div className={`cert-verdict ${result.valid ? 'ok' : 'bad'}`}>
          {result.valid ? '🔒 Trusted' : '⛔ Rejected'} — {result.reason}
        </div>

        <div className="cert-chain">
          {chain.map((c, i) => {
            const link = result.links[i];
            const reached = result.failAt === null || i <= result.failAt;
            const failedHere = result.failAt === i;
            return (
              <div key={i}>
                {i > 0 && <div className={`cert-link ${reached && !failedHere && (result.failAt === null || i <= result.failAt) ? 'ok' : ''} ${result.failAt !== null && i > result.failAt ? 'dim' : ''}`}>
                  <span>↑ signed by · issuer “{c.issuer}”</span>
                </div>}
                <div className={`cert-card ${failedHere ? 'fail' : link.ok && reached ? 'pass' : ''} ${!reached ? 'unreached' : ''}`}>
                  <div className="cert-c-top">
                    <span className="cert-role">{labels[i]}</span>
                    <span className="cert-status">{failedHere ? '✗' : reached && link.ok ? '✓' : '·'}</span>
                  </div>
                  <div className="cert-subject">{c.subject}</div>
                  <div className="cert-meta">
                    {c.isCA && <span className="cert-badge ca">CA</span>}
                    {c.sans.length > 0 && <span className="cert-badge san">SAN: {c.sans.join(', ')}</span>}
                    <span className={`cert-badge ${c.notAfter < now ? 'exp' : 'val'}`}>{c.notAfter < now ? 'expired' : `valid · ${Math.round((c.notAfter - now) / DAY)}d left`}</span>
                  </div>
                  {failedHere && <div className="cert-fail-reason">{result.reason}</div>}
                </div>
              </div>
            );
          })}
        </div>
        <p className="enc-note">This is exactly what a TLS client does after the handshake’s Certificate message (see the TLS 1.3 arc in the
          Cryptography section). A single broken link — an expired cert, a name mismatch, an unknown CA — is why you see “your connection is not
          private”. The root’s trust isn’t magic; it’s pre-installed in your OS/browser trust store.</p>
      </section>
    </div>
  );
}
