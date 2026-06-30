// Hash flooding, made visible. Send a flood of attacker-chosen keys and watch the buckets: with a
// predictable hash they ALL stack into one bucket — a single O(n) chain, O(n²) total work, a pinned CPU —
// while a seeded (SipHash-style) hash scatters the very same keys evenly. Drag the key count to feel the
// quadratic blow-up, and flip the hash to watch the attack collapse. Real model from hashflood.ts.
import { useMemo, useState } from 'react';
import { weakHash, seededHash, attackKeys, insertCost } from './hashflood';

const BUCKETS = 16;
const SEED = 0x9e3779b9;

export function HashFloodSection() {
  const [n, setN] = useState(48);
  const [seeded, setSeeded] = useState(false);

  const hash = seeded ? (k: number, b: number) => seededHash(k, b, SEED) : weakHash;
  const cost = useMemo(() => insertCost(attackKeys(n, BUCKETS), BUCKETS, hash), [n, seeded]);
  const maxSize = Math.max(...cost.sizes, 1);
  const worst = (n * (n - 1)) / 2; // all-collide reference

  return (
    <div className="hfl">
      <p className="hfl-intro">
        A hash table is fast because keys spread across buckets — ~1 item each, O(1) lookups. But if the hash
        is <strong>predictable</strong>, an attacker computes thousands of distinct keys that all hash to the
        <strong> same bucket</strong>. Now every insert walks one giant chain — <strong>O(n²)</strong> total —
        and one request pins a core. This was the 2011 <strong>hashDoS</strong> that hit PHP, Python, Ruby,
        Java, .NET, and Node at once.
      </p>

      <div className="hfl-controls">
        <label>attacker keys <input type="range" min={4} max={96} value={n} onChange={(e) => setN(+e.target.value)} /><b>{n}</b></label>
        <div className="hfl-hash">
          <button type="button" className={!seeded ? 'on bad' : ''} onClick={() => setSeeded(false)}>predictable hash</button>
          <button type="button" className={seeded ? 'on ok' : ''} onClick={() => setSeeded(true)}>seeded (SipHash)</button>
        </div>
      </div>

      <div className="hfl-buckets">
        {cost.sizes.map((sz, i) => (
          <div key={i} className="hfl-col">
            <div className="hfl-stack">
              <div className={`hfl-fill ${seeded ? 'ok' : sz > 3 ? 'bad' : 'mid'}`} style={{ height: `${(sz / maxSize) * 100}%` }} />
            </div>
            <span className="hfl-bidx">{i}</span>
            {sz > 0 && <span className="hfl-bn">{sz}</span>}
          </div>
        ))}
      </div>

      <div className="hfl-tally">
        <div className={`hfl-stat ${seeded ? 'ok' : 'bad'}`}><span>biggest bucket</span><b>{cost.maxBucket}</b></div>
        <div className={`hfl-stat ${seeded ? 'ok' : 'bad'}`}><span>comparisons</span><b>{cost.comparisons.toLocaleString()}</b></div>
        <div className="hfl-stat"><span>{seeded ? 'vs flooded' : 'growth'}</span><b>{seeded ? `${Math.round(worst / Math.max(1, cost.comparisons))}× less` : 'O(n²)'}</b></div>
      </div>

      <div className={`hfl-verdict ${seeded ? 'ok' : 'bad'}`}>
        {seeded
          ? `✓ the seed scatters the attacker's keys evenly — the same flood is now ~O(n). The attacker can't predict the buckets without the per-process secret.`
          : `✗ all ${n} keys collide in one bucket → ${cost.comparisons.toLocaleString()} comparisons to insert them. Double the keys → 4× the work. A few MB of keys can hang the server.`}
      </div>

      <p className="hfl-foot">
        The fix isn't a "better" deterministic hash — any fixed hash can be reverse-engineered offline. It's a
        <strong> keyed</strong> hash with a per-process random seed: <strong>SipHash</strong>, designed exactly
        for short-input hash-table use, so the attacker can't know which bucket a key hits. Languages adopted it
        wholesale after 2011 (Python's <code>PYTHONHASHSEED</code>, Rust's <code>RandomState</code>,
        Ruby/Perl/Node). Related algorithmic-complexity attacks hit anything with a bad worst case fed
        untrusted input: <strong>ReDoS</strong> (catastrophic regex backtracking), quadratic JSON/XML parsers,
        and sort functions vulnerable to a killer adversary sequence — the defense pattern is the same:
        randomize, bound the work, or use a structure with no exploitable worst case. (Crosby–Wallach 2003;
        SipHash, Aumasson–Bernstein 2012.)
      </p>
    </div>
  );
}
