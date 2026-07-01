// Kademlia, made visible. A small network of 8-bit node IDs and a target key. Run an iterative lookup and watch
// it converge on the node nearest the key by XOR distance — each queried node's binary ID is drawn with the bits
// it SHARES with the target highlighted, so you can see "closer" literally means "longer shared prefix." The
// start node's k-buckets show how few contacts it needs. Real model from kademlia.ts.
import { useMemo, useState } from 'react';
import { distance, sharedPrefix, bucketIndex, routingTable, lookup, nearest, BITS } from './kademlia';

const bin = (n: number) => n.toString(2).padStart(BITS, '0');

function IdBits({ id, target }: { id: number; target: number }) {
  const p = sharedPrefix(id, target);
  return <span className="kdm-bits">{[...bin(id)].map((b, i) => <span key={i} className={`kdm-b ${i < p ? 'match' : ''}`}>{b}</span>)}</span>;
}

export function KademliaSection() {
  const [net, setNet] = useState<number[]>([12, 33, 47, 65, 88, 101, 130, 150, 172, 199, 210, 233, 245, 20, 77, 160]);
  const [target, setTarget] = useState(140);
  const [k] = useState(2);

  const start = net[0];
  const res = useMemo(() => lookup(net, target, start, k), [net, target, k]);
  const truth = nearest(net, target);
  const table = useMemo(() => routingTable(start, net, k), [net, start, k]);

  const randomize = () => {
    let s = (net.reduce((a, b) => a + b, 0) * 131 + target) & 0x7fffffff;
    const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s % 256; };
    const set = new Set<number>(); while (set.size < 16) set.add(rnd());
    setNet([...set]); setTarget(rnd());
  };

  const buckets = useMemo(() => {
    const m = new Map<number, number[]>();
    for (const p of table) { const bi = bucketIndex(start, p); (m.get(bi) ?? m.set(bi, []).get(bi)!).push(p); }
    return [...m.entries()].sort((a, b) => b[0] - a[0]);
  }, [table, start]);

  return (
    <div className="kdm">
      <p className="kdm-intro">
        Kademlia measures "distance" between IDs as their bitwise <strong>XOR</strong> — so two IDs are close
        exactly when they share a long binary <strong>prefix</strong>. A node keeps <em>k-buckets</em> of contacts
        grouped by distance (many nearby, few far), and a lookup asks the closest peers it knows, then the closest
        THEY know, converging in O(log n) hops. Target key:
      </p>

      <label className="kdm-tf">target = <b>{target}</b> <IdBits id={target} target={target} /><input type="range" min={0} max={255} value={target} onChange={(e) => setTarget(+e.target.value)} /></label>
      <div className="kdm-controls"><span>start node: <b>{start}</b></span><button type="button" className="kdm-rand" onClick={randomize}>🎲 new network</button></div>

      <div className="kdm-path">
        <div className="kdm-plabel">lookup path — each hop shares more of the target's prefix (green) and shrinks XOR distance:</div>
        {res.path.map((n, i) => (
          <div key={i} className={`kdm-hop ${n === res.result ? 'best' : ''}`}>
            <span className="kdm-hn">#{i + 1} node {n}</span>
            <IdBits id={n} target={target} />
            <span className="kdm-hd">XOR {distance(n, target)}</span>
            <span className="kdm-hp">{sharedPrefix(n, target)}-bit prefix</span>
          </div>
        ))}
      </div>

      <div className={`kdm-result ${distance(res.result, target) === distance(truth, target) ? 'ok' : 'bad'}`}>
        {distance(res.result, target) === distance(truth, target)
          ? <><b>✓ found node {res.result}</b> — XOR distance {distance(res.result, target)} to the key, the closest node in the network, in <b>{res.hops}</b> queries.</>
          : <><b>node {res.result}</b> (true nearest is {truth})</>}
      </div>

      <div className="kdm-rt">
        <div className="kdm-plabel">start node {start}'s routing table — {table.length} contacts (buckets by distance):</div>
        <div className="kdm-buckets">
          {buckets.map(([bi, peers]) => (
            <div key={bi} className="kdm-bucket">
              <span className="kdm-bkt">2<sup>{bi}</sup></span>
              {peers.map((p) => <span key={p} className="kdm-peer">{p}</span>)}
            </div>
          ))}
        </div>
      </div>

      <p className="kdm-foot">
        Why XOR is the inspired choice: it's a real metric (symmetric, and it satisfies the triangle inequality),
        but unlike ring distance it's <strong>unidirectional and prefix-structured</strong>, which buys two things
        at once. First, routing is deterministic — from any node, exactly one bucket brings you strictly closer,
        so lookups can't loop and converge in a logarithmic number of hops. Second, the metric is
        <strong> symmetric</strong>, so when node A talks to node B, B learns about A at the same distance and can
        add it to a bucket "for free" — every message passively improves routing tables, and a node
        automatically knows more peers in its own neighborhood (where precision matters) than far away. Keeping
        <strong> k</strong> peers per bucket (typically 20) rather than one gives fault tolerance — you evict the
        least-recently-seen only when a bucket overflows and the old contact is actually dead, which resists both
        churn and a class of eclipse attacks. Storing a value replicates it to the k nodes closest to its key;
        lookups terminate at those same nodes. This is the machinery under BitTorrent's trackerless torrents,
        IPFS content routing, and Ethereum's node discovery — a global directory with no center. Compared with
        <strong> Chord</strong>'s successor ring and finger table, Kademlia's XOR metric makes the routing table
        symmetric and the lookups parallelizable (α at a time), which is largely why it won in practice.
        (Maymounkov &amp; Mazières, 2002.)
      </p>
    </div>
  );
}
