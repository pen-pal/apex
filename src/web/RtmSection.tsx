// Realtime delivery spectrum, made visible. The same server events flow to a client three ways;
// each lane shows WHEN the client actually sees them. SSE and WebSocket push in one hop; long-poll
// stalls events that fire during its reconnect gap. Timing from realtime.ts (tested).
import { useMemo, useState } from 'react';
import { deliver, maxDelay, type Ev, type Transport } from './realtime';

const W = 600, LANE_H = 46, PAD = 80;
const EVENTS: Ev[] = [{ id: 1, readyMs: 0 }, { id: 2, readyMs: 40 }, { id: 3, readyMs: 90 }, { id: 4, readyMs: 320 }];
const TRANSPORTS: { id: Transport; label: string }[] = [
  { id: 'websocket', label: 'WebSocket' }, { id: 'sse', label: 'SSE' }, { id: 'longpoll', label: 'long-poll' },
];
const PROPS: [string, string, string, string][] = [
  ['direction', 'full-duplex', 'server → client', 'server → client (req/resp)'],
  ['per-message overhead', 'tiny (2–6 B frame)', 'small (text framing)', 'full HTTP request+response'],
  ['reconnect / resume', 'app-defined', 'automatic + Last-Event-ID replay', 'every message reconnects'],
  ['server→client latency', 'one hop', 'one hop', 'one hop, or a whole poll cycle'],
];

export function RtmSection() {
  const [owdMs, setOwd] = useState(50);
  const o = { owdMs, reconnectMs: 10 };
  const runs = useMemo(() => TRANSPORTS.map((t) => ({ ...t, d: deliver(t.id, EVENTS, o) })), [owdMs]);
  const maxT = Math.max(...runs.flatMap((r) => r.d.map((x) => x.deliveredMs))) + 30;
  const X = (t: number) => PAD + (t / maxT) * (W - PAD - 20);

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Realtime delivery — long-poll vs SSE vs WebSocket</h2></div>
        <p className="jsec-sub">
          Three ways to get server events into a browser. <strong>WebSocket</strong> and <strong>SSE</strong> hold a connection open, so an event
          arrives in one network hop. <strong>Long-poll</strong> fakes push with request/response: the server holds a request until an event, then
          the client must reconnect — and anything that happens during that <strong>reconnect gap</strong> waits for the next poll. Drag the network
          delay and watch the gap’s penalty.
        </p>

        <label className="rtm-slider">one-way delay <input type="range" min={20} max={120} step={5} value={owdMs} onChange={(e) => setOwd(+e.target.value)} /><b>{owdMs} ms</b></label>

        <svg viewBox={`0 0 ${W} ${LANE_H * 3 + 40}`} className="rtm-svg" role="img" aria-label="delivery timelines">
          {/* event-ready ticks across the top */}
          {EVENTS.map((e) => <line key={e.id} x1={X(e.readyMs)} y1={16} x2={X(e.readyMs)} y2={LANE_H * 3 + 24} className="rtm-readyline" />)}
          {EVENTS.map((e) => <text key={e.id} x={X(e.readyMs)} y={12} className="rtm-readylbl" textAnchor="middle">e{e.id}</text>)}
          {runs.map((r, li) => {
            const y = 30 + li * LANE_H;
            return (
              <g key={r.id}>
                <text x={4} y={y + 16} className="rtm-lane">{r.label}</text>
                <line x1={PAD} y1={y + 12} x2={W - 20} y2={y + 12} className="rtm-axis" />
                {r.d.map((dv) => (
                  <g key={dv.id}>
                    {/* delay span from ready→delivered */}
                    <line x1={X(dv.readyMs)} y1={y + 12} x2={X(dv.deliveredMs)} y2={y + 12} className={`rtm-span ${dv.delayMs > owdMs ? 'slow' : ''}`} />
                    <circle cx={X(dv.deliveredMs)} cy={y + 12} r={5} className={`rtm-dot ${dv.delayMs > owdMs ? 'slow' : ''}`} />
                    <text x={X(dv.deliveredMs)} y={y + 28} className="rtm-dlbl" textAnchor="middle">{dv.delayMs}ms</text>
                  </g>
                ))}
              </g>
            );
          })}
        </svg>

        <div className="rtm-maxes">
          {runs.map((r) => <span key={r.id} className={`rtm-max ${r.id === 'longpoll' ? 'lp' : ''}`}>{r.label}: worst delay <b>{maxDelay(r.d)} ms</b></span>)}
        </div>

        <table className="rtm-table">
          <thead><tr><th></th><th>WebSocket</th><th>SSE</th><th>long-poll</th></tr></thead>
          <tbody>{PROPS.map((row) => <tr key={row[0]}><td className="rtm-prop">{row[0]}</td><td>{row[1]}</td><td>{row[2]}</td><td>{row[3]}</td></tr>)}</tbody>
        </table>

        <p className="rtm-foot">
          Pick by shape of traffic, not hype. Server→client only (notifications, live scores, token streams)? <strong>SSE</strong> wins — it’s
          plain HTTP, survives proxies, auto-reconnects, and replays missed events via <code>Last-Event-ID</code>. Need the client to push too
          (chat, games, collaborative editing)? <strong>WebSocket</strong>’s full-duplex, low-overhead frames fit. <strong>Long-poll</strong> is
          the universal fallback that works anywhere but pays an HTTP round trip per message and stalls on its reconnect gap. Note all three still
          ride one TCP connection, so they inherit TCP head-of-line blocking — which is exactly what HTTP/3 over QUIC set out to fix.
        </p>
      </section>
    </div>
  );
}
