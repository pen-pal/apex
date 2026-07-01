// DNS rebinding, made visible. Toggle the three defenses and watch the attack timeline: the attacker flips
// evil.com's DNS from their own IP to 127.0.0.1, and because the browser's origin is still "evil.com" the
// malicious JS can read the internal service's response. Each defense stops it at a different layer. Real model
// from dnsrebind.ts.
import { useState } from 'react';
import { simulate, type Config } from './dnsrebind';

const DEFENSES: { key: keyof Config; label: string; note: string }[] = [
  { key: 'blockPrivateIP', label: 'Block private-IP DNS answers', note: 'Resolver/browser refuses to map a public name to 127.0.0.1 or RFC1918.' },
  { key: 'dnsPinning', label: 'DNS pinning', note: 'Browser reuses the first-resolved IP for the page’s lifetime.' },
  { key: 'hostValidation', label: 'Host-header validation', note: 'Internal service rejects requests whose Host isn’t its own name.' },
];

const ACTOR: Record<string, { label: string; cls: string }> = {
  victim: { label: 'victim', cls: 'v' },
  attacker: { label: 'attacker', cls: 'a' },
  browser: { label: 'browser', cls: 'b' },
  internal: { label: 'internal', cls: 'i' },
};

export function DnsRebindSection() {
  const [cfg, setCfg] = useState<Config>({ blockPrivateIP: false, dnsPinning: false, hostValidation: false });
  const r = simulate(cfg);
  const toggle = (k: keyof Config) => setCfg((c) => ({ ...c, [k]: !c[k] }));

  return (
    <div className="dnr">
      <p className="dnr-intro">
        The same-origin policy trusts the <strong>hostname</strong>, but packets follow the <strong>IP</strong>.
        DNS rebinding drives a wedge between them: serve JS from <code>evil.com</code>, then re-point
        <code> evil.com</code> at <code>127.0.0.1</code> — the browser still thinks it’s the same origin, so the
        attacker’s JS can read your internal services. Toggle defenses and watch where it breaks:
      </p>

      <div className="dnr-defenses">
        {DEFENSES.map((d) => (
          <button key={d.key} type="button" className={`dnr-def ${cfg[d.key] ? 'on' : ''}`} onClick={() => toggle(d.key)} title={d.note}>
            <span className="dnr-check">{cfg[d.key] ? '✓' : ''}</span>{d.label}
          </button>
        ))}
      </div>

      <div className={`dnr-verdict ${r.success ? 'bad' : 'ok'}`}>
        {r.success
          ? <><b>⚠ ATTACK SUCCEEDS</b> — the attacker’s JS reached the internal service and exfiltrated the response.</>
          : <><b>✓ BLOCKED</b> — {r.blockedBy}.</>}
      </div>

      <ol className="dnr-timeline">
        {r.steps.map((s, i) => {
          const a = ACTOR[s.actor];
          return (
            <li key={i} className={`dnr-step ${s.blocked ? 'blocked' : ''}`}>
              <span className={`dnr-actor ${a.cls}`}>{a.label}</span>
              <span className="dnr-detail">{s.detail}</span>
              {s.ip && <span className={`dnr-ip ${s.ip.includes('127') ? 'internal' : 'attacker'}`}>{s.ip}</span>}
              {s.blocked && <span className="dnr-x">✕ blocked</span>}
            </li>
          );
        })}
      </ol>

      <p className="dnr-foot">
        Why it’s so potent: it bypasses firewalls (the request originates from <em>inside</em>, from the
        victim’s own browser), needs no exploit on the target (just an unauthenticated internal endpoint that
        trusts its network position), and defeats naive IP allow-lists. Prime targets are things that assume
        “if you can reach me, you’re trusted”: home-router admin panels, <code>169.254.169.254</code> cloud
        metadata (the SSRF cousin), Kubernetes/Docker APIs, Elasticsearch, and dev servers on
        <code> localhost</code>. The robust fixes are exactly the toggles above, and they compose: modern
        browsers and resolvers drop private-IP answers for public names, add <strong>DNS pinning</strong>, and —
        most importantly, because it doesn’t depend on the client — internal services should <strong>authenticate
        every request</strong> and <strong>validate the Host header</strong> rather than trusting the network.
        Short DNS TTLs are the attacker’s enabler, but you can’t defend by banning them (they’re legitimate for
        failover); defend at the layers that don’t rely on DNS behaving. (OWASP; the Singularity of Origin tool.)
      </p>
    </div>
  );
}
