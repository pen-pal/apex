// Operational Transformation, made visible. Two people edit the same short document at the same time — Alice
// (site 0) and Bob (site 1) each act on the original text. Watch each site apply its own edit, then RECEIVE the
// other's edit and transform it before applying. Both sites converge to the same final document. Toggle to the
// "naive" mode (apply the raw remote edit with no transform) and watch them diverge — the bug OT fixes. Real
// model from optransform.ts.
import { useState } from 'react';
import { apply, transform, type Op } from './optransform';

const BASE = 'ABCDE';
const opStr = (o: Op) => o.type === 'ins' ? `insert '${o.ch}' @${o.pos}` : o.type === 'del' ? `delete @${o.pos}` : 'no-op';

function OpEditor({ label, op, set, color }: { label: string; op: Extract<Op, { type: 'ins' | 'del' }>; set: (o: Extract<Op, { type: 'ins' | 'del' }>) => void; color: string }) {
  return (
    <div className={`opx-editor ${color}`}>
      <span className="opx-who">{label}</span>
      <select value={op.type} onChange={(e) => set({ ...op, type: e.target.value as 'ins' | 'del' } as any)}>
        <option value="ins">insert</option><option value="del">delete</option>
      </select>
      {op.type === 'ins' && <input className="opx-ch" maxLength={1} value={op.ch} onChange={(e) => set({ ...op, ch: e.target.value || 'X' })} />}
      <label className="opx-pos">@<input type="number" min={0} max={BASE.length} value={op.pos} onChange={(e) => set({ ...op, pos: Math.max(0, Math.min(BASE.length, +e.target.value)) })} /></label>
    </div>
  );
}

function Lane({ site, base, own, remote }: { site: string; base: string; own: Op; remote: Op }) {
  const local = apply(base, own);
  const rt = transform(remote, own);
  const final = apply(local, rt);
  return (
    <div className="opx-lane">
      <div className="opx-lh">{site}</div>
      <div className="opx-steps">
        <div className="opx-step"><span>apply own</span><code>{opStr(own)}</code><b className="opx-doc">{local}</b></div>
        <div className="opx-step"><span>transform remote →</span><code>{opStr(rt)}</code></div>
        <div className="opx-step"><span>apply it</span><b className="opx-doc final">{final}</b></div>
      </div>
    </div>
  );
}

export function OpTransformSection() {
  const [a, setA] = useState<Extract<Op, { type: 'ins' | 'del' }>>({ type: 'ins', pos: 2, ch: 'X', site: 0 });
  const [b, setB] = useState<Extract<Op, { type: 'ins' | 'del' }>>({ type: 'del', pos: 0, site: 1 });

  const finalA = apply(apply(BASE, a), transform(b, a));
  const finalB = apply(apply(BASE, b), transform(a, b));
  const converged = finalA === finalB;

  const naiveA = apply(apply(BASE, a), b);
  const naiveB = apply(apply(BASE, b), a);
  const naiveConverged = naiveA === naiveB;

  return (
    <div className="opx">
      <p className="opx-intro">
        Alice and Bob edit the same document <code>{BASE}</code> at the same time, each against this original. To
        stay consistent, when a site receives the other's edit it must <strong>transform</strong> it against its
        own edit first — adjusting indices so the operation still means the right thing. Set the two concurrent
        edits:
      </p>

      <div className="opx-editors">
        <OpEditor label="Alice (site 0)" op={a} set={setA} color="a" />
        <OpEditor label="Bob (site 1)" op={b} set={setB} color="b" />
      </div>

      <div className="opx-lanes">
        <Lane site="Alice's replica (saw her edit first)" base={BASE} own={a} remote={b} />
        <Lane site="Bob's replica (saw his edit first)" base={BASE} own={b} remote={a} />
      </div>

      <div className={`opx-verdict ${converged ? 'ok' : 'bad'}`}>
        {converged
          ? `✓ CONVERGED — both replicas reach "${finalA}" regardless of the order edits arrived. That's the TP1 property OT guarantees.`
          : `✗ diverged: "${finalA}" vs "${finalB}"`}
      </div>

      <div className={`opx-naive ${naiveConverged ? 'ok' : 'bad'}`}>
        <span className="opx-nlabel">without OT (apply the raw remote edit):</span>
        {naiveConverged
          ? <span>happens to agree here ("{naiveA}") — but it won't in general</span>
          : <span className="opx-ndiv">Alice gets "<b>{naiveA}</b>", Bob gets "<b>{naiveB}</b>" — <b>diverged</b>. This is the bug OT exists to fix.</span>}
      </div>

      <p className="opx-foot">
        The whole game is making <code>transform(a, b)</code> and <code>transform(b, a)</code> agree so the two
        arrival orders land on the same document — the <strong>TP1</strong> convergence property. The fiddly bits
        are the ties: two inserts at the same position need a deterministic order (here, lower <em>site id</em>
        wins), and two deletes of the same character must collapse to one (the second becomes a no-op). Real
        systems layer more on top: a central server that <em>sequences</em> operations (Google's Jupiter model,
        Google Docs) so each client only transforms against a known history, plus version vectors to know which
        ops are concurrent. OT is famously hard to get right for rich documents (styling, objects) — which is why
        many newer collaborative apps use <strong>CRDTs</strong> instead, trading OT's compact operations for
        data structures that merge commutatively without a server. Same goal, different math. (Ellis &amp; Gibbs
        1989; Nichols et al., "Jupiter," 1995.)
      </p>
    </div>
  );
}
