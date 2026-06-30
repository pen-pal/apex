// MESI cache coherence, made clickable. Each core holds one copy of the SAME memory line; press a
// core's read or write and watch its state move through Modified / Exclusive / Shared / Invalid while
// the bus snoop invalidates or downgrades the others. The transaction log shows the bus traffic and
// the write-backs — the real cost of sharing a line. Real transition model from mesi.ts.
import { useState } from 'react';
import { step, STATE_NAME, type State, type Op, type Bus } from './mesi';

const STATE_HUE: Record<State, number> = { M: 0, E: 212, S: 150, I: 220 };
const stateStyle = (s: State) => s === 'I'
  ? { background: '#f1f3f6', color: 'var(--muted)', borderColor: 'var(--line)' }
  : { background: `hsl(${STATE_HUE[s]} 60% 96%)`, color: `hsl(${STATE_HUE[s]} 60% 32%)`, borderColor: `hsl(${STATE_HUE[s]} 55% 65%)` };

interface LogEntry { core: number; op: Op; bus: Bus; flush: boolean; hit: boolean; states: State[]; note: string }

export function MesiSection() {
  const [n, setN] = useState(3);
  const [states, setStates] = useState<State[]>(Array(3).fill('I'));
  const [log, setLog] = useState<LogEntry[]>([]);
  const [last, setLast] = useState<{ core: number; op: Op } | null>(null);

  const resize = (count: number) => { setN(count); setStates(Array(count).fill('I')); setLog([]); setLast(null); };
  const reset = () => { setStates(Array(n).fill('I')); setLog([]); setLast(null); };

  const act = (core: number, op: Op) => {
    const s = step(states, core, op);
    setStates(s.states);
    setLast({ core, op });
    setLog((l) => [{ core, op, bus: s.bus, flush: s.flush, hit: s.hit, states: s.states, note: s.note }, ...l].slice(0, 12));
  };

  return (
    <div className="mesi">
      <div className="mesi-top">
        <label className="mesi-nctl">cores
          <select value={n} onChange={(e) => resize(+e.target.value)}>
            {[2, 3, 4].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <button type="button" className="mesi-reset" onClick={reset}>reset line (all Invalid)</button>
        <div className="mesi-legend">
          {(['M', 'E', 'S', 'I'] as State[]).map((s) => (
            <span key={s} className="mesi-leg" style={stateStyle(s)}><b>{s}</b> {STATE_NAME[s]}</span>
          ))}
        </div>
      </div>

      <div className="mesi-cores">
        {states.map((s, i) => (
          <div key={i} className={`mesi-core ${last?.core === i ? 'acting' : ''}`}>
            <div className="mesi-core-h">Core {i}</div>
            <div className="mesi-line" style={stateStyle(s)}>
              <span className="mesi-state">{s}</span>
              <span className="mesi-state-name">{STATE_NAME[s]}</span>
            </div>
            <div className="mesi-ops">
              <button type="button" onClick={() => act(i, 'read')}>read</button>
              <button type="button" onClick={() => act(i, 'write')}>write</button>
            </div>
          </div>
        ))}
        <div className="mesi-memory">main memory<br /><span>the line lives here when every cache is Invalid</span></div>
      </div>

      <div className="mesi-log">
        <div className="mesi-log-h">Bus &amp; coherence log</div>
        {log.length === 0 ? (
          <div className="mesi-log-empty">Press a core's read or write. Try: Core 0 read → Core 1 read → Core 0 write → Core 1 read.</div>
        ) : (
          <ul>
            {log.map((e, k) => (
              <li key={log.length - k} className={k === 0 ? 'fresh' : ''}>
                <span className="mesi-le-act">Core {e.core} {e.op}</span>
                <span className={`mesi-le-bus ${e.bus ? 'b' : 'none'}`}>{e.bus ?? 'no bus'}</span>
                {e.flush && <span className="mesi-le-flush">write-back</span>}
                <span className="mesi-le-states">[{e.states.join(' ')}]</span>
                <span className="mesi-le-note">{e.note}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mesi-foot">
        Only one core can hold a line in <strong>M</strong> or <strong>E</strong> at a time — that's the invariant that prevents two writers
        and stale reads. A write to a <strong>Shared</strong> line costs a <em>BusUpgr</em> to invalidate every other copy; a read of a
        <strong> Modified</strong> line forces the owner to write back. This is exactly why <strong>false sharing</strong> hurts: two unrelated
        variables on the same 64-byte line make independent writes from different cores ping-pong the line through Invalid, even though the
        programs never actually share data. Padding the variables onto separate lines removes the coherence traffic entirely.
      </p>
    </div>
  );
}
