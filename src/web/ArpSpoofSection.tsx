// ARP spoofing, made visible. Toggle the three defenses and watch the attack timeline and the victim's ARP
// cache: with no defense, the attacker's forged "the gateway is at MY MAC" reply overwrites the cache entry and
// all traffic flows through the attacker. Static ARP or DAI stop the poisoning outright; TLS can't stop the
// MITM but keeps the traffic encrypted. Real model from arpspoof.ts.
import { useState } from 'react';
import { simulate, type Config } from './arpspoof';

const DEFENSES: { key: keyof Config; label: string; note: string }[] = [
  { key: 'staticArp', label: 'Static ARP entry', note: 'Pin the gateway MAC so dynamic replies can’t overwrite it.' },
  { key: 'dai', label: 'Dynamic ARP Inspection', note: 'The switch drops ARP replies that violate DHCP-snooping bindings.' },
  { key: 'tls', label: 'TLS everywhere', note: 'End-to-end encryption — a MITM sees only ciphertext.' },
];

const ACTOR: Record<string, { label: string; cls: string }> = {
  victim: { label: 'victim', cls: 'v' }, attacker: { label: 'attacker', cls: 'a' },
  gateway: { label: 'gateway', cls: 'g' }, switch: { label: 'switch', cls: 's' },
};

export function ArpSpoofSection() {
  const [cfg, setCfg] = useState<Config>({ staticArp: false, dai: false, tls: false });
  const r = simulate(cfg);
  const toggle = (k: keyof Config) => setCfg((c) => ({ ...c, [k]: !c[k] }));

  const verdict = r.blockedBy
    ? { cls: 'ok', text: <><b>✓ BLOCKED</b> — {r.blockedBy}. The ARP cache is never poisoned.</> }
    : r.contentExposed
      ? { cls: 'bad', text: <><b>⚠ FULL COMPROMISE</b> — the attacker is in the path and reads/modifies plaintext.</> }
      : { cls: 'mid', text: <><b>◐ MITM established</b> — the cache is poisoned and traffic flows through the attacker, but TLS keeps the content encrypted (metadata still leaks).</> };

  return (
    <div className="asp">
      <p className="asp-intro">
        ARP has no authentication: a host caches <em>any</em> reply to “who has this IP?”, even an unsolicited
        one. So an attacker on the LAN repeatedly announces “the gateway (192.168.1.1) is at <strong>my</strong>
        MAC,” the victim’s cache is overwritten, and every packet bound for the internet goes to the attacker
        first. Toggle defenses:
      </p>

      <div className="asp-defenses">
        {DEFENSES.map((d) => (
          <button key={d.key} type="button" className={`asp-def ${cfg[d.key] ? 'on' : ''}`} onClick={() => toggle(d.key)} title={d.note}>
            <span className="asp-check">{cfg[d.key] ? '✓' : ''}</span>{d.label}
          </button>
        ))}
      </div>

      <div className="asp-cache">
        <span className="asp-cache-label">victim’s ARP cache</span>
        <div className="asp-entry">
          <span className="asp-ip">192.168.1.1</span>
          <span className="asp-arrow">→</span>
          <span className={`asp-mac ${r.gatewayMacInCache === 'attacker' ? 'bad' : 'ok'}`}>
            {r.gatewayMacInCache === 'attacker' ? 'ATTACKER:MAC ☠' : 'GW:MAC ✓'}
          </span>
        </div>
      </div>

      <div className={`asp-verdict ${verdict.cls}`}>{verdict.text}</div>

      <ol className="asp-timeline">
        {r.steps.map((s, i) => {
          const a = ACTOR[s.actor];
          return (
            <li key={i} className={`asp-step ${s.blocked ? 'blocked' : ''}`}>
              <span className={`asp-actor ${a.cls}`}>{a.label}</span>
              <span className="asp-detail">{s.detail}</span>
              {s.blocked && <span className="asp-x">✕ blocked</span>}
            </li>
          );
        })}
      </ol>

      <p className="asp-foot">
        The reason this evergreen attack still works is that Layer 2 was designed for a trusted wire — ARP,
        like DHCP and STP, simply believes what it’s told. The lesson isn’t “ARP is broken” so much as “the local
        network is not a trust boundary”: anyone who can put frames on your segment (a rogue device, a
        compromised laptop, guest Wi-Fi) can reroute traffic. That’s why the durable defenses live at two
        different layers. On the <strong>switch</strong>, DHCP snooping builds a table of legitimate IP↔MAC↔port
        bindings and <strong>Dynamic ARP Inspection</strong> drops any ARP that contradicts it — killing the
        attack at the infrastructure. End to end, <strong>encryption</strong> (TLS, and increasingly QUIC/HTTPS
        everywhere, plus VPNs) accepts that a MITM may exist and makes their position worthless: they can see
        <em>that</em> you’re talking to a bank, and drop packets, but not read or alter the conversation without
        tripping a certificate error. ARP spoofing is the LAN sibling of DNS cache poisoning and rogue-DHCP
        attacks — all of them exploit an unauthenticated “helpful” protocol — and the same combination (bind at
        the infrastructure, encrypt end to end) answers all three. (RFC 826.)
      </p>
    </div>
  );
}
