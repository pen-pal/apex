// VRRP first-hop redundancy, made visible. Three routers share one virtual gateway IP + MAC; the
// highest-priority one is MASTER. Toggle routers up/down and watch mastership move — and see each
// backup's Master_Down timer, offset by a priority-based SKEW so the strongest backup times out first
// and takes over alone (no split-brain). Hosts never change their gateway. Logic from vrrp.ts (tested).
import { useMemo, useState } from 'react';
import { elect, masterDownInterval, virtualMac, skewTime, type Router } from './vrrp';

const ADV = 100; // Advertisement_Interval in centiseconds (1.00 s, the RFC default)
const VRID = 10, VIP = '192.168.1.1';
const INIT: Router[] = [
  { id: 'R1', priority: 200, up: true },
  { id: 'R2', priority: 150, up: true },
  { id: 'R3', priority: 100, up: true },
];

export function VrrpSection() {
  const [routers, setRouters] = useState<Router[]>(INIT);
  const e = useMemo(() => elect(routers, ADV), [routers]);
  const toggle = (id: string) => setRouters((rs) => rs.map((r) => (r.id === id ? { ...r, up: !r.up } : r)));
  const role = (r: Router) => (!r.up ? 'down' : r.id === e.master ? 'master' : 'backup');

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>VRRP — one virtual gateway, many routers</h2></div>
        <p className="jsec-sub">
          A host knows exactly one default gateway, so a single router failure would strand it. VRRP puts a group of routers behind one
          <strong> virtual IP</strong> and <strong>virtual MAC</strong>; the highest-priority router is <strong>master</strong> and answers for
          them. If it dies, a backup takes over and the virtual IP/MAC simply move — the host’s config never changes. The trick that stops two
          backups grabbing it at once is a <strong>skew</strong>: each backup’s takeover timer is offset by <code>(256 − priority)</code>, so the
          strongest backup fires first.
        </p>

        <div className="vrrp-vip">
          <div className="vrrp-host">🖥️ hosts<br /><span>gateway = {VIP}</span></div>
          <div className="vrrp-arrow">→</div>
          <div className="vrrp-virt">
            <div className="vrrp-vlbl">virtual router (VRID {VRID})</div>
            <div className="vrrp-vval">{VIP}</div>
            <div className="vrrp-vmac">{virtualMac(VRID)}</div>
            <div className="vrrp-served">served by <b>{e.master ?? '— nobody (all down!)'}</b></div>
          </div>
        </div>

        <div className="vrrp-routers">
          {routers.map((r) => {
            const ro = role(r);
            return (
              <div key={r.id} className={`vrrp-router ${ro}`}>
                <div className="vrrp-rhead"><b>{r.id}</b><span className={`vrrp-role ${ro}`}>{ro.toUpperCase()}</span></div>
                <div className="vrrp-prio">priority {r.priority}</div>
                {ro === 'backup' && <div className="vrrp-timer">Master_Down: {(masterDownInterval(r.priority, ADV) / 100).toFixed(2)}s <span>(skew {(skewTime(r.priority, ADV) / 100).toFixed(2)}s)</span></div>}
                {ro === 'master' && <div className="vrrp-timer master">advertising every {(ADV / 100).toFixed(2)}s</div>}
                <button onClick={() => toggle(r.id)}>{r.up ? '✕ fail' : '↻ restore'}</button>
              </div>
            );
          })}
        </div>

        <div className="vrrp-note">
          {e.master
            ? <>Master is <b>{e.master}</b> (highest priority that’s up). If it fails, <b>{e.backups[0] ?? 'no one'}</b> takes over after {e.backups[0] ? (masterDownInterval(routers.find((r) => r.id === e.backups[0])!.priority, ADV) / 100).toFixed(2) + 's' : '—'} — sooner than any weaker backup, so it wins cleanly.</>
            : <>Every router is down — the virtual IP is unreachable. Bring one back to restore the gateway.</>}
        </div>

        <p className="vrrp-foot">
          The win is that failover is invisible above the router: the same virtual IP and virtual MAC reappear on a new box, which sends a
          gratuitous ARP so the switches relearn the port — no host reconfiguration, no DNS change, sub-second recovery. <strong>Preemption</strong>
          lets a recovered higher-priority router take mastership back; tracking can lower a router’s priority when its uplink fails so it yields
          gracefully. HSRP (Cisco) and CARP (BSD) are the same idea; cloud “floating IPs” and keepalived are its descendants.
        </p>
      </section>
    </div>
  );
}
