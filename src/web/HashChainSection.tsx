// Hash chain, made visible. A column of blocks each showing its data, the previous block's
// hash, and its own hash. Edit any block's data and watch its hash change and every block
// below turn red — the cascade that makes the chain tamper-evident. Real SHA-256 in
// hashchain.ts (tested).
import { useMemo, useState } from 'react';
import { buildChain, verify, GENESIS_PREV } from './hashchain';

const INITIAL = ['Alice pays Bob 5', 'Bob pays Carol 2', 'Carol pays Dave 1', 'Dave pays Alice 3'];

export function HashChainSection() {
  const [data, setData] = useState<string[]>(INITIAL);
  // committed chain built once from the initial data; we re-derive live hashes as data edits
  const committed = useMemo(() => buildChain(INITIAL), []);
  // live view: blocks carry the CURRENT data but the committed hashes; verify recomputes live
  const liveBlocks = useMemo(() => committed.map((b, i) => ({ ...b, data: data[i] })), [committed, data]);
  const v = useMemo(() => verify(liveBlocks), [liveBlocks]);

  // the hash each block would have given current data (what an honest re-mine would store)
  const liveHashes = v.checks.map((c) => c.recomputed);

  const edit = (i: number, val: string) => setData((d) => d.map((x, k) => (k === i ? val : x)));
  const reset = () => setData(INITIAL);

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Hash chain — why you can’t rewrite history</h2></div>
        <p className="jsec-sub">
          Each block stores the <strong>hash of the previous block</strong> next to its own data, and its hash is computed over both. That
          single link is what makes a blockchain (or Git, or a transparency log) tamper-evident: change any past block and its hash changes,
          which breaks the link stored in the next block, whose hash changes too — the damage <strong>cascades all the way to the tip</strong>.
          So one trusted “tip” hash certifies the entire history. Edit a block below and watch it ripple.
        </p>

        <div className="hch-reset"><button onClick={reset} disabled={data.every((d, i) => d === INITIAL[i])}>↺ restore original</button>
          <span className={`hch-status ${v.valid ? 'ok' : 'bad'}`}>{v.valid ? '✓ chain intact' : `✗ broken from block ${v.firstBroken}`}</span></div>

        <div className="hch-chain">
          {liveBlocks.map((_b, i) => {
            const broken = !v.checks[i].valid;
            const committedHash = committed[i].hash;
            return (
              <div key={i} className={`hch-block ${broken ? 'broken' : 'good'}`}>
                <div className="hch-head"><span className="hch-idx">block {i}</span>{broken && <span className="hch-flag">⚠ hash mismatch</span>}</div>
                <label className="hch-field">data
                  <input value={data[i]} onChange={(e) => edit(i, e.target.value)} spellCheck={false} />
                </label>
                <div className="hch-field"><span>prev</span><code className="hch-hash">{(i === 0 ? GENESIS_PREV : liveHashes[i - 1]).slice(0, 20)}…</code></div>
                <div className="hch-field"><span>hash</span><code className={`hch-hash ${broken ? 'changed' : ''}`}>{liveHashes[i].slice(0, 20)}…</code></div>
                {broken && <div className="hch-was">committed: <code>{committedHash.slice(0, 20)}…</code> — no longer matches</div>}
              </div>
            );
          })}
        </div>

        <p className="hch-foot">
          Notice you can’t fix a tampered chain by re-hashing just the one block — every block after it would still need re-hashing, all the
          way to the tip, and anyone holding the original tip hash sees the mismatch instantly. A <strong>blockchain</strong> raises the
          stakes further: each block’s hash must also satisfy a proof-of-work target (see that section), so rewriting history means redoing
          all that computation faster than the honest network extends the chain. The same chaining secures Git commits (each points to its
          parent’s hash), certificate-transparency logs, and append-only audit trails.
        </p>
      </section>
    </div>
  );
}
