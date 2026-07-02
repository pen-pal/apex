// IP anycast, made visible. Three sites all advertise one IP; each client is drawn to its
// nearest one, with a line to the instance it actually reaches. Withdraw a site (as BGP
// would on failure) and watch its clients instantly re-route to the next nearest, with the
// load tally updating. Real routing model in anycast.ts (tested).
import { useMemo, useState } from 'react';
import { distribute, type Site, type Client } from './anycast';

const SITES0: Site[] = [
  { id: 0, name: 'NYC', up: true }, { id: 1, name: 'LON', up: true }, { id: 2, name: 'TYO', up: true },
];
const SITE_POS = [{ x: 22, y: 30 }, { x: 50, y: 22 }, { x: 80, y: 38 }];

const CLIENTS: Client[] = [
  { id: 0, name: 'Boston', costs: [2, 8, 20] },
  { id: 1, name: 'Chicago', costs: [4, 9, 19] },
  { id: 2, name: 'Paris', costs: [9, 2, 18] },
  { id: 3, name: 'Berlin', costs: [11, 4, 16] },
  { id: 4, name: 'Osaka', costs: [22, 17, 1] },
  { id: 5, name: 'Seoul', costs: [21, 16, 3] },
];
const CLIENT_POS = [{ x: 12, y: 70 }, { x: 26, y: 82 }, { x: 44, y: 74 }, { x: 56, y: 84 }, { x: 76, y: 72 }, { x: 90, y: 80 }];

const COLORS = ['hsl(212 70% 52%)', 'hsl(150 55% 42%)', 'hsl(28 80% 52%)'];

export function AnycastSection() {
  const [sites, setSites] = useState<Site[]>(SITES0);
  const d = useMemo(() => distribute(CLIENTS, sites), [sites]);
  const toggle = (id: number) => setSites((s) => s.map((x) => (x.id === id ? { ...x, up: !x.up } : x)));

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Anycast — one IP, served from everywhere</h2></div>
        <p className="jsec-sub">
          The three sites below all advertise the <em>same</em> IP address into BGP. A client doesn’t choose one — the routing system
          simply delivers its packets to the topologically nearest instance. The payoff is built-in: low latency by geography, free load
          spreading, and instant failover. Click a site to withdraw it (simulate an outage) and watch its traffic re-route.
        </p>

        <div className="any-map">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="any-lines">
            {CLIENTS.map((c) => {
              const site = d.assignment[c.id];
              if (site === null) return null;
              const cp = CLIENT_POS[c.id], sp = SITE_POS[site];
              return <line key={c.id} x1={cp.x} y1={cp.y} x2={sp.x} y2={sp.y} stroke={COLORS[site]} strokeWidth={0.5} vectorEffect="non-scaling-stroke" />;
            })}
            {/* each client's packets flowing to its nearest site: a colored pulse glides client→site (re-routes on withdrawal) */}
            {CLIENTS.map((c) => {
              const site = d.assignment[c.id];
              if (site === null) return null;
              const cp = CLIENT_POS[c.id], sp = SITE_POS[site];
              return <line key={`f${c.id}`} className="any-flow" pathLength={100} x1={cp.x} y1={cp.y} x2={sp.x} y2={sp.y} stroke={COLORS[site]} vectorEffect="non-scaling-stroke" />;
            })}
          </svg>
          {sites.map((s) => (
            <button key={s.id} className={`any-site ${s.up ? 'up' : 'down'}`} style={{ left: `${SITE_POS[s.id].x}%`, top: `${SITE_POS[s.id].y}%`, borderColor: s.up ? COLORS[s.id] : undefined }} onClick={() => toggle(s.id)}>
              <span className="any-site-name">{s.name}</span>
              <span className="any-site-ip">203.0.113.1</span>
              <span className="any-site-load">{s.up ? `${d.load[s.id]} clients` : 'withdrawn'}</span>
            </button>
          ))}
          {CLIENTS.map((c) => (
            <div key={c.id} className="any-client" style={{ left: `${CLIENT_POS[c.id].x}%`, top: `${CLIENT_POS[c.id].y}%` }}>
              <span className="any-dot" style={{ background: d.assignment[c.id] === null ? '#999' : COLORS[d.assignment[c.id]!] }} />
              <span className="any-client-name">{c.name}</span>
            </div>
          ))}
        </div>

        <div className="any-table">
          {CLIENTS.map((c) => {
            const site = d.assignment[c.id];
            return (
              <div key={c.id} className="any-row">
                <span>{c.name}</span>
                <span style={{ color: site === null ? '#999' : COLORS[site] }}>→ {site === null ? 'unreachable' : sites[site].name}</span>
                <span className="any-cost">{site === null ? '—' : `cost ${d.cost[c.id]}`}</span>
              </div>
            );
          })}
        </div>

        <p className="any-foot">
          The same packets to the same IP reach different machines depending on where you are — which is exactly why anycast is perfect
          for stateless, read-mostly services: DNS (every root server is anycast), public resolvers like 1.1.1.1 and 8.8.8.8, NTP pools,
          and CDN edges. It’s also a DDoS defence: an attack is absorbed by the nearest site instead of concentrating on one. The catch is
          state — long-lived connections can break if routing shifts mid-session, so TCP-heavy anycast needs care (or per-flow stickiness).
        </p>
      </section>
    </div>
  );
}
