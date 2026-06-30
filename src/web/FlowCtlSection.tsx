// HTTP/2 & QUIC flow control, made visible. The connection has one shared credit window; each stream
// has its own. Send bytes on a stream and watch BOTH bars drain — a send needs credit on each. Drain
// the shared connection window with one greedy stream and the others starve even though they still
// hold stream credit, until a connection-level MAX_DATA refills it. Real model from flowctl.ts.
import { useState } from 'react';
import { send, streamUpdate, connUpdate, starvedByConnection, initState, type ConnState } from './flowctl';

const CONN_MAX = 100;
const STREAM_MAX = 60;
const HUES: Record<number, number> = { 1: 212, 2: 150, 3: 280 };
const fresh = (): ConnState => initState(CONN_MAX, [{ id: 1, window: STREAM_MAX }, { id: 2, window: STREAM_MAX }, { id: 3, window: STREAM_MAX }]);

interface LogLine { text: string; tone: 'ok' | 'stall' }

export function FlowCtlSection() {
  const [state, setState] = useState<ConnState>(fresh);
  const [amounts, setAmounts] = useState<Record<number, number>>({ 1: 40, 2: 40, 3: 40 });
  const [log, setLog] = useState<LogLine[]>([]);

  const pushLog = (l: LogLine) => setLog((ls) => [l, ...ls].slice(0, 10));
  const doSend = (id: number) => {
    const r = send(state, id, amounts[id]);
    setState(r.state);
    if (r.sent === r.requested) pushLog({ text: `stream ${id}: sent all ${r.sent} bytes`, tone: 'ok' });
    else pushLog({ text: `stream ${id}: sent ${r.sent}/${r.requested} — stalled by the ${r.stalled} window`, tone: 'stall' });
  };
  const doStreamUpdate = (id: number) => { setState(streamUpdate(state, id, 30)); pushLog({ text: `WINDOW_UPDATE: +30 credit to stream ${id}`, tone: 'ok' }); };
  const doConnUpdate = () => { setState(connUpdate(state, 50)); pushLog({ text: 'MAX_DATA: +50 credit to the connection', tone: 'ok' }); };
  const reset = () => { setState(fresh()); setLog([]); };

  const connPct = Math.max(0, Math.min(100, (state.connWindow / CONN_MAX) * 100));

  return (
    <div className="fc">
      <div className="fc-conn">
        <div className="fc-conn-h">
          <span>Connection window (shared by all streams)</span>
          <b>{state.connWindow} / {CONN_MAX}</b>
        </div>
        <div className="fc-bar big"><div className="fc-fill" style={{ width: `${connPct}%`, background: state.connWindow === 0 ? 'hsl(0 60% 55%)' : 'hsl(212 70% 52%)' }} /></div>
        <div className="fc-conn-ctrl">
          <button type="button" className="fc-update conn" onClick={doConnUpdate}>MAX_DATA +50</button>
          {state.connWindow === 0 && <span className="fc-warn">connection exhausted — every stream is blocked</span>}
        </div>
      </div>

      <div className="fc-streams">
        {state.streams.map((s) => {
          const hue = HUES[s.id] ?? 200;
          const pct = Math.max(0, Math.min(100, (s.window / STREAM_MAX) * 100));
          const starved = starvedByConnection(state, s.id);
          return (
            <div key={s.id} className="fc-stream">
              <div className="fc-stream-h">
                <span className="fc-sid" style={{ color: `hsl(${hue} 60% 38%)` }}>stream {s.id}</span>
                <span className="fc-sent">sent {s.sent}</span>
                <b>{s.window} / {STREAM_MAX}</b>
              </div>
              <div className="fc-bar"><div className="fc-fill" style={{ width: `${pct}%`, background: `hsl(${hue} 60% 55%)` }} /></div>
              {starved && <div className="fc-starve">⚠ has {s.window} stream credit but the connection window is empty — starved</div>}
              <div className="fc-stream-ctrl">
                <input type="range" min={5} max={80} step={5} value={amounts[s.id]} onChange={(e) => setAmounts((a) => ({ ...a, [s.id]: +e.target.value }))} />
                <button type="button" className="fc-send" onClick={() => doSend(s.id)}>send {amounts[s.id]}B</button>
                <button type="button" className="fc-update" onClick={() => doStreamUpdate(s.id)}>+30 credit</button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="fc-log">
        <div className="fc-log-h">Activity</div>
        {log.length === 0 ? <div className="fc-log-empty">Try: send 40B on stream 1, then 40B on stream 2, then try stream 3 — the connection window runs dry and stream 3 starves. Then press MAX_DATA.</div> : (
          <ul>{log.map((l, i) => <li key={log.length - i} className={l.tone}>{l.text}</li>)}</ul>
        )}
        <button type="button" className="fc-reset" onClick={reset}>reset</button>
      </div>

      <p className="fc-foot">
        A DATA frame may be sent only when it fits under <strong>both</strong> the stream window and the connection window, and it debits both
        (<strong>RFC 9113 §5.2</strong> for HTTP/2; <strong>RFC 9000 §4</strong> for QUIC). The receiver replenishes credit as it consumes
        bytes — <em>WINDOW_UPDATE</em> / <em>MAX_STREAM_DATA</em> for a stream, <em>MAX_DATA</em> for the connection. The connection window is
        what a single window can’t model: it’s a shared pool, so a greedy or stalled stream can hold the whole connection hostage even while
        other streams still have stream-level credit to spend. Tuning that shared window is central to multiplexed-transport throughput.
      </p>
    </div>
  );
}
