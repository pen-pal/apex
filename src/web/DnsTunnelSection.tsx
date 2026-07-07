// DNS tunneling — command-and-control / exfiltration hidden in DNS queries a firewall lets through. Type a secret,
// watch it hex-encode into subdomain labels, get sent one query at a time past the firewall (which blocks HTTP but
// allows DNS), and reassemble at the attacker's server — plus the signal an IDS would use to catch it. Model in
// dnstunnel.ts.
import { useEffect, useMemo, useState } from 'react';
import { encodeToQueries, decodeFromQueries, avgLabelLen } from './dnstunnel';

const DOMAIN = 'x.evil.com';

export function DnsTunnelSection() {
  const [secret, setSecret] = useState('password=hunter2');
  const queries = useMemo(() => encodeToQueries(secret, DOMAIN), [secret]);
  const [sent, setSent] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => { setSent(0); }, [secret]);
  useEffect(() => {
    if (!playing) return;
    if (sent >= queries.length) { const t = setTimeout(() => setSent(0), 1900); return () => clearTimeout(t); }
    const t = setTimeout(() => setSent((s) => s + 1), 720);
    return () => clearTimeout(t);
  }, [playing, sent, queries.length]);

  const decoded = decodeFromQueries(queries.slice(0, sent), DOMAIN);
  const done = sent >= queries.length;

  return (
    <div className="dnt">
      <p className="dnt-intro">
        A locked-down network blocks almost all outbound traffic — but it can’t block <strong>DNS</strong>, because every
        program needs to look up names. So malware smuggles data out inside DNS itself: it hex-encodes the secret across the
        <strong> subdomain labels</strong> of queries to a domain the attacker owns. Recursive DNS dutifully forwards each
        query to the attacker’s server, which decodes the labels back into data. The same channel carries commands the other
        way. Slow and loud — but it gets through a firewall that blocks everything else.
      </p>

      <label className="dnt-input">exfiltrate this secret:
        <input value={secret} maxLength={40} spellCheck={false} onChange={(e) => setSecret(e.target.value)} />
      </label>

      <div className="dnt-flow">
        <div className="dnt-node host"><span className="dnt-ico">💻</span><b>compromised host</b><em>inside the network</em></div>
        <div className="dnt-fw">
          <div className="dnt-fw-lbl">🧱 firewall</div>
          <div className="dnt-rule bad">HTTP / raw exfil ✗ blocked</div>
          <div className="dnt-rule ok">DNS (:53) ✓ allowed</div>
        </div>
        <div className="dnt-node atk"><span className="dnt-ico">😈</span><b>attacker’s DNS server</b><em>authoritative for {DOMAIN}</em></div>
      </div>

      <div className="dnt-wire">
        <div className="dnt-wire-h"><span>DNS queries on the wire</span><button type="button" className={`dnt-play ${playing ? 'on' : ''}`} onClick={() => setPlaying((p) => !p)}>{playing ? '❚❚' : '▶'}</button></div>
        <div className="dnt-queries">
          {queries.map((q, i) => (
            <code key={i} className={`dnt-q ${i < sent ? 'sent' : ''} ${i === sent - 1 ? 'cur' : ''}`}>{q}</code>
          ))}
        </div>
      </div>

      <div className="dnt-decoded">
        <span className="dnt-dec-lbl">reassembled at the attacker →</span>
        <code className="dnt-dec-val">{decoded || '…'}{done && decoded ? ' ✓' : ''}</code>
      </div>

      <div className="dnt-detect">
        ⚠ <strong>how a defender catches it:</strong> those labels average <b>{avgLabelLen(queries, DOMAIN).toFixed(0)}</b> characters
        of high-entropy hex, and there’s a burst of them all going to <code>{DOMAIN}</code> — real DNS labels are short,
        word-like, and low-volume. An IDS/SIEM flags the length, the randomness, and the query rate to one domain; defenders
        also block newly-registered domains and inspect DNS with the same tooling as web traffic.
      </div>

      <p className="dnt-foot">
        This is a <strong>covert channel</strong>: data flowing over a path never meant to carry it. DNS is the classic
        carrier (iodine, dnscat2), but the same idea hides C2 in ICMP pings, TLS SNI, HTTP headers, or even inter-packet
        timing. It’s why serious networks don’t just allow DNS blindly — they run their own resolver, log every query, and
        rate-limit and entropy-check the traffic. (DNS exfiltration; covert channels.)
      </p>
    </div>
  );
}
