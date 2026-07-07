// Firewall rules (iptables) — the first-match-wins gotcha, made a puzzle you fix. A chain of rules starts in the
// classic buggy order: a broad "allow SSH from anywhere" sits above the rule meant to block the attacker, so the
// attacker walks right in. Reorder the rules (or disable the bad one) so legit traffic still flows but the attacker
// is dropped. Every verdict is the real evaluator from firewall.ts. Default-DROP is the secure baseline.
import { useMemo, useState } from 'react';
import { evaluate, type Rule, type Packet, type Policy, type Action } from './firewall';

type IdRule = Rule & { id: number };
const START: IdRule[] = [
  { id: 1, proto: 'tcp', src: 'any', dport: 22, action: 'ACCEPT' },              // the bug: SSH from ANYWHERE
  { id: 2, proto: 'tcp', src: 'any', dport: 80, action: 'ACCEPT' },
  { id: 3, proto: 'tcp', src: 'any', dport: 443, action: 'ACCEPT' },
  { id: 4, proto: 'tcp', src: '203.0.113.0/24', dport: 22, action: 'DROP' },     // meant to block the attacker — unreachable here
];

// The traffic we test the chain against; `allow` is the intended outcome.
const TRAFFIC: { label: string; pkt: Packet; allow: boolean }[] = [
  { label: 'web visitor', pkt: { proto: 'tcp', src: '198.51.100.5', dport: 80 }, allow: true },
  { label: 'web visitor (TLS)', pkt: { proto: 'tcp', src: '198.51.100.5', dport: 443 }, allow: true },
  { label: 'admin SSH from office', pkt: { proto: 'tcp', src: '10.2.3.4', dport: 22 }, allow: true },
  { label: 'attacker SSH from internet', pkt: { proto: 'tcp', src: '203.0.113.9', dport: 22 }, allow: false },
  { label: 'port scan (8080)', pkt: { proto: 'tcp', src: '203.0.113.9', dport: 8080 }, allow: false },
];

const fmt = (r: Rule) => `${r.proto.padEnd(3)}  src ${r.src}  dport ${r.dport}`;

export function FirewallSection() {
  const [rules, setRules] = useState<IdRule[]>(START);
  const [policy, setPolicy] = useState<Policy>('DROP');

  const move = (i: number, d: -1 | 1) => setRules((rs) => {
    const j = i + d; if (j < 0 || j >= rs.length) return rs;
    const n = rs.slice(); [n[i], n[j]] = [n[j], n[i]]; return n;
  });
  const toggle = (id: number) => setRules((rs) => rs.map((r) => r.id === id ? { ...r, enabled: r.enabled === false } : r));
  const reset = () => { setRules(START); setPolicy('DROP'); };

  const results = useMemo(() => TRAFFIC.map((t) => {
    const { action, matchedIndex } = evaluate(rules, t.pkt, policy);
    const allowed = action === 'ACCEPT';
    return { ...t, action, matchedIndex, ok: allowed === t.allow };
  }), [rules, policy]);

  const correct = results.filter((r) => r.ok).length;
  const attackerIn = results.some((r) => !r.allow && r.action === 'ACCEPT');
  const solved = correct === TRAFFIC.length;
  const badge = (a: Action) => a === 'ACCEPT' ? 'accept' : 'drop';

  return (
    <div className="ipt">
      <div className={`ipt-goal ${solved ? 'ipt-won' : attackerIn ? 'ipt-leak' : ''}`}>
        <strong>Goal:</strong> serve the web to anyone and let the office SSH in, but keep the attacker out — a chain is
        read <strong>top-to-bottom and the first match wins</strong>. Right now {solved
          ? <b>every packet is handled correctly. </b>
          : attackerIn ? <b>the attacker's SSH is getting in. </b> : <b>legit traffic is blocked. </b>}
        {!solved && <>Reorder or disable rules to fix it — <b>{correct}/{TRAFFIC.length}</b> correct.</>}
        {solved && <>Default-DROP + specific allows, in the right order. <b>{correct}/{TRAFFIC.length}.</b></>}
      </div>

      <div className="ipt-cols">
        <div className="ipt-chain">
          <div className="ipt-lbl">INPUT chain — rules evaluated in order</div>
          {rules.map((r, i) => {
            const off = r.enabled === false;
            const decides = results.some((res) => res.matchedIndex === i);
            return (
              <div key={r.id} className={`ipt-rule ${badge(r.action)} ${off ? 'off' : ''} ${decides ? 'hot' : ''}`}>
                <span className="ipt-ord">{i}</span>
                <code className="ipt-match">{fmt(r)}</code>
                <span className={`ipt-act ${badge(r.action)}`}>{r.action}</span>
                <span className="ipt-ctl">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="move up">↑</button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === rules.length - 1} aria-label="move down">↓</button>
                  <button type="button" className={`ipt-en ${off ? '' : 'on'}`} onClick={() => toggle(r.id)} aria-label="enable/disable">{off ? '○' : '●'}</button>
                </span>
              </div>
            );
          })}
          <button type="button" className={`ipt-policy ${policy === 'DROP' ? 'drop' : 'accept'}`} onClick={() => setPolicy((p) => p === 'DROP' ? 'ACCEPT' : 'DROP')}>
            default policy: <b>{policy}</b> — click to flip
          </button>
        </div>

        <div className="ipt-traffic">
          <div className="ipt-lbl">TRAFFIC — evaluated live against the chain</div>
          {results.map((r) => (
            <div key={r.label} className={`ipt-pkt ${r.ok ? 'ipt-pass' : 'ipt-fail'}`}>
              <span className="ipt-pkt-lbl">{r.label}</span>
              <code className="ipt-pkt-flow">{r.pkt.src} → :{r.pkt.dport}</code>
              <span className={`ipt-verdict ${badge(r.action)}`}>{r.action}</span>
              <span className="ipt-by">{r.matchedIndex >= 0 ? `by rule ${r.matchedIndex}` : `policy`}</span>
              <span className="ipt-ok">{r.ok ? '✓' : (r.action === 'ACCEPT' ? '⚠ leaked' : '✗ blocked')}</span>
            </div>
          ))}
          <button type="button" className="ipt-reset" onClick={reset}>↺ reset to the buggy chain</button>
        </div>
      </div>

      <p className="ipt-foot">
        The lesson is <strong>order</strong>: a firewall stops at the <em>first</em> rule that matches, so a broad
        <code> ACCEPT …dport 22</code> above a specific <code>DROP</code> makes the DROP dead code — the attacker is
        already allowed. The robust pattern is <strong>default-DROP</strong> (deny by default) with narrow, specific
        <em> allow</em> rules above it, ordered most-specific first. Real iptables adds stateful matching
        (<code>-m state --state ESTABLISHED,RELATED</code>) so replies don't each need a rule, but the traversal is
        exactly this: top-down, first match wins, else the chain policy. (netfilter/iptables.)
      </p>
    </div>
  );
}
