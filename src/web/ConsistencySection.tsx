// Consistency models, made visible. A timeline of read/write operations on one shared
// register across two clients; pick a textbook scenario and the checker reports whether it
// is linearizable, only sequentially consistent, or neither — by actually searching for a
// valid total order. Real checker in consistency.ts (tested on the classic examples).
import { useMemo, useState } from 'react';
import { classify, type Op } from './consistency';

const op = (id: string, proc: number, kind: 'w' | 'r', val: number, start: number, end: number, po: number): Op =>
  ({ id, proc, kind, val, start, end, po });

const SCENARIOS: { name: string; blurb: string; ops: Op[] }[] = [
  {
    name: 'Read sees the latest write',
    blurb: 'C2 reads after C1’s write finished, and sees it.',
    ops: [op('w1', 0, 'w', 1, 0, 2, 0), op('r1', 1, 'r', 1, 3, 5, 0)],
  },
  {
    name: 'Stale read after a write',
    blurb: 'C2 reads 0 even though C1’s write of 1 already completed.',
    ops: [op('w1', 0, 'w', 1, 0, 2, 0), op('r0', 1, 'r', 0, 3, 5, 0)],
  },
  {
    name: 'A client reads its own stale value',
    blurb: 'C1 writes 1, then later reads 0 — violating its own program order.',
    ops: [op('w1', 0, 'w', 1, 0, 2, 0), op('r0', 0, 'r', 0, 3, 5, 1)],
  },
  {
    name: 'Concurrent writes',
    blurb: 'C1 and C2 write at the same time; a later read may see either.',
    ops: [op('w1', 0, 'w', 1, 0, 3, 0), op('w2', 1, 'w', 2, 1, 4, 0), op('r', 0, 'r', 1, 5, 7, 1)],
  },
];

const T = 8, PXW = 56; // time → x scale

export function ConsistencySection() {
  const [i, setI] = useState(1);
  const sc = SCENARIOS[i];
  const result = useMemo(() => classify(sc.ops), [sc]);
  const procs = [0, 1];

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Consistency models — which results are allowed?</h2></div>
        <p className="jsec-sub">
          When clients share one value, not every set of read results is legal. <strong>Linearizable</strong> means there’s a single
          order matching real time where reads see the latest write — the strongest, “as if one copy.” <strong>Sequential</strong>
          relaxes real time but keeps each client’s own order. The checker below <em>searches</em> for a valid order and tells you which
          holds. Pick a history:
        </p>

        <div className="cons-pick">
          {SCENARIOS.map((s, k) => <button key={k} className={i === k ? 'on' : ''} onClick={() => setI(k)}>{s.name}</button>)}
        </div>
        <p className="cons-blurb">{sc.blurb}</p>

        <div className="cons-timeline">
          {procs.map((p) => (
            <div key={p} className="cons-lane">
              <div className="cons-lane-label">C{p + 1}</div>
              <div className="cons-track" style={{ width: T * PXW }}>
                {sc.ops.filter((o) => o.proc === p).map((o) => (
                  <div key={o.id} className={`cons-op ${o.kind}`} style={{ left: o.start * PXW, width: (o.end - o.start) * PXW }}>
                    {o.kind === 'w' ? `W(${o.val})` : `R→${o.val}`}
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="cons-axis" style={{ width: T * PXW }}>
            {Array.from({ length: T }, (_, t) => <span key={t} style={{ left: t * PXW }}>{t}</span>)}
          </div>
        </div>

        <div className="cons-results">
          <div className={`cons-badge ${result.linearizable ? 'yes' : 'no'}`}>{result.linearizable ? '✓' : '✗'} Linearizable</div>
          <div className={`cons-badge ${result.sequential ? 'yes' : 'no'}`}>{result.sequential ? '✓' : '✗'} Sequentially consistent</div>
        </div>
        <div className={`cons-verdict ${result.linearizable ? 'ok' : result.sequential ? 'warn' : 'bad'}`}>
          <strong>{result.label}.</strong>{' '}
          {result.linearizable
            ? 'A real-time-respecting total order explains every read.'
            : result.sequential
              ? 'No real-time order works, but one respecting each client’s program order does — the read is stale relative to wall-clock but internally consistent.'
              : 'No valid order exists at all — even a single client sees a value older than its own write.'}
        </div>

        <p className="cons-foot">
          The hierarchy is strict: linearizable ⊂ sequential ⊂ causal ⊂ eventual. Stronger models are easier to reason about but cost
          coordination and latency (and CAP says you can’t keep linearizability during a partition). Causal consistency keeps only
          cause-and-effect order (great for collaborative apps); eventual consistency just promises replicas converge if writes stop —
          which is what Dynamo-style stores (see the quorum and CRDT sections) trade for availability.
        </p>
      </section>
    </div>
  );
}
