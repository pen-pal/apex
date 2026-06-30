// BGP route reflectors, made visible. Drag the router count and watch the full-mesh session count
// explode as n²/2 while a route reflector keeps it linear. The two little topologies show why: a full
// mesh wires everyone to everyone; the reflector is a hub with client spokes. Then inject a route from
// each kind of peer and see the RFC 4456 reflection rules decide where it goes. Real model from bgprr.ts.
import { useMemo, useState } from 'react';
import { fullMeshSessions, rrSessions, reflect, type Peer, type PeerKind } from './bgprr';

const PEERS: Peer[] = [
  { id: 'client A', kind: 'client' }, { id: 'client B', kind: 'client' },
  { id: 'peer X', kind: 'nonclient' }, { id: 'peer Y', kind: 'nonclient' },
];
const SOURCES: { kind: PeerKind; label: string; src: string }[] = [
  { kind: 'client', label: 'from a client', src: 'client A' },
  { kind: 'nonclient', label: 'from a non-client', src: 'peer X' },
  { kind: 'ebgp', label: 'from eBGP (external)', src: 'external' },
];

const Mesh = ({ n, rr }: { n: number; rr: boolean }) => {
  const R = 58, cx = 70, cy = 70;
  const pts = Array.from({ length: n }, (_, i) => ({ x: cx + R * Math.cos((2 * Math.PI * i) / n - Math.PI / 2), y: cy + R * Math.sin((2 * Math.PI * i) / n - Math.PI / 2) }));
  const edges: [number, number][] = [];
  if (rr) for (let i = 1; i < n; i++) edges.push([0, i]);
  else for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) edges.push([i, j]);
  return (
    <svg viewBox="0 0 140 152" className="rr-svg">
      {edges.map(([a, b], i) => <line key={i} x1={pts[a].x} y1={pts[a].y} x2={pts[b].x} y2={pts[b].y} className="rr-edge" />)}
      {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={i === 0 && rr ? 9 : 6} className={i === 0 && rr ? 'rr-hub' : 'rr-dot'} />)}
      <text x={70} y={146} className="rr-cap">{rr ? 'route reflector' : 'full mesh'}</text>
    </svg>
  );
};

export function BgpRrSection() {
  const [n, setN] = useState(8);
  const [si, setSi] = useState(0);
  const full = fullMeshSessions(n);
  const rr = rrSessions(n - 1, 0); // 1 RR + (n-1) clients
  const src = SOURCES[si];
  const recipients = useMemo(() => new Set(reflect(src.kind, PEERS, src.src)), [si]);

  return (
    <div className="rr">
      <div className="rr-scale">
        <label>iBGP routers <input type="range" min={4} max={40} value={n} onChange={(e) => setN(+e.target.value)} /><b>{n}</b></label>
        <div className="rr-counts">
          <div className="rr-count bad"><span>full mesh</span><b>{full}</b><i>sessions (n²/2)</i></div>
          <div className="rr-count ok"><span>1 route reflector</span><b>{rr}</b><i>sessions (≈ n)</i></div>
          <div className="rr-save">{(full / Math.max(1, rr)).toFixed(1)}× fewer</div>
        </div>
      </div>

      <div className="rr-topos"><Mesh n={6} rr={false} /><Mesh n={6} rr={true} /></div>

      <div className="rr-reflect">
        <div className="rr-reflect-h">reflection rules — inject a route:</div>
        <div className="rr-srcs">{SOURCES.map((s, i) => <button key={i} type="button" className={`rr-sbtn ${si === i ? 'on' : ''}`} onClick={() => setSi(i)}>{s.label}</button>)}</div>
        <div className="rr-peers">
          {PEERS.map((p) => (
            <div key={p.id} className={`rr-peer ${p.id === src.src ? 'src' : recipients.has(p.id) ? 'recv' : 'no'}`}>
              <span className="rr-pname">{p.id}</span>
              <span className="rr-pkind">{p.kind}</span>
              <span className="rr-pstat">{p.id === src.src ? 'source' : recipients.has(p.id) ? '↪ reflected' : '— not sent'}</span>
            </div>
          ))}
        </div>
        <div className="rr-rule">{src.kind === 'client' ? 'a route from a client is reflected to all other clients AND non-clients.' : src.kind === 'nonclient' ? 'a route from a non-client goes ONLY to clients — non-clients already have it via their own mesh.' : 'an eBGP route is advertised to every iBGP peer.'}</div>
      </div>

      <p className="rr-foot">
        The reason iBGP needs this at all: unlike eBGP, an iBGP router can’t use the AS-path to spot a loop (the path doesn’t change within an AS),
        so the rule is “don’t re-advertise an iBGP-learned route to another iBGP peer” — which forces the full mesh. A route reflector is trusted to
        relay between its clients, and the asymmetric rules (client routes go everywhere, non-client routes go only to clients) plus the
        <strong> CLUSTER_LIST</strong>/<strong>ORIGINATOR_ID</strong> attributes keep it loop-free even with multiple reflectors and redundancy. The
        alternative scaling tool is <strong>confederations</strong> (split the AS into sub-ASes that speak eBGP-like between them). Real networks use
        redundant reflectors per cluster so a single RR isn’t a SPOF. (RFC 4456.)
      </p>
    </div>
  );
}
