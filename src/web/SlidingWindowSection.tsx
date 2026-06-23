// TCP sliding window — flow control made visible. The sender's byte stream is one
// long line split into four regions: acknowledged, in-flight, sendable-now, and
// blocked. The send window is min(rwnd, cwnd): the receiver's advertised window OR
// the congestion window, whichever is smaller. Send bytes, ACK them to slide the
// window, and shrink rwnd to watch a slow receiver throttle the sender. Real model.
import { useState } from 'react';
import { windowView, send, ack, advertise, type WindowState } from './slidingwindow';

const TOTAL = 64;
const SEG = 4;
const init: WindowState = { sndUna: 0, sndNxt: 0, rwnd: 20, cwnd: 32, total: TOTAL };

export function SlidingWindowSection() {
  const [s, setS] = useState<WindowState>(init);
  const v = windowView(s);
  const pct = (b: number) => (b / TOTAL) * 100;
  const limit = s.rwnd <= s.cwnd ? 'rwnd' : 'cwnd';

  const setRwnd = (r: number) => setS((st) => advertise(st, r));
  const setCwnd = (c: number) => setS((st) => ({ ...st, cwnd: c }));

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>TCP sliding window — flow control</h2></div>
        <p className="jsec-sub">
          Congestion control asks “is the <em>network</em> overloaded?”; flow control asks “can the <em>receiver</em> keep
          up?”. The receiver advertises a window (<strong>rwnd</strong>); the sender may have at most <strong>min(rwnd,
          cwnd)</strong> bytes outstanding. Send data, ACK it to slide the window forward, and drop rwnd to watch a slow
          receiver throttle the sender.
        </p>

        <div className="sw-bar">
          <div className="sw-region acked" style={{ left: `${pct(v.regions.acked[0])}%`, width: `${pct(v.regions.acked[1] - v.regions.acked[0])}%` }} />
          <div className="sw-region inflight" style={{ left: `${pct(v.regions.inFlight[0])}%`, width: `${pct(v.regions.inFlight[1] - v.regions.inFlight[0])}%` }} />
          <div className="sw-region sendable" style={{ left: `${pct(v.regions.sendable[0])}%`, width: `${pct(v.regions.sendable[1] - v.regions.sendable[0])}%` }} />
          <div className="sw-region blocked" style={{ left: `${pct(v.regions.blocked[0])}%`, width: `${pct(v.regions.blocked[1] - v.regions.blocked[0])}%` }} />
          {/* window bracket */}
          <div className="sw-window" style={{ left: `${pct(s.sndUna)}%`, width: `${pct(v.windowRight - s.sndUna)}%` }} />
          {/* edge markers */}
          <Edge label="snd.una" at={pct(s.sndUna)} />
          <Edge label="snd.nxt" at={pct(s.sndNxt)} />
          <Edge label="win →" at={pct(v.windowRight)} />
        </div>

        <div className="sw-legend">
          <span><i className="sw-sw acked" /> acked ({v.regions.acked[1]})</span>
          <span><i className="sw-sw inflight" /> in flight ({v.bytesInFlight})</span>
          <span><i className="sw-sw sendable" /> sendable now ({v.usableWindow})</span>
          <span><i className="sw-sw blocked" /> blocked</span>
        </div>

        <div className="sw-controls">
          <button className="ghost small" disabled={v.usableWindow <= 0} onClick={() => setS(send(s, SEG))}>send {SEG}B →</button>
          <button className="ghost small" disabled={v.bytesInFlight <= 0} onClick={() => setS(ack(s, SEG))}>← ACK {SEG}B</button>
          <button className="ghost small" onClick={() => setRwnd(0)}>advertise zero window</button>
          <button className="ghost small" onClick={() => setS(init)}>↺ reset</button>
        </div>

        <div className="sw-sliders">
          <label>rwnd (receiver): {s.rwnd}<input type="range" min={0} max={40} value={s.rwnd} onChange={(e) => setRwnd(+e.target.value)} /></label>
          <label>cwnd (congestion): {s.cwnd}<input type="range" min={4} max={48} value={s.cwnd} onChange={(e) => setCwnd(+e.target.value)} /></label>
        </div>

        <div className="sw-readout">
          <Stat k="send window" v={`min(${s.rwnd}, ${s.cwnd}) = ${v.sendWindow}`} note={`${limit} is the limit`} />
          <Stat k="bytes in flight" v={`${v.bytesInFlight}`} />
          <Stat k="usable window" v={`${v.usableWindow}`} note={v.usableWindow === 0 ? 'sender is blocked' : 'may send now'} hl />
        </div>

        {v.zeroWindow && (
          <p className="sw-zero">⚠ Zero window — the receiver’s buffer is full, so the sender must stop. It keeps a tiny
            <strong> persist timer</strong> going, periodically probing with 1 byte, so it learns the moment the window re-opens
            (otherwise a lost window-update would deadlock the connection forever).</p>
        )}
        <p className="enc-note">The actual send rate is governed by whichever window is smaller. A fast server talking to a slow
          phone is flow-control limited (rwnd); a fast connection across a congested core is congestion-limited (cwnd). TCP obeys both at once.</p>
      </section>
    </div>
  );
}

function Edge({ label, at }: { label: string; at: number }) {
  return <div className="sw-edge" style={{ left: `${at}%` }}><span>{label}</span></div>;
}
function Stat({ k, v, note, hl }: { k: string; v: string; note?: string; hl?: boolean }) {
  return (
    <div className={`sw-stat ${hl ? 'hl' : ''}`}>
      <span className="sw-k">{k}</span>
      <code className="sw-v">{v}</code>
      {note && <em>{note}</em>}
    </div>
  );
}
