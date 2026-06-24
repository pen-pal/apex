// CRDTs, made visible. Increment two replicas while they're "offline", then sync and
// watch them converge to the SUM — no lost updates, no conflict, no coordination —
// because the merge is a commutative/associative/idempotent join. Contrast with a
// naive last-write-wins counter that would drop one side. Real G-Counter + LWW
// register (crdt.ts, lattice laws tested).
import { useState } from 'react';
import { gIncrement, gMerge, gValue, lwwMerge, type GCounter, type LWW } from './crdt';

export function CrdtSection() {
  const [ra, setRa] = useState<GCounter>({});
  const [rb, setRb] = useState<GCounter>({});
  const naiveA = Object.values(ra).reduce((s, n) => s + n, 0); // if A were the "last writer"

  const sync = () => { const m = gMerge(ra, rb); setRa(m); setRb(m); };
  const reset = () => { setRa({}); setRb({}); };
  const converged = JSON.stringify(ra) === JSON.stringify(rb);

  // LWW register
  const [clock, setClock] = useState(1);
  const [la, setLa] = useState<LWW>({ value: '—', ts: 0, replica: 'A' });
  const [lb, setLb] = useState<LWW>({ value: '—', ts: 0, replica: 'B' });
  const writeL = (which: 'A' | 'B', value: string) => {
    const reg = { value, ts: clock, replica: which };
    which === 'A' ? setLa(reg) : setLb(reg); setClock((c) => c + 1);
  };
  const lww = lwwMerge(la, lb);

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>① G-Counter — increments that never collide</h2></div>
        <p className="jsec-sub">
          Each replica keeps its <em>own</em> count; the value is the sum, and merging takes the elementwise max. Increment both
          replicas while they’re partitioned, then sync — every increment survives, and both sides agree, no matter the order or how
          many times messages arrive.
        </p>
        <div className="crdt-reps">
          {[['A', ra, setRa] as const, ['B', rb, setRb] as const].map(([id, st]) => (
            <div key={id} className="crdt-rep">
              <div className="crdt-rep-h">replica {id}</div>
              <div className="crdt-val">{gValue(st)}</div>
              <div className="crdt-map">{Object.entries(st).map(([k, v]) => <span key={k}>{k}:{v}</span>)}{!Object.keys(st).length && <span className="crdt-empty">∅</span>}</div>
              <button className="crdt-inc" onClick={() => (id === 'A' ? setRa((c) => gIncrement(c, 'A')) : setRb((c) => gIncrement(c, 'B')))}>+1 on {id}</button>
            </div>
          ))}
        </div>
        <div className="crdt-actions">
          <button className="crdt-sync" onClick={sync}>🔄 sync ⇄ (merge)</button>
          <button className="crdt-ghost" onClick={reset}>reset</button>
        </div>
        <div className={`crdt-verdict ${converged ? 'ok' : ''}`}>
          {converged
            ? <>✅ converged — both replicas show <strong>{gValue(ra)}</strong> = the total of every increment.</>
            : <>partitioned — A sees {gValue(ra)}, B sees {gValue(rb)}. A naive last-write-wins counter would keep only one side ({Math.max(naiveA, gValue(rb))}), <strong>losing {Math.min(naiveA, gValue(rb))} increments</strong>. The CRDT won’t.</>}
        </div>
      </section>

      <section className="jsec">
        <div className="jsec-head"><h2>② LWW-Register — a single value, decided deterministically</h2></div>
        <p className="jsec-sub">
          Some data isn’t additive — there’s one current value. A last-write-wins register tags each write with a timestamp; on
          merge the higher timestamp wins (ties broken by replica id), so concurrent writes resolve the <em>same way everywhere</em>.
        </p>
        <div className="crdt-lww">
          {(['A', 'B'] as const).map((id) => {
            const reg = id === 'A' ? la : lb;
            return (
              <div key={id} className="crdt-rep">
                <div className="crdt-rep-h">replica {id}</div>
                <div className="crdt-lval" style={{ color: reg.value === '—' ? 'var(--muted)' : reg.value }}>{reg.value} <span className="crdt-ts">@t{reg.ts}</span></div>
                <div className="crdt-pick">{['red', 'green', 'blue'].map((c) => <button key={c} style={{ background: c }} onClick={() => writeL(id, c)} />)}</div>
              </div>
            );
          })}
        </div>
        <div className="crdt-verdict ok">after merge both converge to <strong style={{ color: lww.value === '—' ? 'inherit' : lww.value }}>{lww.value}</strong> (latest write, t{lww.ts}).</div>
        <p className="crdt-foot">
          These laws are why CRDTs power collaborative editors, offline-first apps, and multi-region databases (Riak, Redis CRDTs,
          Automerge, Yjs): replicas accept writes locally and reconcile later with zero conflict-resolution code. The trade is that
          you must shape your data as a counter, set, or register whose merge is a lattice join.
        </p>
      </section>
    </div>
  );
}
