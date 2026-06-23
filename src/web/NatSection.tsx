// NAT / PAT, made visible. A whole LAN shares one public IP: send outbound flows
// and watch the NAT box mint a unique public port for each, filling its translation
// table; send replies and watch them demux back to the exact internal host — or get
// dropped if unsolicited. The translation logic is real (see nat.ts).
import { useMemo, useState } from 'react';
import { Nat, type Endpoint } from './nat';

interface Host { id: string; name: string; ip: string; port: number }
const HOSTS: Host[] = [
  { id: 'A', name: 'Laptop', ip: '192.168.1.10', port: 33333 },
  { id: 'B', name: 'Phone', ip: '192.168.1.20', port: 44444 },
  { id: 'C', name: 'TV', ip: '192.168.1.30', port: 55555 },
];
interface Dest { id: string; name: string; ip: string; port: number }
const DESTS: Dest[] = [
  { id: 'web', name: 'example.com', ip: '93.184.216.34', port: 443 },
  { id: 'dns', name: '1.1.1.1', ip: '1.1.1.1', port: 53 },
  { id: 'api', name: 'api.example', ip: '198.51.100.9', port: 443 },
];
const PUBLIC_IP = '203.0.113.7';

type Event =
  | { kind: 'out'; src: Endpoint; dst: Endpoint }
  | { kind: 'in'; publicPort: number; from: Endpoint }
  | { kind: 'evil'; publicPort: number; from: Endpoint };

interface Logged { event: Event; text: string; ok: boolean; created?: boolean }

export function NatSection() {
  const [events, setEvents] = useState<Event[]>([]);
  const [host, setHost] = useState('A');
  const [dest, setDest] = useState('web');

  // Replay all events through a fresh NAT each render — deterministic + pure.
  const { mappings, log } = useMemo(() => {
    const nat = new Nat(PUBLIC_IP, 50000);
    const log: Logged[] = [];
    for (const e of events) {
      if (e.kind === 'out') {
        const r = nat.outbound(e.src, e.dst);
        log.push({ event: e, ok: true, created: r.created, text: `OUT  ${e.src.ip}:${e.src.port} → ${e.dst.ip}:${e.dst.port}   rewritten src → ${PUBLIC_IP}:${r.rewritten.port}${r.created ? '  (new entry)' : '  (reused)'}` });
      } else {
        const r = nat.inbound(e.publicPort, e.from);
        log.push({ event: e, ok: r.delivered, text: `IN   ${e.from.ip}:${e.from.port} → ${PUBLIC_IP}:${e.publicPort}   ${r.delivered ? `→ ${r.to!.ip}:${r.to!.port}` : 'DROPPED'}` });
      }
    }
    return { mappings: nat.mappings, log };
  }, [events]);

  const h = HOSTS.find((x) => x.id === host)!;
  const d = DESTS.find((x) => x.id === dest)!;
  const lastLog = log[log.length - 1];

  const sendOut = () => setEvents((es) => [...es, { kind: 'out', src: { ip: h.ip, port: h.port }, dst: { ip: d.ip, port: d.port } }]);
  const reply = (m: typeof mappings[number]) => setEvents((es) => [...es, { kind: 'in', publicPort: m.publicPort, from: { ip: m.dstIp, port: m.dstPort } }]);
  const evil = () => setEvents((es) => [...es, { kind: 'evil', publicPort: 51234, from: { ip: '6.6.6.6', port: 1337 } }]);
  const reset = () => setEvents([]);

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>NAT / PAT — one public IP for the whole network</h2></div>
        <p className="jsec-sub">
          Your devices have private addresses (192.168.x.x) that can’t appear on the internet. The router rewrites each
          outbound packet’s source to its single public IP plus a <strong>unique port</strong>, remembering the mapping so
          replies find their way home. Send some traffic and watch the translation table build.
        </p>

        <div className="nat-controls">
          <label>host
            <select value={host} onChange={(e) => setHost(e.target.value)}>{HOSTS.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.ip})</option>)}</select>
          </label>
          <label>destination
            <select value={dest} onChange={(e) => setDest(e.target.value)}>{DESTS.map((x) => <option key={x.id} value={x.id}>{x.name}:{x.port}</option>)}</select>
          </label>
          <button className="ghost small" onClick={sendOut}>send packet →</button>
          <button className="ghost small" onClick={evil}>☠ unsolicited inbound</button>
          <button className="ghost small" onClick={reset}>↺ reset</button>
        </div>

        <div className="nat-stage">
          <div className="nat-col">
            <div className="nat-col-h">LAN (private)</div>
            {HOSTS.map((x) => (
              <div key={x.id} className={`nat-host ${x.id === host ? 'sel' : ''} ${mappings.some((m) => m.innerIp === x.ip) ? 'active' : ''}`}>
                <div className="nat-host-name">{x.name}</div>
                <code>{x.ip}:{x.port}</code>
              </div>
            ))}
          </div>

          <div className="nat-box">
            <div className="nat-box-h">NAT router<br /><code>{PUBLIC_IP}</code></div>
            {lastLog && <div className={`nat-last ${lastLog.ok ? 'ok' : 'bad'}`}>{lastLog.text}</div>}
            <div className="nat-table">
              <div className="nat-tr nat-th"><span>inner</span><span>public</span><span>remote</span><span></span></div>
              {mappings.length === 0 && <div className="nat-empty">— empty — send a packet to create the first mapping</div>}
              {mappings.map((m) => (
                <div className="nat-tr" key={m.publicPort}>
                  <code>{m.innerIp}:{m.innerPort}</code>
                  <code className="hl">{PUBLIC_IP}:{m.publicPort}</code>
                  <code>{m.dstIp}:{m.dstPort}</code>
                  <button className="nat-reply" onClick={() => reply(m)} title="send a reply back through this mapping">← reply</button>
                </div>
              ))}
            </div>
          </div>

          <div className="nat-col">
            <div className="nat-col-h">Internet (public)</div>
            {DESTS.map((x) => (
              <div key={x.id} className={`nat-host ${x.id === dest ? 'sel' : ''}`}>
                <div className="nat-host-name">{x.name}</div>
                <code>{x.ip}:{x.port}</code>
              </div>
            ))}
            <div className="nat-host attacker"><div className="nat-host-name">☠ attacker</div><code>6.6.6.6</code></div>
          </div>
        </div>

        {log.length > 0 && (
          <div className="nat-log">
            {log.slice(-6).map((l, i) => <div key={i} className={`nat-log-row ${l.ok ? '' : 'bad'}`}>{l.text}</div>)}
          </div>
        )}
        <p className="enc-note">Because an inbound packet is only delivered when it matches a mapping the inside started, NAT doubles as a
          basic firewall — unsolicited connections from the internet have nowhere to go. It’s also why peer-to-peer apps need hole-punching
          (STUN/TURN) to get through.</p>
      </section>
    </div>
  );
}
