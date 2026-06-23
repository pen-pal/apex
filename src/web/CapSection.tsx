// CAP theorem, made visible. Two replicas of a value. Toggle a network partition,
// then choose CP (stay consistent — the minority side goes unavailable) or AP (stay
// available — the sides diverge, then reconcile on heal). Write and read each side
// and watch the trade-off play out. Real CAP logic (see cap.ts).
import { useReducer, useRef, useState } from 'react';
import { CapSystem, type Mode, type Side, type OpResult } from './cap';

export function CapSection() {
  const sysRef = useRef(new CapSystem('CP', 'v0'));
  const [, tick] = useReducer((x) => x + 1, 0);
  const sys = sysRef.current;
  const [valA, setValA] = useState('A-write');
  const [valB, setValB] = useState('B-write');
  const [readA, setReadA] = useState<OpResult | null>(null);
  const [readB, setReadB] = useState<OpResult | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const setMode = (m: Mode) => { sys.mode = m; setBanner(null); tick(); };
  const togglePartition = () => {
    const next = !sys.partitioned;
    sys.setPartitioned(next);
    if (!next) setBanner(`Partition healed → reconciled (last-writer-wins): both replicas are now “${sys.A.value}” (v${sys.A.version}).`);
    else setBanner(null);
    setReadA(null); setReadB(null); tick();
  };
  const write = (s: Side, v: string) => { const r = (s === 'A' ? sys.write('A', v) : sys.write('B', v)); setBanner(r.ok ? null : r.error); (s === 'A' ? setReadA : setReadB)(null); tick(); };
  const read = (s: Side) => { const r = sys.read(s); (s === 'A' ? setReadA : setReadB)(r); tick(); };
  const reset = () => { sysRef.current = new CapSystem(sys.mode, 'v0'); setReadA(null); setReadB(null); setBanner(null); tick(); };

  const box = (s: Side, val: string, setVal: (v: string) => void, rd: OpResult | null) => {
    const rep = s === 'A' ? sys.A : sys.B;
    const avail = sys.available(s);
    const isPrimary = sys.mode === 'CP' && sys.partitioned && sys.primary === s;
    return (
      <div className={`cap-box ${avail ? '' : 'down'}`}>
        <div className="cap-box-head">
          <span className="cap-rep">Replica {s}{isPrimary && <span className="cap-primary"> primary</span>}</span>
          <span className={`cap-avail ${avail ? 'up' : 'no'}`}>{avail ? 'available' : 'UNAVAILABLE'}</span>
        </div>
        <div className="cap-val"><code>{rep.value}</code><span className="cap-ver">v{rep.version}</span></div>
        <div className="cap-row">
          <input className="cap-input" value={val} onChange={(e) => setVal(e.target.value)} spellCheck={false} />
          <button className="ghost small" onClick={() => write(s, val)}>write</button>
          <button className="ghost small" onClick={() => read(s)}>read</button>
        </div>
        {rd && <div className={`cap-read ${rd.ok ? 'ok' : 'err'}`}>{rd.ok ? `read → “${rd.value}” (v${rd.version})` : `✗ ${rd.error}`}</div>}
      </div>
    );
  };

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>CAP theorem — consistency vs availability under a partition</h2></div>
        <p className="jsec-sub">
          When the network splits your replicas (a <strong>partition</strong>), you must choose: keep them
          <strong> Consistent</strong> (CP — make one side unavailable so nobody reads stale data) or keep them
          <strong> Available</strong> (AP — let both sides serve, accept that they’ll diverge, reconcile later). You can’t
          have both during a partition. Flip the partition and the mode and try writing each side.
        </p>

        <div className="cap-controls">
          <div className="seg">
            <button className={sys.mode === 'CP' ? 'on' : ''} onClick={() => setMode('CP')}>CP (consistent)</button>
            <button className={sys.mode === 'AP' ? 'on' : ''} onClick={() => setMode('AP')}>AP (available)</button>
          </div>
          <button className={`ghost small ${sys.partitioned ? 'cap-part-on' : ''}`} onClick={togglePartition}>{sys.partitioned ? '🔗 heal partition' : '✂ partition the network'}</button>
          {sys.mode === 'CP' && <label className="cap-prim">primary: <select value={sys.primary} onChange={(e) => { sys.primary = e.target.value as Side; tick(); }}><option value="A">A</option><option value="B">B</option></select></label>}
          <button className="ghost small" onClick={reset}>↺ reset</button>
        </div>

        <div className="cap-stage">
          {box('A', valA, setValA, readA)}
          <div className={`cap-link ${sys.partitioned ? 'cut' : ''}`}>{sys.partitioned ? '✂ partition' : '↔ replicated'}</div>
          {box('B', valB, setValB, readB)}
        </div>

        {sys.diverged && sys.partitioned && <div className="cap-diverge">⚠ The replicas have DIVERGED — A=“{sys.A.value}”, B=“{sys.B.value}”. That’s AP: both stayed available, consistency was sacrificed until the partition heals.</div>}
        {banner && <div className="cap-banner">{banner}</div>}
        <p className="enc-note">Real systems pick per-operation, not globally: a bank balance wants CP (refuse rather than double-spend); a shopping
          cart or “likes” count wants AP (always accept, merge later). PACELC extends CAP: <em>even with no partition</em> you still trade latency vs
          consistency (a strongly-consistent read may wait for a quorum). There’s no free lunch in distributed state.</p>
      </section>
    </div>
  );
}
