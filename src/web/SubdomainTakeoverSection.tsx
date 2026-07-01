// Subdomain takeover, made visible. Each row is a real DNS record pointing a subdomain at a cloud service.
// Flip a resource from "live" to "deleted" (you tore it down but forgot the DNS record) and watch the verdict:
// on a provider that lets anyone claim an unused name it becomes a TAKEOVER — an attacker registers the name
// and serves their content from your subdomain. On a provider that verifies domain ownership it's only a
// harmless dangling record. Real model from subdomaintakeover.ts.
import { useState } from 'react';
import { classify, type DnsRecord } from './subdomaintakeover';

const INITIAL: DnsRecord[] = [
  { subdomain: 'blog.acme.com', target: 'acme-blog.github.io', live: false },
  { subdomain: 'app.acme.com', target: 'acme-prod.herokuapp.com', live: true },
  { subdomain: 'files.acme.com', target: 'acme-files.s3.amazonaws.com', live: false },
  { subdomain: 'shop.acme.com', target: 'acme.myshopify.com', live: false },
  { subdomain: 'cdn.acme.com', target: 'd1234.cloudfront.net', live: false },
];

const TONE: Record<string, string> = { safe: 'ok', dangling: 'warn', takeover: 'bad' };
const LABEL: Record<string, string> = { safe: '✓ safe', dangling: '● dangling', takeover: '⚠ takeover' };

export function SubdomainTakeoverSection() {
  const [records, setRecords] = useState(INITIAL);
  const toggle = (i: number) => setRecords((rs) => rs.map((r, j) => (j === i ? { ...r, live: !r.live } : r)));
  const verdicts = records.map(classify);
  const anyTakeover = verdicts.find((v) => v.status === 'takeover');

  return (
    <div className="sdt">
      <p className="sdt-intro">
        You point <code>blog.acme.com</code> at a cloud service with a CNAME, then later delete the service — but
        <strong> forget the DNS record</strong>. Now it's a <strong>dangling</strong> CNAME pointing at an unclaimed
        name. If the provider lets <strong>anyone</strong> register that name, an attacker does — and serves their
        content (phishing, cookie theft, a valid TLS cert) from <strong>your</strong> subdomain. Toggle each
        resource live/deleted:
      </p>

      <div className="sdt-table">
        <div className="sdt-row head"><span>subdomain</span><span>CNAME target</span><span>resource</span><span>verdict</span></div>
        {records.map((r, i) => {
          const v = verdicts[i];
          return (
            <div key={i} className={`sdt-row ${TONE[v.status]}`}>
              <span className="sdt-sub">{r.subdomain}</span>
              <span className="sdt-tgt">→ {r.target}</span>
              <button type="button" className={`sdt-live ${r.live ? 'up' : 'down'}`} onClick={() => toggle(i)}>{r.live ? '● live' : '✗ deleted'}</button>
              <span className={`sdt-verdict ${TONE[v.status]}`} title={v.reason}>{LABEL[v.status]}</span>
            </div>
          );
        })}
      </div>

      <div className="sdt-detail">
        {verdicts.map((v, i) => (v.status !== 'safe' && !records[i].live) ? (
          <div key={i} className={`sdt-reason ${TONE[v.status]}`}><b>{v.subdomain}</b> — {v.reason}</div>
        ) : null)}
      </div>

      {anyTakeover && (
        <div className="sdt-attack">
          <div className="sdt-ah">😈 the attack on {anyTakeover.subdomain}</div>
          <ol>
            <li>attacker sees the dangling CNAME → {anyTakeover.provider} (via subdomain enumeration / cert logs)</li>
            <li>registers the unused name on {anyTakeover.provider} — no ownership check</li>
            <li>{anyTakeover.provider} now serves the attacker's page for <b>{anyTakeover.subdomain}</b></li>
            <li>they get a valid TLS cert (domain-validated), phish your users, or steal cookies scoped to *.acme.com</li>
          </ol>
        </div>
      )}

      <p className="sdt-foot">
        The root cause is a <strong>lifecycle mismatch</strong>: the DNS record outlives the resource it named.
        Defenses: <strong>delete DNS records atomically with the resource</strong> (tie them together in IaC);
        periodically <strong>scan your own zones</strong> for CNAMEs whose targets return the provider's "no such
        site" fingerprint (that's exactly what tools like can-i-take-over-xyz and subjack automate); and prefer
        providers that require <strong>domain verification</strong> before serving a custom hostname (so a
        stranger can't claim it even if the record dangles). The same idea generalizes to dangling NS records
        (name-server takeover) and dangling A records into re-assignable cloud IP pools. (Detectify, "Hostile
        Subdomain Takeover.")
      </p>
    </div>
  );
}
