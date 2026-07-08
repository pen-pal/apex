// ECH, made visible — and why it's necessary but not sufficient. Toggle Encrypted Client Hello, private DNS, and a
// shared front, and watch the three metadata channels an on-path censor can read (the TLS SNI, the DNS query, the
// destination IP). ECH closes the SNI channel; you're only actually hidden when the DNS and IP channels are closed
// too. Model + tests in ech.ts.
import { useMemo, useState } from 'react';
import { analyze, REAL_SNI, COVER_SNI, type Config } from './ech';

export function EchSection() {
  const [cfg, setCfg] = useState<Config>({ echOn: true, privateDns: true, sharedFront: true });
  const a = useMemo(() => analyze(cfg), [cfg]);
  const flip = (k: keyof Config) => setCfg((c) => ({ ...c, [k]: !c[k] }));

  const channels = [
    { key: 'echOn' as const, label: 'TLS ClientHello · SNI', exposed: !cfg.echOn,
      seen: cfg.echOn ? `${COVER_SNI}  (cover)` : REAL_SNI, hidden: 'encrypted — only the cover name is sent' },
    { key: 'privateDns' as const, label: 'DNS query', exposed: !cfg.privateDns,
      seen: REAL_SNI, hidden: 'encrypted over DoH/DoT' },
    { key: 'sharedFront' as const, label: 'destination IP', exposed: !cfg.sharedFront,
      seen: `unique to ${REAL_SNI}`, hidden: 'a front shared by thousands of sites' },
  ];

  return (
    <div className="ech">
      <div className="ech-controls">
        <span className="ech-controls-lbl">your setup:</span>
        <label className="ech-tog"><input type="checkbox" checked={cfg.echOn} onChange={() => flip('echOn')} /> Encrypted Client Hello</label>
        <label className="ech-tog"><input type="checkbox" checked={cfg.privateDns} onChange={() => flip('privateDns')} /> private DNS (DoH/DoT)</label>
        <label className="ech-tog"><input type="checkbox" checked={cfg.sharedFront} onChange={() => flip('sharedFront')} /> shared front (big CDN)</label>
      </div>

      <div className="ech-wire">
        <div className="ech-lbl">what the on-path censor can read</div>
        {channels.map((c) => (
          <div key={c.key} className={`ech-chan ${c.exposed ? 'ech-open' : 'ech-shut'}`}>
            <span className="ech-chan-icon">{c.exposed ? '👁' : '🔒'}</span>
            <span className="ech-chan-label">{c.label}</span>
            <code className="ech-chan-val">{c.exposed ? c.seen : c.hidden}</code>
          </div>
        ))}
      </div>

      <div className={`ech-verdict ${a.blocked ? 'ech-blocked' : 'ech-through'}`}>
        <b>{a.blocked ? `⛔ blocked (via ${a.leak?.toUpperCase()})` : '✓ gets through'}</b> — {a.reason}
      </div>

      <p className="ech-foot">
        Everyone thinks HTTPS hides <em>where</em> you go. It doesn’t: TLS 1.3 still puts the server name in the
        ClientHello <strong>in the clear</strong> (its predecessor, ESNI, was a patch on this), so an ISP or national
        firewall reads your destination and blocks by name. <strong>ECH</strong> encrypts the real ClientHello under a
        key the client fetched from the server’s DNS <code>HTTPS</code> record and sends it inside an outer ClientHello
        that shows only a shared cover name. But the SNI is one of three leaks: ECH only helps when the
        <strong> DNS lookup is private</strong> (or the query leaks the name anyway) and the site sits behind a
        <strong> large shared front</strong> (or the unique IP gives it away). That’s also its politics — ECH forces a
        censor to choose between allowing a site and blocking an entire CDN, which is why some networks just block ECH
        itself. (TLS Encrypted Client Hello.)
      </p>
    </div>
  );
}
