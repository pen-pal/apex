// Merkle tree, made visible. Each leaf is the SHA-256 of a data block; parents hash
// their two children; the single root commits to the whole set. Click a leaf to see
// its inclusion proof — the sibling hashes (orange) that, folded with the leaf, must
// reproduce the root. Edit a leaf and watch ONLY its path to the root recompute,
// everything else untouched. Real SHA-256 (see merkle.ts).
import { useMemo, useState } from 'react';
import { buildTree, inclusionProof, verifyProof, pathIndices, hashHex } from './merkle';

const DEFAULTS = ['alice→bob: 5', 'bob→carol: 3', 'carol→dave: 8', 'dave→eve: 1'];
const short = (h: Uint8Array) => hashHex(h).slice(0, 10);

export function MerkleSection() {
  const [blocks, setBlocks] = useState<string[]>([...DEFAULTS]);
  const [sel, setSel] = useState<number | null>(0);

  const tree = useMemo(() => buildTree(blocks), [blocks]);
  const top = tree.levels.length - 1;
  const pathIdx = sel !== null ? pathIndices(tree, sel) : [];
  const proof = sel !== null ? inclusionProof(tree, sel) : [];
  const verified = sel !== null ? verifyProof(tree.leaves[sel], proof, tree.root) : false;

  const siblingAt = (level: number) => {
    if (sel === null || level >= top) return -1;
    const p = pathIdx[level];
    const s = p % 2 === 1 ? p - 1 : p + 1;
    return s < tree.levels[level].length ? s : p; // duplicated last node
  };
  const editLeaf = (i: number, v: string) => setBlocks((b) => b.map((x, j) => (j === i ? v : x)));

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Merkle tree — one hash that commits to everything</h2></div>
        <p className="jsec-sub">
          Hash each data block into a leaf, then hash pairs upward until a single <strong>root</strong> remains. That root
          fingerprints the whole set. To prove one block belongs you only need the <strong>sibling hashes</strong> along its
          path (an inclusion proof) — log(n) hashes, not the whole dataset. Click a leaf for its proof; edit one and watch
          only its path change.
        </p>

        <div className="mk-tree">
          {[...tree.levels].reverse().map((level, ri) => {
            const l = top - ri;
            const isLeafLevel = l === 0;
            return (
              <div className="mk-level" key={l}>
                {level.map((h, j) => {
                  const onPath = pathIdx[l] === j;
                  const isProof = siblingAt(l) === j && sel !== null;
                  const cls = `mk-node ${l === top ? 'root' : ''} ${onPath ? 'path' : ''} ${isProof ? 'proof' : ''} ${isLeafLevel ? 'leaf' : ''}`;
                  return (
                    <div key={j} className={cls} onClick={() => isLeafLevel && setSel(j)}>
                      <div className="mk-tag">{l === top ? 'ROOT' : isLeafLevel ? `leaf ${j}` : `h`}</div>
                      <code className="mk-hash">{short(h)}…</code>
                      {isLeafLevel && (
                        <input className="mk-input" value={blocks[j]} onClick={(e) => e.stopPropagation()} onChange={(e) => editLeaf(j, e.target.value)} spellCheck={false} />
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {sel !== null && (
          <div className="mk-proof">
            <div className="mk-proof-h">Inclusion proof for <strong>leaf {sel}</strong> — fold the leaf with each sibling:</div>
            <div className="mk-proof-steps">
              <code className="mk-step leaf">leaf {short(tree.leaves[sel])}…</code>
              {proof.map((s, i) => (
                <span key={i} className="mk-step-wrap">
                  <span className="mk-op">→ hash({s.position === 'left' ? 'sibling, acc' : 'acc, sibling'})</span>
                  <code className="mk-step proof">{s.position} {short(s.hash)}…</code>
                </span>
              ))}
              <span className="mk-op">→</span>
              <code className={`mk-step ${verified ? 'ok' : 'bad'}`}>{verified ? '✓ root' : '✗ mismatch'} {short(tree.root)}…</code>
            </div>
            <div className="mk-proof-note">{proof.length} sibling hashes prove leaf {sel} is in a set committed by the root — without revealing the other blocks.</div>
          </div>
        )}
        <p className="enc-note">This is how git names a commit (a tree of file hashes), how a blockchain block commits to its transactions, how
          Cassandra/Dynamo find which rows differ between replicas (anti-entropy) without shipping everything, and how Certificate Transparency proves a
          certificate was logged. Change one bit anywhere and the root changes — tamper-evidence for free.</p>
      </section>
    </div>
  );
}
