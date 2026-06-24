// Read-repair & anti-entropy, made visible. Click a key to make replica B diverge from A, then watch
// the Merkle-tree comparison drill down ONLY through the subtrees whose hashes differ — skipping
// whole matching branches — to pinpoint the divergent keys in O(log n). A read-repair panel shows the
// synchronous version. All logic from antientropy.ts (tested: O(log n) diff, quorum reconciliation).
import { useMemo, useState } from 'react';
import { buildMerkle, leafHashes, merkleDiff, quorumRead, type MerkleNode, type Replica } from './antientropy';

const N = 8;

function collectDiffers(a: MerkleNode, b: MerkleNode, set: Set<string>) {
  if (a.hash === b.hash) return;
  set.add(`${a.lo}-${a.hi}`);
  if (a.left && b.left) { collectDiffers(a.left, b.left, set); collectDiffers(a.right!, b.right!, set); }
}

export function AeSection() {
  const [bad, setBad] = useState<Set<number>>(new Set([5]));
  const toggle = (i: number) => setBad((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });

  const valsA = Array.from({ length: N }, (_, i) => `k${i}=v${i}`);
  const valsB = Array.from({ length: N }, (_, i) => `k${i}=v${i}${bad.has(i) ? '*' : ''}`);
  const treeA = useMemo(() => buildMerkle(leafHashes(valsA)), []);
  const treeB = useMemo(() => buildMerkle(leafHashes(valsB)), [bad]);
  const diff = useMemo(() => merkleDiff(treeA, treeB), [treeA, treeB]);
  const differ = useMemo(() => { const s = new Set<string>(); collectDiffers(treeA, treeB, s); return s; }, [treeA, treeB]);

  // tree levels: level d has 2^d nodes, each covering N/2^d leaves
  const levels = [0, 1, 2, 3].map((d) => Array.from({ length: 2 ** d }, (_, i) => {
    const w = N / 2 ** d; const lo = i * w; return { lo, hi: lo + w - 1, key: `${lo}-${lo + w - 1}` };
  }));

  // read-repair demo on one key
  const reps: Replica[] = [{ id: 'A', value: 'v(old)', version: 4 }, { id: 'B', value: 'v(new)', version: 6 }, { id: 'C', value: 'v(old)', version: 4 }];
  const rr = quorumRead(reps, 3);

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Read-repair &amp; anti-entropy — healing replicas without a leader</h2></div>
        <p className="jsec-sub">
          In a leaderless (Dynamo-style) store, replicas drift apart when a write misses some nodes. Two mechanisms reconcile them:
          <strong> read-repair</strong> fixes divergence it stumbles on during a quorum read, and <strong>anti-entropy</strong> proactively
          compares <strong>Merkle trees</strong> of the whole keyspace — equal roots mean “identical” in one comparison, and only differing
          branches are explored, so finding what diverged costs O(log n), not a full scan.
        </p>

        <h3 className="ae-h3">Anti-entropy — click a key to make replica B diverge</h3>
        <div className="ae-keys">
          {valsB.map((_, i) => (
            <button key={i} className={`ae-key ${bad.has(i) ? 'bad' : ''}`} onClick={() => toggle(i)}>k{i}{bad.has(i) ? ' ✗' : ''}</button>
          ))}
        </div>

        <div className="ae-tree">
          {levels.map((row, d) => (
            <div key={d} className="ae-level">
              {row.map((n) => (
                <div key={n.key} className={`ae-node ${differ.has(n.key) ? 'diff' : 'same'} ${d === 3 ? 'leaf' : ''}`}>
                  {d === 3 ? `k${n.lo}` : d === 0 ? 'root' : ''}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="ae-diffsummary">
          {diff.differingLeaves.length === 0
            ? <span className="ae-insync">✓ roots match — replicas in sync, <b>1</b> comparison</span>
            : <span>divergent keys: <b>{diff.differingLeaves.map((i) => 'k' + i).join(', ')}</b> · found in <b>{diff.comparisons}</b> node comparisons (a full scan would touch all {N}) — red = hashes differ, grey subtrees were skipped wholesale.</span>}
        </div>

        <h3 className="ae-h3">Read-repair — reconcile on the read path</h3>
        <div className="ae-rr">
          <div className="ae-reps">
            {reps.map((r) => (
              <div key={r.id} className={`ae-rep ${rr.stale.includes(r.id) ? 'stale' : 'fresh'}`}>
                <b>{r.id}</b> {r.value} <span>v{r.version}</span>{rr.stale.includes(r.id) && <em>→ repaired</em>}
              </div>
            ))}
          </div>
          <p className="ae-rrnote">A 3-replica quorum read finds B at v{rr.winningVersion} and A,C at v4. The coordinator returns <b>{rr.winner}</b> to the client and writes it back to the stale replicas — divergence healed in passing, no background job needed.</p>
        </div>

        <p className="ae-foot">
          The two are complements: read-repair is cheap but only mends keys someone reads, so cold data can stay divergent forever — that’s why
          anti-entropy sweeps the whole keyspace in the background. Merkle trees make that sweep affordable: replicas exchange a handful of hashes
          instead of shipping every key, and bandwidth scales with the <em>amount of difference</em>, not the dataset size. Cassandra’s repair,
          Riak’s active anti-entropy, and DynamoDB all use exactly this; the same tree powers Git’s object comparison and blockchain light clients.
        </p>
      </section>
    </div>
  );
}
