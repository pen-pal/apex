// Traceroute, made visible. Fire probes with rising TTL and watch each router
// reveal itself: the probe travels TTL hops, the router there drops it and sends
// back ICMP Time Exceeded (its address + RTT), until the destination answers. Click
// a router to make it go silent (firewalls do this) and see the "* * *". Real model.
import { useEffect, useMemo, useState } from 'react';
import { traceroute, type Path } from './traceroute';

const DEFAULT_PATH: Path = {
  source: '192.168.1.5',
  dest: '93.184.216.34',
  hops: [
    { address: '192.168.1.1', rttMs: 1.2, responds: true },
    { address: '100.64.0.1', rttMs: 8.5, responds: true },
    { address: '203.0.113.9', rttMs: 14.0, responds: false },
    { address: '198.51.100.1', rttMs: 22.3, responds: true },
    { address: '93.184.216.34', rttMs: 24.1, responds: true },
  ],
};

export function TracerouteSection() {
  const [path, setPath] = useState<Path>(() => ({ ...DEFAULT_PATH, hops: DEFAULT_PATH.hops.map((h) => ({ ...h })) }));
  const rows = useMemo(() => traceroute(path), [path]);
  const [step, setStep] = useState(0); // start before the first probe so hops appear one by one
  const [playing, setPlaying] = useState(false);

  useEffect(() => { setStep(0); }, [path]); // reset to the start when the topology changes (also fires on mount)
  useEffect(() => {
    if (!playing) return;
    if (step >= rows.length) { setPlaying(false); return; }
    const id = setTimeout(() => setStep((s) => Math.min(s + 1, rows.length)), 700);
    return () => clearTimeout(id);
  }, [playing, step, rows.length]);

  const shown = rows.slice(0, step);
  const cur = shown[shown.length - 1];
  const toggleHop = (i: number) => {
    if (i === path.hops.length - 1) return; // keep the destination responsive
    setPath((p) => ({ ...p, hops: p.hops.map((h, j) => (j === i ? { ...h, responds: !h.responds } : h)) }));
  };

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Traceroute — mapping the path with TTL</h2></div>
        <p className="jsec-sub">
          Every router decrements a packet’s <strong>TTL</strong>; when it hits zero the router discards the packet and
          sends back an ICMP <em>Time Exceeded</em> — revealing itself. So traceroute sends probes with TTL 1, 2, 3… and
          each one comes back from one hop further out. Step through it, and <strong>click a router</strong> to make it go
          silent (a firewall that won’t reply) — that’s the <code>* * *</code> you sometimes see.
        </p>

        <div className="tr-controls">
          <button className="ghost small" onClick={() => { setStep(0); setPlaying(false); }}>⏮</button>
          <button className="ghost small" disabled={step >= rows.length} onClick={() => { setStep((s) => Math.min(rows.length, s + 1)); setPlaying(false); }}>fire probe (TTL {Math.min(step + 1, rows.length)}) →</button>
          <button className="ghost small" onClick={() => { if (step >= rows.length) setStep(0); setPlaying((p) => !p); }}>{playing ? '⏸' : '▶ run'}</button>
          <button className="ghost small" onClick={() => { setStep(rows.length); setPlaying(false); }}>all</button>
        </div>

        {/* path diagram */}
        <div className="tr-path">
          <div className="tr-node you">you<br /><code>{path.source}</code></div>
          {path.hops.map((h, i) => {
            const reached = cur ? i <= cur.hopIndex : false;
            const isCur = cur?.hopIndex === i;
            const isDest = i === path.hops.length - 1;
            const silent = !h.responds;
            return (
              <div key={i} className="tr-seg">
                <span className={`tr-wire ${reached ? 'on' : ''}`} />
                <button className={`tr-node ${isDest ? 'dest' : 'router'} ${reached ? 'reached' : ''} ${isCur ? 'cur' : ''} ${silent ? 'silent' : ''}`} onClick={() => toggleHop(i)} title={isDest ? 'destination' : 'click to toggle silent'}>
                  {silent && !isDest ? '🚫' : isDest ? '🎯' : '🖧'}<br />
                  <code>{silent && !isDest ? 'no reply' : h.address}</code>
                </button>
              </div>
            );
          })}
        </div>
        {cur && (
          <div className="tr-now">
            Probe <strong>TTL={cur.ttl}</strong> → {cur.kind === 'timeout' ? <span className="tr-star">router at hop {cur.hopIndex + 1} stayed silent (* * *)</span>
              : cur.kind === 'destination' ? <span className="tr-dest-msg">reached the destination {cur.address} in {cur.rttMs} ms ✓</span>
                : <>hop {cur.hopIndex + 1} <strong>{cur.address}</strong> replied Time Exceeded in {cur.rttMs} ms</>}
          </div>
        )}

        {/* output table */}
        <table className="tr-table">
          <thead><tr><th>hop</th><th>address</th><th>rtt</th><th>reply</th></tr></thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.ttl} className={r.reachedDest ? 'dest' : ''}>
                <td className="tr-mono">{r.ttl}</td>
                <td className="tr-mono">{r.address ?? '* * *'}</td>
                <td className="tr-mono">{r.rttMs != null ? `${r.rttMs} ms` : '—'}</td>
                <td>{r.kind === 'destination' ? 'destination reached' : r.kind === 'timeout' ? 'no response' : 'ICMP Time Exceeded'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="enc-note">Traceroute doesn’t need any special support from the routers — it just abuses the TTL field that already
          exists to stop packets looping forever. The RTTs climb with distance, and a row of <code>* * *</code> usually means a router (or firewall)
          configured not to send ICMP, not a broken path.</p>
      </section>
    </div>
  );
}
