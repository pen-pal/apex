// MinHash, made visible. Two short documents are broken into 3-character shingles (sets); each set gets a
// k-slot MinHash signature. The estimated Jaccard similarity is simply the FRACTION of signature slots that
// match — matching slots light up green below. Drag k and watch the estimate converge on the true similarity.
// Real model from minhash.ts.
import { useMemo, useState } from 'react';
import { makeHashes, signature, estimateJaccard, trueJaccard } from './minhash';

const shingle = (s: string): string[] => { const w: string[] = []; const t = s.toLowerCase(); for (let i = 0; i <= t.length - 3; i++) w.push(t.slice(i, i + 3)); return w; };
const SHOW = 48; // signature slots to draw

export function MinHashSection() {
  const [docA, setDocA] = useState('the quick brown fox jumps over the lazy dog');
  const [docB, setDocB] = useState('the quick brown cat jumps over the lazy dog');
  const [k, setK] = useState(64);

  const { A, B, sigA, sigB, est, tru } = useMemo(() => {
    const A = shingle(docA), B = shingle(docB);
    const hashes = makeHashes(k, 20240701);
    const sigA = signature(A, hashes), sigB = signature(B, hashes);
    return { A, B, sigA, sigB, est: estimateJaccard(sigA, sigB), tru: trueJaccard(A, B) };
  }, [docA, docB, k]);

  const matches = sigA.filter((v, i) => v === sigB[i]).length;

  return (
    <div className="mnh">
      <p className="mnh-intro">
        How similar are two documents? Break each into a <strong>set</strong> of shingles (here, overlapping
        3-character grams), then compare fixed-size <strong>MinHash signatures</strong> instead of the sets. Each
        signature slot is the minimum of one hash over the set; two slots match with probability exactly equal to
        the sets' <strong>Jaccard similarity</strong>, so the fraction of matching slots estimates it. Edit the
        docs:
      </p>

      <div className="mnh-docs">
        <label className="mnh-doc">document A<textarea value={docA} onChange={(e) => setDocA(e.target.value)} rows={2} /><i>{A.length} shingles</i></label>
        <label className="mnh-doc">document B<textarea value={docB} onChange={(e) => setDocB(e.target.value)} rows={2} /><i>{B.length} shingles</i></label>
      </div>

      <label className="mnh-kslider">signature size k = <b>{k}</b> hash functions<input type="range" min={4} max={256} step={4} value={k} onChange={(e) => setK(+e.target.value)} /></label>

      <div className="mnh-sigs">
        <div className="mnh-siglabel">signatures <i>(first {Math.min(SHOW, k)} of {k} slots · matching = green)</i></div>
        <div className="mnh-sigrow">
          {sigA.slice(0, SHOW).map((v, i) => <span key={i} className={`mnh-slot ${v === sigB[i] ? 'match' : ''}`} title={`h${i}: A=${v} B=${sigB[i]}`} />)}
        </div>
        <div className="mnh-sigrow">
          {sigB.slice(0, SHOW).map((v, i) => <span key={i} className={`mnh-slot ${v === sigA[i] ? 'match' : ''}`} />)}
        </div>
      </div>

      <div className="mnh-result">
        <div className="mnh-big">
          <div className="mnh-metric"><span>estimated Jaccard</span><b className="mnh-est">{(est * 100).toFixed(1)}%</b><i>{matches} / {k} slots match</i></div>
          <div className="mnh-metric"><span>true Jaccard</span><b className="mnh-tru">{(tru * 100).toFixed(1)}%</b><i>exact |A∩B|/|A∪B|</i></div>
          <div className="mnh-metric"><span>error</span><b className={Math.abs(est - tru) < 0.05 ? 'ok' : ''}>{(Math.abs(est - tru) * 100).toFixed(1)} pts</b><i>≈ 1/√k = {(1 / Math.sqrt(k) * 100).toFixed(1)}%</i></div>
        </div>
      </div>

      <p className="mnh-foot">
        The single non-obvious fact doing all the work: for a random hash (a random permutation of the universe),
        <strong> P[min-hash(A) = min-hash(B)] = J(A, B)</strong>, because the overall minimum is uniformly likely
        to be any element of A∪B and matches only when it falls in A∩B. So each slot is a coin-flip that comes up
        “equal” with probability J, and averaging k of them is an unbiased estimator with standard error ~1/√k —
        quadrupling k halves the error. Two more pieces make it a system. <strong>Shingling</strong> turns
        ordered text into a set while keeping local word order (character or word k-grams), so “A B C” and
        “C B A” aren’t called identical. And <strong>LSH banding</strong> solves the real problem — you don’t want
        to compare every pair of a billion signatures: split each signature into b bands of r rows, hash each
        band, and only pairs that collide in <em>some</em> band become candidates; tuning (b, r) sets an
        S-curve threshold so near-duplicates collide with high probability and dissimilar pairs almost never do.
        That’s how web-scale dedup, plagiarism detection, and recommendation candidate-generation run in near-
        linear time. A cousin, <strong>SimHash</strong>, estimates cosine/Hamming similarity instead and packs a
        document into a single 64-bit fingerprint (Google used it for crawl dedup). (Broder, 1997.)
      </p>
    </div>
  );
}
