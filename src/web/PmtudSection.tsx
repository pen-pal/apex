// Path MTU Discovery, made visible. A path of links with different MTUs; a DF packet
// starts too big and gets dropped at the narrow link, which bounces back an ICMP "too
// big" carrying that link's MTU. The sender shrinks and retries until the packet fits —
// or, with the ICMP-blocked toggle, never learns and the transfer black-holes. Each link
// MTU is editable. Real logic in pmtud.ts (tested on a worked path).
import { useMemo, useState } from 'react';
import { pmtud, type Link } from './pmtud';

const INIT: Link[] = [
  { name: 'eth0', mtu: 1500 },
  { name: 'tunnel', mtu: 1400 },
  { name: 'vpn', mtu: 1280 },
  { name: 'core', mtu: 1500 },
];

export function PmtudSection() {
  const [links, setLinks] = useState<Link[]>(INIT);
  const [size, setSize] = useState(1500);
  const [blocked, setBlocked] = useState(false);
  const [step, setStep] = useState(99);

  const r = useMemo(() => pmtud(links, size, blocked), [links, size, blocked]);
  const shown = Math.min(step, r.attempts.length);
  const cur = shown > 0 ? r.attempts[shown - 1] : null;

  const setMtu = (i: number, mtu: number) => setLinks((ls) => ls.map((l, j) => (j === i ? { ...l, mtu } : l)));

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Path MTU Discovery — find the narrowest link</h2></div>
        <p className="jsec-sub">
          A packet can only be as big as the smallest link it crosses. With the Don’t-Fragment bit set, an oversized packet is
          <em> dropped</em>, and the narrow router sends back an ICMP “fragmentation needed” carrying its MTU. The sender shrinks and
          retries — converging on the path MTU. Step through it, and toggle the firewall that eats those ICMPs.
        </p>

        <div className="pmtu-config">
          <label>packet size <input type="range" min={1000} max={1500} step={20} value={size} onChange={(e) => { setSize(+e.target.value); setStep(99); }} /><b>{size} B</b></label>
          <label className="pmtu-chk"><input type="checkbox" checked={blocked} onChange={(e) => { setBlocked(e.target.checked); setStep(99); }} /> 🚧 firewall blocks ICMP</label>
        </div>

        <div className="pmtu-path">
          {links.map((l, i) => {
            const dropHere = cur && cur.droppedAtHop === i;
            const passed = cur && (cur.droppedAtHop === null || i < cur.droppedAtHop);
            const tooSmall = cur && cur.size > l.mtu;
            return (
              <div key={i} className="pmtu-hop">
                <div className={`pmtu-link ${dropHere ? 'drop' : passed ? 'pass' : ''} ${tooSmall ? 'narrow' : ''}`}>
                  <div className="pmtu-name">{l.name}</div>
                  <input type="range" min={1200} max={1500} step={20} value={l.mtu} onChange={(e) => { setMtu(i, +e.target.value); setStep(99); }} />
                  <div className="pmtu-mtu">MTU {l.mtu}</div>
                  {dropHere && <div className="pmtu-drop-tag">✗ dropped ({cur!.size} &gt; {l.mtu})</div>}
                </div>
                {i < links.length - 1 && <div className="pmtu-arrow">→</div>}
              </div>
            );
          })}
        </div>

        <div className="pmtu-controls">
          <button onClick={() => setStep(0)} disabled={shown === 0}>⏮</button>
          <button onClick={() => setStep(Math.max(0, shown - 1))} disabled={shown === 0}>◀</button>
          <span className="pmtu-count">attempt {shown} / {r.attempts.length}</span>
          <button onClick={() => setStep(shown + 1)} disabled={shown >= r.attempts.length}>▶</button>
        </div>

        {cur && (
          <div className={`pmtu-msg ${cur.delivered ? 'ok' : blocked ? 'bad' : 'info'}`}>
            {cur.delivered
              ? `✓ ${cur.size}-byte packet fits every link — delivered.`
              : blocked
                ? `✗ dropped at ${links[cur.droppedAtHop!].name}, and the ICMP never comes back. The sender keeps retrying ${cur.size} B forever — a black hole.`
                : `✗ dropped at ${links[cur.droppedAtHop!].name}; ICMP "too big, MTU=${cur.icmpMtu}" returns → sender retries at ${cur.icmpMtu} B.`}
          </div>
        )}

        <div className={`pmtu-verdict ${r.blackHole ? 'bad' : 'ok'}`}>
          {r.blackHole ? '⛔ PMTUD black hole — connection stalls on large packets' : `🔎 discovered path MTU: ${r.pathMtu} bytes (in ${r.attempts.length} attempt${r.attempts.length === 1 ? '' : 's'})`}
        </div>

        <p className="pmtu-foot">
          This is behind a whole class of “small requests work, big transfers hang” bugs — a VPN or tunnel lowers the MTU and an
          over-aggressive firewall drops the ICMP that would fix it. Mitigations: allow ICMP Type 3 Code 4, clamp the TCP MSS to the
          path, or use Packetization-Layer PMTUD (RFC 4821), which probes with real data instead of relying on ICMP.
        </p>
      </section>
    </div>
  );
}
