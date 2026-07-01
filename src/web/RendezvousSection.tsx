// Rendezvous hashing, made visible. For one key, see the weight hash(key, node) computed against every node —
// the highest wins and owns the key. Watch the distribution stay even across all nodes, and, when you add or
// remove a node, watch how FEW keys move: removing a node only re-homes the keys it owned; adding one only
// pulls keys that now score highest on it. Real model from rendezvous.ts.
import { useMemo, useState } from 'react';
import { weight, ranking, assign, distribution, moved } from './rendezvous';

const SAMPLE = Array.from({ length: 2400 }, (_, i) => 'key-' + i);
const COLORS = ['212 60% 52%', '150 50% 45%', '28 75% 52%', '280 45% 58%', '340 60% 55%', '190 60% 45%', '50 80% 50%', '0 0% 55%'];

export function RendezvousSection() {
  const [nodes, setNodes] = useState<string[]>(['cache-0', 'cache-1', 'cache-2', 'cache-3']);
  const [key, setKey] = useState('user:42');
  const [change, setChange] = useState<{ text: string; moved: number; pct: number } | null>(null);
  const [next, setNext] = useState(4);

  const owner = assign(key, nodes);
  const rank = useMemo(() => ranking(key, nodes), [key, nodes]);
  const dist = useMemo(() => distribution(SAMPLE, nodes), [nodes]);
  const maxDist = Math.max(1, ...Object.values(dist));
  const colorOf = (n: string) => COLORS[nodes.indexOf(n) % COLORS.length];

  const apply = (newNodes: string[], label: string) => {
    const mv = moved(SAMPLE, nodes, newNodes).length;
    setChange({ text: label, moved: mv, pct: (mv / SAMPLE.length) * 100 });
    setNodes(newNodes);
  };
  const addNode = () => { apply([...nodes, 'cache-' + next], `added cache-${next}`); setNext((n) => n + 1); };
  const removeNode = (n: string) => { if (nodes.length > 2) apply(nodes.filter((x) => x !== n), `removed ${n}`); };

  return (
    <div className="rzv">
      <p className="rzv-intro">
        To place a key, rendezvous hashing scores it against <em>every</em> node with <code>hash(key, node)</code>
        and picks the <strong>highest</strong> — no ring, no virtual nodes. The mixing makes scores random per
        pair, so keys spread evenly; and because each key independently ranks the nodes, a membership change only
        disturbs the keys whose winner changed. Try a key:
      </p>

      <div className="rzv-keyrow">
        <label className="rzv-keyf">key<input value={key} onChange={(e) => setKey(e.target.value)} spellCheck={false} /></label>
        <div className="rzv-owner">owner → <b style={{ color: `hsl(${colorOf(owner)})` }}>{owner}</b></div>
      </div>

      <div className="rzv-weights">
        {rank.map((n, i) => {
          const w = weight(key, n) / 0xffffffff;
          return (
            <div key={n} className={`rzv-wrow ${i === 0 ? 'win' : ''}`}>
              <span className="rzv-wname">{i === 0 ? '👑 ' : `#${i + 1} `}{n}</span>
              <div className="rzv-wtrack"><div className="rzv-wfill" style={{ width: `${w * 100}%`, background: `hsl(${colorOf(n)})` }} /></div>
              <span className="rzv-wval">{w.toFixed(3)}</span>
            </div>
          );
        })}
      </div>
      <p className="rzv-hint">That full ranking is a ready-made <strong>preference list</strong> — replicate to the top-K for free (here #1 owns it, #2–#3 are the natural replica/fallback nodes).</p>

      <div className="rzv-nodes">
        <span className="rzv-nodes-label">cluster ({nodes.length} nodes):</span>
        {nodes.map((n) => (
          <span key={n} className="rzv-chip" style={{ borderColor: `hsl(${colorOf(n)} / .5)` }}>
            {n}{nodes.length > 2 && <button type="button" onClick={() => removeNode(n)} title="remove">×</button>}
          </span>
        ))}
        <button type="button" className="rzv-add" onClick={addNode}>+ add node</button>
      </div>

      {change && (
        <div className="rzv-disruption">
          <b>{change.text}</b> → <b className="rzv-moved">{change.moved.toLocaleString()}</b> of {SAMPLE.length.toLocaleString()} keys moved
          (<b>{change.pct.toFixed(1)}%</b>) — near the theoretical minimum of 1/N. Everything else stayed put.
        </div>
      )}

      <div className="rzv-dist">
        <span className="rzv-nodes-label">key distribution ({SAMPLE.length.toLocaleString()} keys):</span>
        <div className="rzv-distbars">
          {nodes.map((n) => (
            <div key={n} className="rzv-distcol">
              <div className="rzv-distbarwrap"><div className="rzv-distbar" style={{ height: `${(dist[n] / maxDist) * 100}%`, background: `hsl(${colorOf(n)})` }} /></div>
              <span className="rzv-distn">{n.replace('cache-', 'c')}</span>
              <span className="rzv-distc">{dist[n]}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="rzv-foot">
        The contrast with plain <em>hash(key) mod N</em> is stark: change N there and almost every key remaps
        (a cache stampede). Rendezvous and consistent hashing both fix that, and both move only ≈1/N of keys on
        a change — but rendezvous needs no ring and no virtual-node tuning: it gets even load automatically
        because the hash itself is the randomizer, and weighting a beefier node is a one-line score multiplier.
        Its natural output is a <strong>ranked list</strong>, which is why Dynamo-style systems and CDNs reach
        for it to pick a key's N replicas (or a client's ordered fallback caches). The price is O(N) hashes per
        lookup, so it fits tens-to-hundreds of nodes; past that, consistent hashing's O(log N) ring or a scheme
        like <strong>Maglev</strong> (a fixed lookup table that keeps both even load and minimal disruption at
        O(1) lookup) takes over. All three answer the same question — "map keys to a changing set of servers with
        minimal churn" — with different time/space trade-offs. (Thaler &amp; Ravishankar, 1998.)
      </p>
    </div>
  );
}
