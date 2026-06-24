// Multicast & IGMP, made visible. One sender, many receivers — but only the hosts
// that JOINED the group should get the frame. An IGMP-snooping switch watches the
// membership reports and forwards a multicast frame out only the ports with a
// member, unlike a broadcast that floods every port. Join/leave hosts and watch the
// delivery change; drop the last member and the group is pruned. Model in
// multicast.ts (tested).
import { useState } from 'react';
import { join, leave, forward, isMulticast, type Host, type Membership } from './multicast';

const HOSTS: Host[] = [
  { id: 0, name: 'A', port: 1 },
  { id: 1, name: 'B', port: 2 },
  { id: 2, name: 'C', port: 3 },
  { id: 3, name: 'D', port: 4 },
];
const GROUP = '239.1.1.1';

export function MulticastSection() {
  const [members, setMembers] = useState<Membership>(() => join(join({}, GROUP, 0), GROUP, 2)); // A, C joined
  const [mode, setMode] = useState<'multicast' | 'broadcast'>('multicast');

  const joined = members[GROUP] ?? new Set<number>();
  const delivery = forward(members, GROUP, HOSTS, mode);
  const gets = new Set(delivery.delivered);
  const toggle = (h: Host) => setMembers((m) => (joined.has(h.id) ? leave(m, GROUP, h.id) : join(m, GROUP, h.id)));

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Multicast &amp; IGMP — one stream, only the subscribers</h2></div>
        <p className="jsec-sub">
          A multicast address (<code>{GROUP}</code>, in the <strong>224–239</strong> range — {isMulticast(GROUP) ? 'yes, multicast' : 'not multicast'}) names a{' '}
          <em>group</em>, not a host. Receivers <strong>JOIN</strong> by sending an IGMP report; an IGMP-snooping switch learns which
          of its ports have a member and forwards the frame out <strong>only those ports</strong>. Toggle membership and watch
          delivery follow.
        </p>

        <div className="mc-mode">
          <button className={mode === 'multicast' ? 'on' : ''} onClick={() => setMode('multicast')}>multicast (members only)</button>
          <button className={mode === 'broadcast' ? 'on' : ''} onClick={() => setMode('broadcast')}>broadcast (flood all)</button>
        </div>

        <div className="mc-diagram">
          <div className="mc-switch">
            <span className="mc-sw-icon">🔀</span> switch · sending frame → {GROUP}
            <span className="mc-sw-sub">{mode === 'multicast' ? `IGMP snooping → ports ${delivery.ports.join(', ') || '(none)'}` : 'flooding every port'}</span>
          </div>
          <div className="mc-hosts">
            {HOSTS.map((h) => {
              const isMember = joined.has(h.id);
              const receives = gets.has(h.id);
              return (
                <div key={h.id} className={`mc-host ${receives ? 'lit' : ''}`}>
                  <div className={`mc-wire ${receives ? 'on' : ''}`}>{receives ? '▼' : ''}</div>
                  <div className="mc-host-box">
                    <div className="mc-host-name">host {h.name} <span className="mc-port">port {h.port}</span></div>
                    <div className={`mc-recv ${receives ? 'yes' : 'no'}`}>{receives ? '📨 receives' : '— nothing'}</div>
                    <button className={`mc-join ${isMember ? 'in' : ''}`} onClick={() => toggle(h)}>{isMember ? 'LEAVE group' : 'JOIN group'}</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mc-summary">
          {mode === 'multicast' ? (
            joined.size === 0
              ? <>No members — the switch <strong>prunes</strong> the group and forwards the frame out <strong>no</strong> ports. The router stops pulling the stream onto this segment.</>
              : <>Members: <strong>{[...joined].map((id) => HOSTS[id].name).join(', ')}</strong>. The frame reaches exactly them — {delivery.delivered.length} of {HOSTS.length} hosts, out ports {delivery.ports.join(', ')}.</>
          ) : (
            <>Broadcast hits <strong>all {HOSTS.length}</strong> hosts regardless of membership — wasting bandwidth and CPU on every machine that didn’t ask for the stream. That’s exactly what multicast avoids.</>
          )}
        </div>

        <p className="mc-note">
          IGMP keeps this efficient end to end: hosts periodically renew membership, the switch ages out ports that stop reporting,
          and the upstream router only forwards the group onto a segment while ≥1 member exists — then prunes it. It’s how IPTV and
          live video reach thousands of viewers from one sender.
        </p>
      </section>
    </div>
  );
}
