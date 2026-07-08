// Container bridge networking, made visible. A host with a Linux bridge (docker0), two containers plugged in by veth
// pairs, and the internet. Send a packet from "web" to the other container or out to the internet and watch the
// hop-by-hop source→destination, with NAT rewrites flagged. Break it: turn MASQUERADE off (egress strands the private
// source) or move "db" to its own bridge (isolated). Real routing rules + tests in bridgenet.ts.
import { useMemo, useState } from 'react';
import { send, INTERNET_IP, type Topology } from './bridgenet';

export function BridgeNetSection() {
  const [dst, setDst] = useState<'db' | 'internet'>('internet');
  const [masq, setMasq] = useState(true);
  const [sep, setSep] = useState(false);

  const topo: Topology = useMemo(() => ({
    hostPublicIp: '203.0.113.5',
    masquerade: masq,
    containers: [
      { name: 'web', ip: '172.17.0.2', bridge: 'docker0' },
      // on its own bridge, db lives in that bridge's subnet (172.18/16), which is exactly why it's unreachable.
      { name: 'db', ip: sep ? '172.18.0.2' : '172.17.0.3', bridge: sep ? 'br1' : 'docker0' },
    ],
  }), [masq, sep]);
  const [web, db] = topo.containers;

  const res = useMemo(() => send(topo, 'web', dst === 'db' ? 'db' : INTERNET_IP), [topo, dst]);

  return (
    <div className="bnet">
      <div className="bnet-controls">
        <div className="bnet-seg">
          <span>send from <code>web</code> to</span>
          <button type="button" className={dst === 'db' ? 'on' : ''} onClick={() => setDst('db')}>the db container</button>
          <button type="button" className={dst === 'internet' ? 'on' : ''} onClick={() => setDst('internet')}>the internet</button>
        </div>
        <label className="bnet-tog"><input type="checkbox" checked={masq} onChange={(e) => setMasq(e.target.checked)} /> MASQUERADE (SNAT)</label>
        <label className="bnet-tog"><input type="checkbox" checked={sep} onChange={(e) => setSep(e.target.checked)} /> put <code>db</code> on its own bridge</label>
      </div>

      <div className="bnet-topo">
        <div className="bnet-cloud">🌐 the internet<br /><code>{INTERNET_IP}</code></div>
        <div className="bnet-host">
          <div className="bnet-host-h"><code>host</code><span className={`bnet-nic ${masq ? 'on' : 'off'}`}>eth0 203.0.113.5 · {masq ? 'MASQUERADE on' : 'no SNAT'}</span></div>
          <div className="bnet-bridges">
            <div className="bnet-bridge">
              <div className="bnet-bridge-h">🌉 docker0 · 172.17.0.1/16</div>
              <div className="bnet-ctrs">
                <div className="bnet-ctr on-b">📦 web<br /><code>{web.ip}</code></div>
                {!sep && <div className="bnet-ctr on-b">📦 db<br /><code>{db.ip}</code></div>}
              </div>
            </div>
            {sep && (
              <div className="bnet-bridge bnet-iso">
                <div className="bnet-bridge-h">🌉 br1 · 172.18.0.1/16</div>
                <div className="bnet-ctrs"><div className="bnet-ctr">📦 db<br /><code>{db.ip}</code></div></div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bnet-trace">
        <div className="bnet-lbl">the packet, hop by hop</div>
        {res.hops.map((h, i) => (
          <div key={i} className={`bnet-hop ${h.rewrite ? 'bnet-nat' : ''}`}>
            <span className="bnet-where">{h.where}</span>
            <code className="bnet-flow"><b>{h.src}</b> → {h.dst}</code>
            {h.rewrite && <span className="bnet-tag">SNAT</span>}
            {h.note && <span className="bnet-note">{h.note}</span>}
          </div>
        ))}
        <div className={`bnet-verdict ${res.ok ? 'ok' : 'bad'}`}>{res.ok ? '✓ delivered' : '✗ dropped'} — {res.reason}</div>
      </div>

      <p className="bnet-foot">
        A container isn’t magic networking: it’s a process in its own <strong>network namespace</strong> (its own
        interfaces, IP, routes), joined to the host by a <strong>veth pair</strong> — a virtual cable whose far end
        plugs into a <strong>bridge</strong> that acts like a switch. Same bridge → containers talk directly at L2 with
        their private IPs. To reach the internet, a <strong>MASQUERADE</strong> (source-NAT) rule rewrites the private
        source to the host’s routable address so replies come back; that single rule is why <code>docker run</code>
        can curl the web at all. Publishing a port (<code>-p 8080:80</code>) is the mirror image — a
        <strong> DNAT</strong> rule sends host&nbsp;:8080 inbound to the container. Put a container on its own bridge and
        it’s isolated; that’s how Docker networks and Kubernetes NetworkPolicies fence workloads off. (Linux bridge + iptables NAT.)
      </p>
    </div>
  );
}
