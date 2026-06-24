// A learning Ethernet switch, made visible. Send a frame between hosts and watch
// the switch LEARN the source MAC into its CAM table, then either FLOOD (unknown
// destination or broadcast → out every other port) or FORWARD (known destination →
// one port only). Send a few and watch flooding stop as the table fills. Real
// switching logic (see switch.ts).
import { useMemo, useState } from 'react';
import { Switch, BROADCAST } from './switch';

interface Host { port: number; name: string; mac: string }
const HOSTS: Host[] = [
  { port: 1, name: 'PC-A', mac: 'aa:aa:aa:aa:aa:aa' },
  { port: 2, name: 'PC-B', mac: 'bb:bb:bb:bb:bb:bb' },
  { port: 3, name: 'PC-C', mac: 'cc:cc:cc:cc:cc:cc' },
  { port: 4, name: 'PC-D', mac: 'dd:dd:dd:dd:dd:dd' },
];
const byMac = (mac: string) => HOSTS.find((h) => h.mac === mac);
interface Frame { src: string; dst: string; inPort: number }

export function SwitchSection() {
  const [events, setEvents] = useState<Frame[]>([]);
  const [srcPort, setSrcPort] = useState(1);
  const [dstSel, setDstSel] = useState('bb:bb:bb:bb:bb:bb'); // mac or 'broadcast'

  const { table, last, lastFrame } = useMemo(() => {
    const sw = new Switch(HOSTS.length);
    let last = null as ReturnType<Switch['frame']> | null;
    for (const e of events) last = sw.frame(e.src, e.dst, e.inPort);
    return { table: sw.table, last, lastFrame: events[events.length - 1] ?? null };
  }, [events]);

  const send = () => {
    const src = HOSTS.find((h) => h.port === srcPort)!;
    const dst = dstSel === 'broadcast' ? BROADCAST : dstSel;
    setEvents((es) => [...es, { src: src.mac, dst, inPort: src.port }]);
  };
  const reset = () => setEvents([]);

  const egress = new Set(last?.egress ?? []);
  const ingress = lastFrame?.inPort ?? null;
  const flooding = last?.action === 'flood-unknown' || last?.action === 'flood-broadcast';

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Ethernet switch — learning where everyone lives</h2></div>
        <p className="jsec-sub">
          A switch starts knowing nothing. For each frame it <strong>learns</strong> the source MAC is on the port it
          arrived from, then decides where to send it: if it already knows the destination, it <strong>forwards</strong> to
          just that port; if not (or it’s a broadcast), it <strong>floods</strong> out every other port. Send frames and
          watch the flooding stop as the table fills.
        </p>

        <div className="lsw-controls">
          <label>from<select value={srcPort} onChange={(e) => setSrcPort(+e.target.value)}>{HOSTS.map((h) => <option key={h.port} value={h.port}>{h.name} (port {h.port})</option>)}</select></label>
          <label>to<select value={dstSel} onChange={(e) => setDstSel(e.target.value)}>
            {HOSTS.map((h) => <option key={h.mac} value={h.mac}>{h.name}</option>)}
            <option value="broadcast">broadcast (ff:ff:…)</option>
          </select></label>
          <button className="ghost small" onClick={send}>send frame →</button>
          <button className="ghost small" onClick={reset}>↺ reset</button>
        </div>

        <div className="lsw-fabric">
          <div className="lsw-hosts">
            {HOSTS.map((h) => {
              const isSrc = ingress === h.port;
              const isEgress = egress.has(h.port);
              return (
                <div key={h.port} className="lsw-host-col">
                  <div className={`lsw-host ${isSrc ? 'src' : ''} ${isEgress ? (flooding ? 'flood' : 'fwd') : ''}`}>
                    <div className="lsw-host-name">{h.name}</div>
                    <code>{h.mac.slice(0, 5)}…</code>
                  </div>
                  <div className={`lsw-cable ${isSrc ? 'in' : ''} ${isEgress ? (flooding ? 'flood' : 'fwd') : ''}`} />
                  <div className={`lsw-port ${isSrc ? 'in' : ''} ${isEgress ? (flooding ? 'flood' : 'fwd') : ''}`}>p{h.port}</div>
                </div>
              );
            })}
          </div>
          <div className="lsw-box">SWITCH · CAM table</div>
        </div>

        {last && (
          <div className={`lsw-action ${last.action}`}>
            <strong>{byMac(lastFrame!.src)?.name} → {lastFrame!.dst === BROADCAST ? 'broadcast' : byMac(lastFrame!.dst)?.name}</strong>{' '}
            · {last.learned ? 'learned source · ' : ''}{labelFor(last.action)} {last.egress.length ? `out port${last.egress.length > 1 ? 's' : ''} ${last.egress.join(', ')}` : '(dropped)'}
            <div className="lsw-reason">{last.reason}</div>
          </div>
        )}

        <table className="lsw-cam">
          <thead><tr><th>MAC address</th><th>port</th><th>host</th></tr></thead>
          <tbody>
            {table.length === 0 && <tr><td colSpan={3} className="lsw-empty">— empty — send a frame to start learning</td></tr>}
            {table.map((e) => (
              <tr key={e.mac}><td className="lsw-mono">{e.mac}</td><td className="lsw-mono">{e.port}</td><td>{byMac(e.mac)?.name ?? '?'}</td></tr>
            ))}
          </tbody>
        </table>
        <p className="enc-note">This learning is also a security surface: flood a switch with thousands of fake source MACs (a <em>CAM-table
          overflow</em>) and it runs out of table space, falling back to flooding everything — letting an attacker sniff traffic that should have
          been switched privately. Port security limits MACs per port to stop exactly that.</p>
      </section>
    </div>
  );
}

function labelFor(a: string): string {
  return a === 'forward' ? 'forwarded' : a === 'filter' ? 'filtered' : a === 'flood-broadcast' ? 'flooded (broadcast)' : 'flooded (unknown unicast)';
}
