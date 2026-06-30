// Hinted handoff, made visible. Click nodes to knock them down, set the replication factor N and write
// quorum W, and watch a write land: healthy home replicas store normally, and each DOWN home replica's copy
// is parked as a hint on the next healthy node ("hold this for B"). The hint counts toward the quorum, so
// the write stays available. Then recover a node and replay its hints. Real model from hintedhandoff.ts.
import { useMemo, useState } from 'react';
import { write, recover, type Node } from './hintedhandoff';

const IDS = ['A', 'B', 'C', 'D', 'E'];

export function HintedHandoffSection() {
  const [down, setDown] = useState<Set<string>>(new Set(['B']));
  const [N, setN] = useState(3);
  const [W, setW] = useState(2);
  const [recovered, setRecovered] = useState<{ node: string; n: number } | null>(null);

  const prefList: Node[] = IDS.map((id) => ({ id, up: !down.has(id) }));
  const res = useMemo(() => write('user:42', 'profile', prefList, N, W), [down, N, W]);

  const roleOf = (id: string) => res.placements.find((p) => p.node === id);
  const hintsFor = (id: string) => res.hints.filter((h) => h.intendedFor === id);
  const toggle = (id: string) => { setDown((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; }); setRecovered(null); };

  return (
    <div className="hho">
      <p className="hho-intro">
        Each key has a <strong>preference list</strong> of nodes; the first <b>N</b> are its home replicas. When
        a home replica is down, the coordinator doesn't fail the write — it hands the value to the next healthy
        node with a <strong>hint</strong> ("hold this for B"). The hint counts toward the write quorum
        <b> W</b> (a <strong>sloppy quorum</strong>), so writes stay available; the node replays them on recovery.
      </p>

      <div className="hho-controls">
        <label>N (replicas) <input type="range" min={1} max={4} value={N} onChange={(e) => setN(+e.target.value)} /><b>{N}</b></label>
        <label>W (write quorum) <input type="range" min={1} max={4} value={W} onChange={(e) => setW(+e.target.value)} /><b>{W}</b></label>
        <span className="hho-hint-tip">click a node to toggle up/down</span>
      </div>

      <div className="hho-ring">
        {prefList.map((node, i) => {
          const role = roleOf(node.id);
          const isHome = i < N;
          const incoming = hintsFor(node.id);
          return (
            <div key={node.id} className={`hho-node ${node.up ? 'up' : 'down'} ${isHome ? 'home' : ''}`} onClick={() => toggle(node.id)} role="button">
              <div className="hho-nid">{node.id}{isHome && <span className="hho-home-tag">home</span>}</div>
              <div className="hho-nstate">{node.up ? '● up' : '○ down'}</div>
              {role?.role === 'replica' && <div className="hho-badge rep">stored ✓</div>}
              {role?.role === 'hint' && <div className="hho-badge hint">hint → {role.for}</div>}
              {!node.up && incoming.length > 0 && <div className="hho-badge waiting">awaiting replay</div>}
            </div>
          );
        })}
      </div>

      <div className="hho-status">
        <div className={`hho-stat ${res.durableHome >= N ? 'ok' : 'warn'}`}><span>true replicas</span><b>{res.durableHome}/{N}</b></div>
        <div className="hho-stat"><span>hints parked</span><b>{res.hints.length}</b></div>
        <div className={`hho-stat ${res.satisfied ? 'ok' : 'bad'}`}><span>acks vs W</span><b>{res.acks} / {W}</b></div>
        <div className={`hho-verdict ${res.satisfied ? 'ok' : 'bad'}`}>{res.satisfied ? '✓ write accepted' : '✗ quorum not met — write fails'}</div>
      </div>

      {res.hints.length > 0 && (
        <div className="hho-recover">
          <span className="hho-rlbl">recover a node →</span>
          {[...down].filter((id) => hintsFor(id).length > 0).map((id) => (
            <button key={id} type="button" onClick={() => setRecovered({ node: id, n: recover(id, res.hints).replayed.length })}>replay hints for {id}</button>
          ))}
          {[...down].filter((id) => hintsFor(id).length > 0).length === 0 && <span className="hho-rnone">no parked hints to replay</span>}
        </div>
      )}
      {recovered && (
        <div className="hho-replayed">↩ {recovered.node} came back online — <b>{recovered.n}</b> hint{recovered.n === 1 ? '' : 's'} replayed to it, then deleted. It now holds the write; the system is consistent again for this key.</div>
      )}

      <p className="hho-foot">
        Hinted handoff buys <strong>write availability</strong> at the cost of a window of inconsistency: a read
        with quorum R might briefly miss the value if it only hits home replicas that didn't get it yet — which
        is why Dynamo pairs it with <strong>read repair</strong> and <strong>anti-entropy (Merkle trees)</strong>
        to converge, and why a sloppy quorum is weaker than a strict one. If a hint-holder ALSO dies before
        replaying, the hint is lost and only anti-entropy will heal the gap. Tunable consistency (N, R, W with
        R+W&gt;N) lets you dial where you sit on the availability/consistency curve. (Dynamo, SOSP 2007;
        Cassandra and Riak implement this directly.)
      </p>
    </div>
  );
}
