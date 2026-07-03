// Nagle's algorithm × delayed ACK, as a live TCP ladder diagram. Sender on the left, receiver
// on the right, time flowing down; data segments slope right, ACKs slope left. Toggle Nagle and
// delayed ACK, drag the RTT and the delayed-ACK timer, and watch the famous write-write-read
// deadlock appear as a red stall band — then watch it vanish when you set TCP_NODELAY. All times
// come from the tested timing model in nagle.ts (one-way delay = RTT/2).
import { useMemo, useState } from 'react';
import { simulate, PRESETS, type NagleConfig } from './nagle';

const W = 560;
const SX = 90; // sender line x
const RX = W - 90; // receiver line x
const TOP = 34;
const BOT = 26;

export function NagleSection() {
  const [preset, setPreset] = useState('ww');
  const [nagle, setNagle] = useState(true);
  const [delayedAck, setDelayedAck] = useState(true);
  const [rttMs, setRttMs] = useState(100);
  const [delayedAckMs, setDelayedAckMs] = useState(40);

  const writes = PRESETS.find((p) => p.id === preset)!.writes;
  const cfg: NagleConfig = { writes, mss: 1460, rttMs, nagle, delayedAck, delayedAckMs };
  const r = useMemo(() => simulate(cfg), [preset, nagle, delayedAck, rttMs, delayedAckMs]);

  const maxT = Math.max(r.completionMs, 1);
  const H = 250;
  const y = (t: number) => TOP + (t / maxT) * (H - TOP - BOT);

  const sends = r.events.filter((e) => e.kind === 'send');
  const delivers = r.events.filter((e) => e.kind === 'deliver');
  const acks = r.events.filter((e) => e.kind === 'ack');
  const ackRecvs = r.events.filter((e) => e.kind === 'ack-recv');

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Nagle’s algorithm &amp; delayed ACK — the stall nobody intends</h2></div>
        <p className="jsec-sub">
          Two reasonable optimizations that sabotage each other. <strong>Nagle</strong> (RFC 896): if you have unacknowledged data in
          flight, don’t send another <em>sub-MSS</em> segment — buffer it until a full MSS piles up or the outstanding data is ACKed.
          <strong> Delayed ACK</strong> (RFC 1122): don’t ACK a lone segment immediately — wait up to a timer to piggyback it on reply
          data or batch two ACKs. Alone, each saves packets. Together, in a write-write-read exchange, they <strong>deadlock</strong>: the
          sender holds segment&nbsp;2 waiting for an ACK while the receiver holds the ACK waiting for segment&nbsp;2.
        </p>

        <div className="ng-controls">
          <div className="ng-presets">
            {PRESETS.map((p) => (
              <button key={p.id} className={`ng-chip ${preset === p.id ? 'on' : ''}`} onClick={() => setPreset(p.id)} title={p.note}>{p.label}</button>
            ))}
          </div>
          <div className="ng-toggles">
            <label className={`ng-tog ${nagle ? 'on' : ''}`}><input type="checkbox" checked={nagle} onChange={(e) => setNagle(e.target.checked)} /> Nagle’s algorithm <span className="ng-hint">{nagle ? '' : '(TCP_NODELAY)'}</span></label>
            <label className={`ng-tog ${delayedAck ? 'on' : ''}`}><input type="checkbox" checked={delayedAck} onChange={(e) => setDelayedAck(e.target.checked)} /> Delayed ACK</label>
            <label className="ng-slide">RTT <input type="range" min={20} max={300} step={10} value={rttMs} onChange={(e) => setRttMs(+e.target.value)} /><b>{rttMs} ms</b></label>
            <label className="ng-slide">ACK timer <input type="range" min={10} max={200} step={10} value={delayedAckMs} onChange={(e) => setDelayedAckMs(+e.target.value)} disabled={!delayedAck} /><b>{delayedAckMs} ms</b></label>
          </div>
        </div>

        <div className="ng-stage">
          <svg viewBox={`0 0 ${W} ${H}`} className="ng-svg" role="img" aria-label="TCP ladder diagram of the Nagle / delayed-ACK exchange">
            <defs>
              <marker id="ngArrR" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="hsl(212 60% 48%)" /></marker>
              <marker id="ngArrL" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="hsl(150 45% 40%)" /></marker>
            </defs>
            {/* stall bands on the sender line */}
            {r.stalls.map((s, i) => (
              <g key={`st${i}`}>
                <rect x={SX - 5} y={y(s.from)} width={10} height={Math.max(2, y(s.to) - y(s.from))} fill="hsl(0 70% 55%)" opacity="0.22" />
                <text x={SX - 10} y={(y(s.from) + y(s.to)) / 2} className="ng-stall-lbl" textAnchor="end">stall {Math.round(s.to - s.from)}ms</text>
              </g>
            ))}
            {/* the two timelines */}
            <line x1={SX} y1={TOP - 12} x2={SX} y2={H - 8} className="ng-axis" />
            <line x1={RX} y1={TOP - 12} x2={RX} y2={H - 8} className="ng-axis" />
            <text x={SX} y={14} className="ng-head" textAnchor="middle">Sender</text>
            <text x={RX} y={14} className="ng-head" textAnchor="middle">Receiver</text>
            {/* data segments: sender -> receiver */}
            {sends.map((s) => {
              const d = delivers.find((e) => e.seg === s.seg);
              if (!d) return null;
              return (
                <g key={`s${s.seg}`}>
                  <line x1={SX} y1={y(s.t)} x2={RX} y2={y(d.t)} className="ng-data" markerEnd="url(#ngArrR)" />
                  <text x={(SX + RX) / 2} y={(y(s.t) + y(d.t)) / 2 - 4} className="ng-lbl data" textAnchor="middle">seg{s.seg} · {s.bytes}B</text>
                </g>
              );
            })}
            {/* ACKs: receiver -> sender */}
            {acks.map((a, i) => {
              const ar = ackRecvs[i];
              if (!ar) return null;
              return (
                <g key={`a${i}`}>
                  <line x1={RX} y1={y(a.t)} x2={SX} y2={y(ar.t)} className="ng-ack" markerEnd="url(#ngArrL)" />
                  <text x={(SX + RX) / 2} y={(y(a.t) + y(ar.t)) / 2 - 4} className="ng-lbl ack" textAnchor="middle">ACK {a.seg}B</text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className={`ng-verdict ${r.stalledMs > 0 ? 'bad' : 'good'}`}>
          <div className="ng-stat"><span className="ng-num">{r.segments}</span><span className="ng-cap">segments for {r.bytes} B</span></div>
          <div className="ng-stat"><span className="ng-num">{r.completionMs} ms</span><span className="ng-cap">to deliver + ACK all bytes</span></div>
          <div className="ng-stat"><span className={`ng-num ${r.stalledMs > 0 ? 'red' : 'grn'}`}>{r.stalledMs} ms</span><span className="ng-cap">Nagle stall</span></div>
          <p className="ng-explain">
            {r.stalledMs > 0
              ? (nagle && delayedAck
                  ? `Classic deadlock: the sender held a sub-MSS segment because earlier data was unacked, and the receiver sat on the ACK for ${delayedAckMs} ms before its timer fired. That ${r.stalledMs} ms is pure waiting.`
                  : `The sender held a sub-MSS segment until the prior data was ACKed — one full round trip of waiting (${r.stalledMs} ms).`)
              : (nagle
                  ? 'No stall here: either the data filled a full MSS (Nagle ships full segments instantly) or there was nothing unacked to wait on.'
                  : 'Nagle is off (TCP_NODELAY), so every write goes on the wire immediately — lowest latency, at the cost of more, smaller packets.')}
          </p>
        </div>

        <p className="ng-foot">
          The fix most latency-sensitive code reaches for is <code>TCP_NODELAY</code> (disable Nagle) so request/response RPCs aren’t held
          hostage to a 40–200 ms ACK timer — toggle Nagle off above and the stall disappears. The deeper fix is to avoid the write-write-read
          pattern: send your header and body in one <code>writev</code>/buffer so there’s no lone small segment to hold. Nagle still earns its
          keep for chatty interactive streams (the original target was telnet flooding the wire with one-byte “tinygrams”) — try the telnet
          preset to see five keystrokes coalesce into far fewer packets.
        </p>
      </section>
    </div>
  );
}
