// Onion (hidden) services — reach a server with no public IP, with neither side learning the other's location. Made
// hands-on: compromise relays on the two Tor circuits and watch what the adversary learns. No single relay ever sees
// both ends (mutual anonymity); only collecting the client IP from one relay AND the service IP from another — both
// guards — deanonymizes, which is the real end-to-end correlation attack. Model + property tests in onionservice.ts.
import { useMemo, useState } from 'react';
import { TOPOLOGY, adversaryView, type RelayRole } from './onionservice';

const CLIENT_IP = '198.51.100.7';
// The circuit as a chain of relays between the two endpoints; the intro point hangs off the service side.
const CHAIN = ["client's guard", "client's middle", 'rendezvous point', "service's middle", "service's guard"];

export function OnionServiceSection() {
  const [pwned, setPwned] = useState<Set<string>>(new Set());
  const controlled = useMemo(() => TOPOLOGY.filter((r) => pwned.has(r.role)), [pwned]);
  const view = adversaryView(controlled);
  const toggle = (role: string) => setPwned((s) => { const n = new Set(s); n.has(role) ? n.delete(role) : n.add(role); return n; });
  const byRole = (r: string) => TOPOLOGY.find((t) => t.role === r)!;

  const chip = (r: RelayRole) => {
    const on = pwned.has(r.role);
    const leaks = r.seesClientIp ? 'client IP' : r.seesServiceIp ? 'service IP' : 'nothing';
    return (
      <button type="button" key={r.role} className={`ons-relay ${on ? 'pwned' : ''} ${r.seesClientIp || r.seesServiceIp ? 'guard' : ''}`} onClick={() => toggle(r.role)}>
        <span className="ons-relay-name">{r.role.replace("'s", '’s')}</span>
        {on && <span className="ons-relay-leak">sees: {leaks}</span>}
      </button>
    );
  };

  return (
    <div className="ons">
      <p className="ons-intro">
        Normally a server has an IP you connect to — so it can be found, blocked, or seized. An <strong>onion service</strong>
        {' '}(a <code>.onion</code> address) has <em>no public IP at all</em>, and the anonymity is <strong>mutual</strong>:
        neither side learns the other's location. Both reach a <strong>rendezvous point</strong> over their own 3-hop circuit,
        so it splices two circuits without seeing two IPs. <strong>Compromise relays below</strong> and see what leaks.
      </p>

      <div className="ons-net">
        <div className="ons-end client"><span className="ons-end-ico">👤</span><span className="ons-end-lbl">client</span><code>{view.seesClientIp ? CLIENT_IP : 'IP hidden'}</code></div>
        <div className="ons-chain">
          {CHAIN.map((role, i) => (
            <span key={role} className="ons-hop">
              {i > 0 && <span className="ons-link" aria-hidden="true" />}
              {chip(byRole(role))}
            </span>
          ))}
        </div>
        <div className="ons-end service"><span className="ons-end-ico">🧅</span><span className="ons-end-lbl">service</span><code>{view.seesServiceIp ? 'location exposed' : '.onion · no IP'}</code></div>
        <div className="ons-intro-pt">also on the service side: {chip(byRole('introduction point'))}</div>
      </div>

      <div className={`ons-verdict ${view.canDeanonymize ? 'broken' : 'safe'}`}>
        <div className="ons-verdict-h">
          {controlled.length === 0 ? 'adversary controls no relays' : `adversary controls ${controlled.length} relay${controlled.length > 1 ? 's' : ''}`}
        </div>
        <div className="ons-verdict-grid">
          <div className={view.seesClientIp ? 'yes' : 'no'}>client IP · {view.seesClientIp ? 'exposed' : 'hidden'}</div>
          <div className={view.seesServiceIp ? 'yes' : 'no'}>service location · {view.seesServiceIp ? 'exposed' : 'hidden'}</div>
          <div className={view.canDeanonymize ? 'yes' : 'no'}>deanonymized · {view.canDeanonymize ? 'YES' : 'no'}</div>
        </div>
        <p className="ons-verdict-txt">
          {view.canDeanonymize
            ? 'Both ends linked. You control a relay that sees the client and one that sees the service — that’s the end-to-end correlation attack, and in Tor it means controlling BOTH guards (or watching both). No relay did it alone.'
            : controlled.length > 0
              ? 'Still anonymous. Every interior relay sees only circuit traffic; a single guard sees only its own side. Mutual anonymity holds until you control a relay on the client end AND one on the service end.'
              : 'Click relays to compromise them. You’ll find no single one links both ends.'}
        </p>
      </div>

      <p className="ons-foot">
        The address <em>is</em> the service's public key, so the descriptor is <strong>self-authenticating</strong> — no
        certificate authority, and you're guaranteed the real service, not an impostor. This is the backbone of
        censorship-resistant publishing (and hidden marketplaces): no server location to raid, no domain to seize. Its real
        weakness isn't a single relay — it's <strong>guard discovery + traffic correlation</strong> by an adversary who can
        watch or control both ends, which is why guards rotate slowly and why higher-latency designs (see <strong>mix
        networks</strong>) resist it better. (Tor rendezvous spec; v3 onion services.)
      </p>
    </div>
  );
}
