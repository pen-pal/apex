// NAT traversal (ICE), made visible. Two peers behind NATs want to talk directly.
// Each gathers candidates (host / STUN-reflexive / TURN relay); ICE checks pairs and
// picks the best that works: same-LAN host, direct hole-punch via STUN (cone NATs),
// or a TURN relay (always works, adds a hop). Change the NAT types and watch the
// chosen media path change. Real ICE semantics (see nattraversal.ts).
import { useMemo, useState } from 'react';
import { negotiate, type NatType, type Peer } from './nattraversal';

const NATS: NatType[] = ['open', 'cone', 'symmetric'];
const CAND_LABEL: Record<string, string> = { host: 'host (LAN)', srflx: 'srflx (STUN)', relay: 'relay (TURN)' };

export function NatTraversalSection() {
  const [natA, setNatA] = useState<NatType>('cone');
  const [natB, setNatB] = useState<NatType>('cone');
  const [sameLan, setSameLan] = useState(false);

  const ice = useMemo(() => {
    const lan = sameLan ? '192.168.1.0' : '';
    const a: Peer = { name: 'A', nat: natA, lan: sameLan ? lan : '10.0.0.5' };
    const b: Peer = { name: 'B', nat: natB, lan: sameLan ? lan : '10.0.9.5' };
    return negotiate(a, b);
  }, [natA, natB, sameLan]);

  // SVG path geometry
  const A = { x: 70, y: 150 }, B = { x: 490, y: 150 }, STUN = { x: 200, y: 48 }, TURN = { x: 360, y: 48 };
  const sel = ice.selected;

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>NAT traversal — connecting two peers behind NATs</h2></div>
        <p className="jsec-sub">
          Two peers (a video call, a game) both sit behind NATs with private addresses — neither can be dialed directly.
          <strong> ICE</strong> solves it: each peer gathers candidate addresses (its LAN address, its public address via a
          <strong> STUN</strong> server, and a <strong>TURN</strong> relay), they trade lists, and try to connect, preferring
          a direct path. Symmetric NATs break hole-punching and force the relay. Change the NAT types and watch.
        </p>

        <div className="nt-controls">
          <label>Peer A NAT<select value={natA} onChange={(e) => setNatA(e.target.value as NatType)}>{NATS.map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
          <label>Peer B NAT<select value={natB} onChange={(e) => setNatB(e.target.value as NatType)}>{NATS.map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
          <label className="nt-same"><input type="checkbox" checked={sameLan} onChange={(e) => setSameLan(e.target.checked)} /> same LAN</label>
        </div>

        <svg className="nt-svg" viewBox="0 0 560 200" role="img" aria-label="NAT traversal">
          <defs><marker id="nt-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 z" fill="currentColor" /></marker></defs>
          {/* discovery to STUN (always, dashed) when going srflx */}
          {sel === 'srflx' && <>
            <line x1={A.x} y1={A.y} x2={STUN.x} y2={STUN.y} className="nt-discover" />
            <line x1={B.x} y1={B.y} x2={STUN.x} y2={STUN.y} className="nt-discover" />
          </>}
          {/* the chosen media path */}
          {sel === 'host' && <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} className="nt-media direct" />}
          {sel === 'srflx' && <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} className="nt-media direct" />}
          {sel === 'relay' && <>
            <line x1={A.x} y1={A.y} x2={TURN.x} y2={TURN.y} className="nt-media relay" />
            <line x1={TURN.x} y1={TURN.y} x2={B.x} y2={B.y} className="nt-media relay" />
          </>}
          {/* nodes */}
          <g className="nt-server"><rect x={STUN.x - 30} y={STUN.y - 16} width="60" height="32" rx="7" /><text x={STUN.x} y={STUN.y + 4} textAnchor="middle">STUN</text></g>
          <g className="nt-server"><rect x={TURN.x - 30} y={TURN.y - 16} width="60" height="32" rx="7" /><text x={TURN.x} y={TURN.y + 4} textAnchor="middle">TURN</text></g>
          {[{ p: A, nat: natA, name: 'Peer A' }, { p: B, nat: natB, name: 'Peer B' }].map(({ p, nat, name }) => (
            <g key={name} className="nt-peer">
              <circle cx={p.x} cy={p.y} r={26} />
              <text x={p.x} y={p.y - 2} textAnchor="middle" className="nt-peer-name">{name}</text>
              <text x={p.x} y={p.y + 11} textAnchor="middle" className="nt-peer-nat">{nat} NAT</text>
            </g>
          ))}
        </svg>

        <div className="nt-cands">
          {[{ name: 'Peer A', c: ice.candidatesA }, { name: 'Peer B', c: ice.candidatesB }].map(({ name, c }) => (
            <div className="nt-cand-col" key={name}>
              <div className="nt-cand-h">{name} candidates</div>
              {c.map((x) => <div key={x.type} className={`nt-cand ${x.type}`}>{CAND_LABEL[x.type]} <em>prio {x.priority}</em></div>)}
            </div>
          ))}
        </div>

        <div className="nt-checks">
          {ice.checks.map((ch) => (
            <div key={ch.type} className={`nt-check ${ch.works ? 'ok' : 'no'} ${ice.selected === ch.type ? 'sel' : ''}`}>
              <span className="nt-check-t">{CAND_LABEL[ch.type]}</span>
              <span className="nt-check-v">{ch.works ? '✓' : '✗'}</span>
              <span className="nt-check-r">{ch.reason}{ice.selected === ch.type ? '  ← selected' : ''}</span>
            </div>
          ))}
        </div>

        <div className={`nt-result ${ice.relayed ? 'relay' : 'direct'}`}>
          {ice.selected === 'host' && '🔗 Connected directly on the LAN (host candidate) — lowest latency.'}
          {ice.selected === 'srflx' && '🕳️ Hole-punched a DIRECT peer-to-peer path via STUN — no relay, media flows straight between the peers.'}
          {ice.selected === 'relay' && '↪ Fell back to a TURN RELAY — every packet detours through the relay server (extra latency + the operator pays for the bandwidth). This is what symmetric NATs force.'}
        </div>
        <p className="enc-note">STUN is cheap (a stateless “what’s my address?” reflector); TURN is expensive (it relays all your media). Roughly 8–20%
          of WebRTC calls can’t go direct and need TURN. This is why moving to IPv6 (no NAT) and the decline of symmetric NATs matter — and why every
          serious P2P app still has to run TURN servers as a fallback.</p>
      </section>
    </div>
  );
}
