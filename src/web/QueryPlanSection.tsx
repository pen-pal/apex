// Cost-based query planning, made visible. Three tables, one join graph — but six possible join orders,
// and their costs differ by ~100×. Drag the selectivity of the B–C predicate and watch the optimizer's
// ranking flip: when an edge is very selective, joining it first keeps every intermediate tiny. The
// ranked list is the optimizer's search space; click any plan to see its left-deep tree and the
// intermediate-result sizes it would materialize. Real System-R cost model from queryplan.ts.
import { useMemo, useState } from 'react';
import { optimize, planCost } from './queryplan';

const CARD: Record<string, number> = { A: 10000, B: 10000, C: 10 };
const TABLES = ['A', 'B', 'C'];
const fmt = (n: number) => n.toLocaleString('en-US');

export function QueryPlanSection() {
  const [selBC, setSelBC] = useState(0.001);
  const [selAB] = useState(0.5);
  const [picked, setPicked] = useState<string | null>(null);

  const sel = useMemo(() => ({ 'A~B': selAB, 'B~C': selBC }), [selAB, selBC]);
  const plans = useMemo(() => optimize(TABLES, CARD, sel), [sel]);
  const best = plans[0], worst = plans[plans.length - 1];
  const current = picked ? planCost(picked.split(','), CARD, sel) : best;

  return (
    <div className="qp">
      <div className="qp-setup">
        <div className="qp-tables">
          <div className="qp-h">tables (cardinality)</div>
          {TABLES.map((t) => <span key={t} className="qp-table">{t}<i>{fmt(CARD[t])} rows</i></span>)}
        </div>
        <div className="qp-edges">
          <div className="qp-h">join predicates (selectivity)</div>
          <div className="qp-edge">A — B<b>{selAB}</b></div>
          <label className="qp-edge sl">B — C
            <input type="range" min={-3} max={0} step={0.25} value={Math.log10(selBC)} onChange={(e) => { setSelBC(+(10 ** +e.target.value).toPrecision(2)); setPicked(null); }} />
            <b>{selBC}</b>
          </label>
        </div>
      </div>

      <div className="qp-body">
        <div className="qp-ranked">
          <div className="qp-h">join orders, cheapest first ({plans.length})</div>
          {plans.map((p) => {
            const oid = p.order.join();
            const isBest = oid === best.order.join();
            const sel2 = oid === current.order.join();
            return (
              <button key={oid} type="button" className={`qp-plan ${isBest ? 'best' : ''} ${sel2 ? 'on' : ''}`} onClick={() => setPicked(oid)}>
                <span className="qp-order">{p.order.join(' ⋈ ')}</span>
                <span className="qp-cost">{fmt(p.cost)}</span>
                {isBest && <span className="qp-badge">optimizer pick</span>}
              </button>
            );
          })}
          <div className="qp-ratio">worst plan costs <b>{(worst.cost / best.cost).toFixed(0)}×</b> the best — same answer, same data, just a different order.</div>
        </div>

        <div className="qp-detail">
          <div className="qp-h">plan: {current.order.join(' ⋈ ')}</div>
          <div className="qp-tree">
            <div className="qp-leaf">{current.order[0]}<i>{fmt(CARD[current.order[0]])}</i></div>
            {current.order.slice(1).map((t, i) => (
              <div key={i} className="qp-join">
                <span className="qp-op">⋈ {t}</span>
                <span className="qp-mid">→ {fmt(current.intermediates[i])} rows</span>
              </div>
            ))}
          </div>
          <div className="qp-total">total cost (Σ intermediate rows): <b>{fmt(current.cost)}</b></div>
        </div>
      </div>

      <p className="qp-foot">
        The optimizer never runs the query to compare plans — it <em>estimates</em> each from table cardinalities and per-predicate
        <strong> selectivities</strong>, scoring a plan by the intermediate rows it would materialize, and searches for the minimum (System-R uses
        dynamic programming over subsets, not brute force, so it scales past the n! orderings shown here). The whole game is to apply the most
        selective predicates earliest so intermediates stay small. This is also why <strong>bad cardinality estimates</strong> — a stale histogram,
        a correlated predicate — are the usual cause of a query suddenly going slow: the optimizer picks a plan that’s optimal for numbers that
        aren’t true anymore. (Selinger et al., 1979.)
      </p>
    </div>
  );
}
