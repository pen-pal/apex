// Chain replication, made visible. Step a write down the chain and watch the new value flow head→tail; it's
// only committed (and only visible to a tail read) once it reaches the tail — so reads are always
// linearizable. Then click a node to fail it and see the chain reconfigure: head's successor becomes head,
// tail's predecessor becomes tail, a middle node is just linked around. Real model from chainrep.ts.
import { useMemo, useState } from 'react';
import { propagate, isCommitted, read, reconfigure } from './chainrep';

const INIT = ['A', 'B', 'C', 'D'];

export function ChainRepSection() {
  const [chain, setChain] = useState(INIT);
  const [depth, setDepth] = useState(0);
  const [failed, setFailed] = useState<{ id: string; role: string; head: string; tail: string } | null>(null);

  const maxDepth = chain.length - 1;
  const d = Math.min(depth, maxDepth);
  const state = useMemo(() => propagate(chain, 'v1', 'v2', d), [chain, d]);
  const committed = isCommitted(chain, d);
  const tailValue = read(state);

  const failNode = (id: string) => {
    const r = reconfigure(chain, id);
    setFailed({ id, role: r.role, head: r.newHead, tail: r.newTail });
    setChain(r.newChain);
    setDepth(0);
  };
  const reset = () => { setChain(INIT); setDepth(0); setFailed(null); };

  return (
    <div className="chr">
      <p className="chr-intro">
        Keep N replicas strongly consistent without quorum math: line them up in a <strong>chain</strong>. A
        write enters the <strong>head</strong> and flows down; it's <strong>committed only at the tail</strong>,
        which acks the client. Every <strong>read is served by the tail</strong> — so it always sees the latest
        committed write. Linearizable reads, and reads never touch the head.
      </p>

      <div className="chr-write">
        <span className="chr-wlbl">write <code>v2</code> propagating:</span>
        <input type="range" min={0} max={maxDepth} value={d} onChange={(e) => setDepth(+e.target.value)} />
        <span className="chr-wstep">hop {d + 1} / {chain.length}</span>
        <span className={`chr-commit ${committed ? 'yes' : 'no'}`}>{committed ? '✓ committed (acked)' : 'in flight — not yet acked'}</span>
      </div>

      <div className="chr-chain">
        {state.map((node, i) => {
          const role = i === 0 ? 'head' : i === state.length - 1 ? 'tail' : 'middle';
          const fresh = node.value === 'v2';
          return (
            <div key={node.id} className="chr-link">
              <div className={`chr-node ${role} ${fresh ? 'fresh' : 'stale'}`} onClick={() => chain.length > 1 && failNode(node.id)} role="button" title="click to fail this node">
                <div className="chr-role">{role}</div>
                <div className="chr-id">{node.id}</div>
                <div className="chr-val">{node.value}</div>
              </div>
              {i < state.length - 1 && <div className="chr-arrow">→</div>}
            </div>
          );
        })}
        <div className="chr-readarrow"><span>read</span>↑</div>
      </div>

      <div className="chr-read">
        <div className={`chr-rbox ${committed ? 'new' : 'old'}`}>
          tail read returns <b>{tailValue}</b> {committed ? '(the new committed value)' : '(still the old committed value — the in-flight write is invisible until it reaches the tail)'}
        </div>
      </div>

      {failed && (
        <div className="chr-reconfig">
          ⚠ <b>{failed.id}</b> ({failed.role}) failed → chain reconfigured: head = <b>{failed.head}</b>, tail = <b>{failed.tail}</b>.
          {failed.role === 'head' && ' The old head\'s successor takes over as head.'}
          {failed.role === 'tail' && ' The old tail\'s predecessor becomes the new tail (it already had every committed write).'}
          {failed.role === 'middle' && ' The chain simply links around the gap.'}
          <button type="button" onClick={reset}>reset chain</button>
        </div>
      )}
      {!failed && <div className="chr-tip">tip: click any node to fail it and watch the chain reconfigure.</div>}

      <p className="chr-foot">
        Why a chain and not a quorum? Updates are ordered by one path (no conflicting concurrent writers to
        reconcile), the tail gives linearizable reads for free, and failover is a tiny relabeling handled by a
        separate <strong>configuration manager</strong> (often a Paxos/ZooKeeper-backed "master") that tells
        nodes their new neighbors. The cost: write latency is the full chain length (every hop in series), and
        a tail that's slow drags all reads. <strong>CRAQ</strong> (Chain Replication with Apportioned Queries)
        fixes the read bottleneck by letting <em>any</em> node serve a read — returning its value if clean, or
        asking the tail for the committed version if it has a dirty (in-flight) one — so reads scale across all
        replicas while staying linearizable. Used in object stores and metadata services. (van Renesse &amp;
        Schneider, OSDI 2004.)
      </p>
    </div>
  );
}
