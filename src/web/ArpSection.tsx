// ARP resolution, made visible. To send to an IP on the LAN you need its MAC. Each
// host keeps an ARP cache; on a miss it broadcasts "who has X?", the owner replies
// "X is at <mac>", and the answer is cached so the next send skips ARP. A gratuitous
// ARP (after an IP moves to a new NIC) updates everyone's cache. Real ARP semantics
// (see arp.ts). The legit mechanism — the Attacks section shows how it's abused.
import { useEffect, useState } from 'react';
import { resolve, gratuitous, type Host, type Cache } from './arp';

const INITIAL: Host[] = [
  { ip: '192.168.1.10', mac: '00:1a:aa', name: 'PC-A' },
  { ip: '192.168.1.20', mac: '00:1b:bb', name: 'PC-B' },
  { ip: '192.168.1.30', mac: '00:1c:cc', name: 'PC-C' },
  { ip: '192.168.1.1', mac: '00:1d:dd', name: 'Gateway' },
];
const UNKNOWN = '192.168.1.99';

export function ArpSection() {
  const [hosts, setHosts] = useState<Host[]>(INITIAL);
  const [caches, setCaches] = useState<Record<string, Cache>>({});
  const [sender, setSender] = useState('192.168.1.10');
  const [target, setTarget] = useState('192.168.1.1');
  const [clock, setClock] = useState(1);
  const [steps, setSteps] = useState<ReturnType<typeof resolve>['steps']>([]);
  const [active, setActive] = useState<{ sender: string; owner: string | null; broadcast: boolean } | null>(null);

  const cacheOf = (ip: string): Cache => caches[ip] ?? {};

  const sendPair = (from: string, to: string) => {
    setSender(from); setTarget(to);
    const s = hosts.find((h) => h.ip === from)!;
    const r = resolve(s, to, cacheOf(from), hosts, clock);
    setCaches((c) => ({ ...c, [from]: r.cache }));
    setSteps(r.steps);
    setActive({ sender: from, owner: r.mac ? to : null, broadcast: r.broadcast });
    setClock((c) => c + 1);
  };
  const send = () => sendPair(sender, target);

  // cinematic auto-play: loop a little script — cold-miss broadcast, then a cache hit, then another host resolves,
  // then reset — so ARP visibly resolves on its own (hosts light up, the log fills, caches build). Any manual control pauses it.
  const [auto, setAuto] = useState(true);
  const [ai, setAi] = useState(0);
  const SEQ: { act: 'reset' | 'send'; from?: string; to?: string }[] = [
    { act: 'reset' },
    { act: 'send', from: '192.168.1.10', to: '192.168.1.1' },
    { act: 'send', from: '192.168.1.10', to: '192.168.1.1' },
    { act: 'send', from: '192.168.1.20', to: '192.168.1.30' },
  ];
  useEffect(() => {
    if (!auto) return;
    const st = SEQ[ai];
    if (st.act === 'reset') { setCaches({}); setSteps([]); setActive(null); }
    else sendPair(st.from!, st.to!);
    const t = setTimeout(() => setAi((i) => (i + 1) % SEQ.length), st.act === 'reset' ? 900 : 2600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, ai]);
  const manual = (fn: () => void) => { setAuto(false); fn(); };

  const gratuitousFrom = (ip: string, failover: boolean) => {
    let announcer = hosts.find((h) => h.ip === ip)!;
    if (failover) {
      const newMac = `00:9${ip.slice(-1)}:fe`;
      announcer = { ...announcer, mac: newMac };
      setHosts((hs) => hs.map((h) => (h.ip === ip ? announcer : h)));
    }
    setCaches((c) => gratuitous(announcer, c, clock));
    setSteps([{ kind: 'reply', ip, mac: announcer.mac, from: ip } as never]);
    setActive({ sender: ip, owner: null, broadcast: true });
    setClock((c) => c + 1);
  };

  const reset = () => { setHosts(INITIAL); setCaches({}); setSteps([]); setActive(null); setClock(1); };

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>ARP — finding the MAC behind an IP</h2></div>
        <p className="jsec-sub">
          Every machine on a network has <strong>two</strong> addresses. Its <strong>IP address</strong> is a logical label
          that routes across the internet and can move between machines; its <strong>MAC address</strong> is a fixed serial
          number burned into the network card. To actually hand a frame to a machine on your local wire — the
          <strong> LAN</strong>, the devices sharing one switch — you need its MAC, but you only know its IP. <strong>ARP</strong>
          bridges the two: check a small cache; on a miss, <strong>broadcast</strong> to everyone (“who has 192.168.1.1?”),
          the owner <strong>replies</strong> (“it’s at 00:1d:dd”), and you cache the answer so the next send skips all this.
          Pick a sender and target and watch.
        </p>

        <div className="arp-controls">
          <button className={`ghost small arp-auto ${auto ? 'on' : ''}`} onClick={() => setAuto((a) => !a)}>{auto ? '❚❚ pause' : '▶ auto-play'}</button>
          <label>from<select value={sender} onChange={(e) => manual(() => setSender(e.target.value))}>{hosts.map((h) => <option key={h.ip} value={h.ip}>{h.name}</option>)}</select></label>
          <label>send to<select value={target} onChange={(e) => manual(() => setTarget(e.target.value))}>
            {hosts.filter((h) => h.ip !== sender).map((h) => <option key={h.ip} value={h.ip}>{h.name} ({h.ip})</option>)}
            <option value={UNKNOWN}>unknown ({UNKNOWN})</option>
          </select></label>
          <button className="ghost small" onClick={() => manual(send)}>send →</button>
          <button className="ghost small" onClick={() => manual(() => gratuitousFrom(target === UNKNOWN ? sender : target, true))}>⚡ {hosts.find((h) => h.ip === (target === UNKNOWN ? sender : target))?.name} fails over (gratuitous ARP)</button>
          <button className="ghost small" onClick={() => manual(reset)}>↺ reset</button>
        </div>

        <div className="arp-hosts">
          {hosts.map((h) => {
            const cache = cacheOf(h.ip);
            const isSender = active?.sender === h.ip;
            const isOwner = active?.owner === h.ip;
            const heard = active?.broadcast && !isSender;
            return (
              <div key={h.ip} className={`arp-host ${isSender ? 'sender' : ''} ${isOwner ? 'owner' : ''} ${heard ? 'heard' : ''}`}>
                <div className="arp-h-name">{h.name}</div>
                <code className="arp-h-id">{h.ip}<br />{h.mac}</code>
                <div className="arp-cache">
                  <div className="arp-cache-h">ARP cache</div>
                  {Object.keys(cache).length === 0 && <div className="arp-empty">— empty —</div>}
                  {Object.entries(cache).map(([ip, e]) => <div key={ip} className="arp-entry"><code>{ip}</code> → <code>{e.mac}</code></div>)}
                </div>
              </div>
            );
          })}
        </div>

        {steps.length > 0 && (
          <div className="arp-log">
            {steps.map((s, i) => (
              <div key={i} className={`arp-step ${s.kind}`}>
                {s.kind === 'cache-hit' && `✓ cache hit — ${s.ip} is at ${s.mac} (no ARP needed)`}
                {s.kind === 'broadcast' && `📢 BROADCAST: who has ${s.ip}? tell ${s.from}  (sent to ff:ff:ff:ff:ff:ff)`}
                {s.kind === 'reply' && `← ${s.from} replies: ${s.ip} is at ${s.mac}  (unicast)`}
                {s.kind === 'learned' && `🗂 cached: ${s.ip} → ${s.mac}`}
                {s.kind === 'unresolved' && `✗ no reply — ${s.ip} is not on this LAN (host unreachable)`}
              </div>
            ))}
          </div>
        )}
        <p className="enc-note">ARP has no authentication — any host can claim any IP, which is exactly the door the ARP-spoofing attack (in the
          Attacks section) walks through. A gratuitous ARP is the legitimate version of the same packet: a host shouting “I now own this IP” so switches
          and peers update their tables — essential for failover (a standby server taking over a virtual IP) and for detecting IP conflicts.</p>
      </section>
    </div>
  );
}
