// BGP route propagation & hijacking, made visible. A prefix is announced by its
// real origin and floods across the ASes (each prepends its number, keeps the
// shortest path). Flip on a hijack — a rogue AS announcing the same prefix — and
// watch the ASes nearer the attacker switch to routing toward it (red arrows). A
// more-specific announcement captures everyone. Real path selection (bgphijack.ts).
import { useMemo, useState } from 'react';
import { propagate, hijack, routesTo, type AsGraph } from './bgphijack';

const ORIGIN = 1, ROGUE = 5;
const GRAPH: AsGraph = { nodes: [1, 2, 3, 4, 5, 6], edges: [[1, 2], [2, 3], [3, 4], [4, 5], [3, 6]] };
const POS: Record<number, { x: number; y: number }> = {
  1: { x: 60, y: 110 }, 2: { x: 175, y: 110 }, 3: { x: 290, y: 110 }, 4: { x: 405, y: 110 }, 5: { x: 520, y: 110 }, 6: { x: 290, y: 215 },
};

export function BgpHijackSection() {
  const [attack, setAttack] = useState(false);
  const [moreSpecific, setMoreSpecific] = useState(false);

  const result = useMemo(() => {
    if (!attack) return { prop: propagate(GRAPH, [ORIGIN]), captured: [] as number[] };
    const h = hijack(GRAPH, ORIGIN, ROGUE, moreSpecific);
    return { prop: h.prop, captured: h.captured };
  }, [attack, moreSpecific]);

  const colorFor = (n: number): string => {
    if (n === ORIGIN) return 'hsl(212 70% 50%)';
    if (attack && n === ROGUE) return 'hsl(0 70% 50%)';
    return routesTo(result.prop, n) === ROGUE ? 'hsl(0 65% 58%)' : 'hsl(212 60% 62%)';
  };

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>BGP route propagation &amp; hijacking</h2></div>
        <p className="jsec-sub">
          The internet has no central map — each AS just tells its neighbors “to reach this prefix, go through me”, prepending
          its number to the path. Everyone keeps the <strong>shortest AS_PATH</strong>. The flaw: BGP trusts those
          announcements. A rogue AS that announces the <strong>same prefix</strong> steals the traffic of every AS for whom its
          path is shorter — a <strong>BGP hijack</strong>. Toggle the attack and watch the routes flip.
        </p>

        <div className="bh-controls">
          <label className="bh-toggle"><input type="checkbox" checked={attack} onChange={(e) => setAttack(e.target.checked)} /> AS{ROGUE} hijacks the prefix</label>
          <label className={`bh-toggle ${!attack ? 'dim' : ''}`}><input type="checkbox" checked={moreSpecific} disabled={!attack} onChange={(e) => setMoreSpecific(e.target.checked)} /> announce a more-specific prefix</label>
        </div>

        <svg className="bh-svg" viewBox="0 0 580 260" role="img" aria-label="AS topology">
          <defs>
            <marker id="bh-blue" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="hsl(212 60% 50%)" /></marker>
            <marker id="bh-red" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="hsl(0 65% 52%)" /></marker>
          </defs>
          {GRAPH.edges.map(([a, b], i) => <line key={i} x1={POS[a].x} y1={POS[a].y} x2={POS[b].x} y2={POS[b].y} className="bh-edge" />)}
          {/* forwarding arrows: each AS → its next hop toward the prefix */}
          {GRAPH.nodes.map((n) => {
            const route = result.prop.best[n];
            if (!route || route.asPath.length < 2) return null;
            const next = route.asPath[1];
            const p1 = POS[n], p2 = POS[next];
            const toRogue = routesTo(result.prop, n) === ROGUE;
            const dx = p2.x - p1.x, dy = p2.y - p1.y, len = Math.hypot(dx, dy);
            const ex = p2.x - (dx / len) * 26, ey = p2.y - (dy / len) * 26;
            const sx = p1.x + (dx / len) * 26, sy = p1.y + (dy / len) * 26;
            return <line key={`a${n}`} x1={sx} y1={sy} x2={ex} y2={ey} className={`bh-arrow ${toRogue ? 'red' : 'blue'}`} markerEnd={`url(#${toRogue ? 'bh-red' : 'bh-blue'})`} />;
          })}
          {GRAPH.nodes.map((n) => {
            const path = result.prop.best[n]?.asPath ?? [];
            return (
              <g key={n}>
                <circle cx={POS[n].x} cy={POS[n].y} r={22} fill="#fff" stroke={colorFor(n)} strokeWidth={n === ORIGIN || (attack && n === ROGUE) ? 4 : 2.5} />
                <text x={POS[n].x} y={POS[n].y - 1} className="bh-asn" textAnchor="middle">AS{n}</text>
                <text x={POS[n].x} y={POS[n].y + 11} className="bh-path" textAnchor="middle">{path.join('·')}</text>
                {n === ORIGIN && <text x={POS[n].x} y={POS[n].y - 30} className="bh-tag origin" textAnchor="middle">prefix owner</text>}
                {attack && n === ROGUE && <text x={POS[n].x} y={POS[n].y - 30} className="bh-tag rogue" textAnchor="middle">🏴‍☠️ hijacker</text>}
              </g>
            );
          })}
        </svg>

        <div className={`bh-status ${attack ? (result.captured.length ? 'bad' : 'ok') : 'ok'}`}>
          {!attack
            ? 'No attack: every AS routes to the legitimate prefix owner (AS1) along the shortest path.'
            : moreSpecific
              ? `More-specific hijack: AS${ROGUE} announced a longer prefix, so longest-prefix match wins EVERYWHERE — all ${result.captured.length} ASes now send this traffic to the attacker.`
              : `Same-prefix hijack: ${result.captured.length} AS(es) [${result.captured.join(', ')}] now route to AS${ROGUE} (its path is shorter for them). ASes nearer the real owner are unaffected — a partial blackhole.`}
        </div>
        <p className="enc-note">This isn’t theoretical: the 2008 “Pakistan/YouTube” outage and the 2018 Amazon Route 53 theft were exactly this. The
          defense is <strong>RPKI/ROA</strong> — cryptographically signed records saying “only AS1 may originate this prefix”, so routers can drop the
          rogue announcement (route origin validation). Path validation (BGPsec) goes further but is barely deployed.</p>
      </section>
    </div>
  );
}
