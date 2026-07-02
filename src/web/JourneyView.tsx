// The journey / encapsulation view. Data goes DOWN the stack (payload wrapped by
// TCP, IPv4, Ethernet), travels the wire as a real signal, a router re-wraps it
// for the next hop, then the receiver peels it back UP and recovers the message.
// Everything derives from the JourneyModel (engine output) — no protocol layouts.
import { useMemo, useState } from 'react';
import type { JourneyModel } from './journeyModel';
import { layerHue, PAYLOAD_COLOR, TRAILER_COLOR } from './colors';

interface LayerStyle { solid: string; bg: string; border: string; text: string }

function layerStyle(depth: number): LayerStyle {
  const h = layerHue(depth);
  return {
    solid: `hsl(${h} 58% 46%)`,
    bg: `hsl(${h} 60% 97%)`,
    border: `hsl(${h} 45% 72%)`,
    text: `hsl(${h} 52% 30%)`,
  };
}

const PAYLOAD_STYLE: LayerStyle = { solid: PAYLOAD_COLOR, bg: 'hsl(280 40% 97%)', border: 'hsl(280 35% 75%)', text: 'hsl(280 45% 34%)' };
const FCS_STYLE: LayerStyle = { solid: TRAILER_COLOR, bg: 'hsl(220 12% 96%)', border: 'hsl(220 10% 72%)', text: 'hsl(220 12% 38%)' };

export function JourneyView({ journey, message }: { journey: JourneyModel; message: string }) {
  const [replay, setReplay] = useState(0);
  const maxDepth = journey.layers.length; // payload sits one below the deepest header

  // id -> style, for the flat bar and labels.
  const styleForId = useMemo(() => {
    const m = new Map<string, LayerStyle>();
    journey.layers.forEach((l) => m.set(l.id, layerStyle(l.depth)));
    m.set('payload', PAYLOAD_STYLE);
    m.set('fcs', FCS_STYLE);
    return m;
  }, [journey]);

  const headerTotal = journey.layers.reduce((s, l) => s + l.headerBytes, 0) + journey.trailerLength;

  return (
    <div className="journey">
      {/* DOWN THE STACK */}
      <section className="jsec">
        <div className="jsec-head">
          <h2>Down the stack — encapsulation</h2>
          <button className="ghost" onClick={() => setReplay((r) => r + 1)}>↻ Replay</button>
        </div>
        <p className="jsec-sub">
          Your message starts as bytes, then each layer wraps it with its own header. Watch the
          overhead accumulate from the inside out.
        </p>
        <div className="nest" key={replay}>
          <Nest journey={journey} index={0} maxDepth={maxDepth} />
        </div>
        <p className="overhead">
          <strong>{journey.payloadLength}</strong> byte{journey.payloadLength === 1 ? '' : 's'} of message ride inside{' '}
          <strong>{headerTotal}</strong> bytes of headers{journey.trailerLength > 4 ? ', padding' : ''} + FCS — <strong>{journey.totalBytes}</strong> bytes on the wire
          {journey.trailerLength > 4 ? ' (padded up to the 64-byte Ethernet minimum)' : ''}.
        </p>
      </section>

      {/* FLAT BYTE LAYOUT */}
      <section className="jsec">
        <h2>Byte layout on the wire</h2>
        <p className="jsec-sub">The same frame, flattened. Width is proportional to each part's size.</p>
        <div className="flatbar">
          {journey.segments.map((seg, i) => {
            const st = styleForId.get(seg.id) ?? FCS_STYLE;
            const pct = (seg.length / journey.totalBytes) * 100;
            return (
              <div key={i} className="flatseg" style={{ width: `${pct}%`, background: st.solid }} title={`${seg.label}: ${seg.length} B`}>
                {seg.length}B
              </div>
            );
          })}
        </div>
        <div className="flatlbl">
          {journey.segments.map((seg, i) => {
            const st = styleForId.get(seg.id) ?? FCS_STYLE;
            const pct = (seg.length / journey.totalBytes) * 100;
            return (
              <div key={i} style={{ width: `${pct}%`, color: st.text }}>{seg.label}</div>
            );
          })}
        </div>
      </section>

      {/* ON THE WIRE */}
      <section className="jsec">
        <h2>On the wire — the signal</h2>
        <p className="jsec-sub">
          The literal high/low voltages a NIC clocks onto the link (NRZ-L). High = 1, low = 0 — the
          first {Math.min(journey.frameBytes.length * 8, 32)} bits of the frame.
        </p>
        <Wire bytes={journey.frameBytes} />
      </section>

      {/* ROUTER RE-WRAP — only for a full Ethernet/IPv4 frame that a router would forward */}
      {journey.routerChanges.length > 0 && (
      <section className="jsec">
        <h2>Through a router — re-wrap for the next hop</h2>
        <p className="jsec-sub">
          A router strips the link layer, decrements the TTL, and re-wraps with a fresh Ethernet
          header for the next link. Everything that depends on those bytes — the IP checksum and the
          Ethernet FCS — is recomputed. End-to-end fields (IPs, ports, sequence numbers, the TCP
          checksum) are left untouched.
        </p>
        <div className="changes">
          {journey.routerChanges.map((c, i) => (
            <div className="change" key={i}>
              <div className="change-where">
                <span className="ch-layer">{c.layer}</span>
                <span className="ch-field">{c.field}</span>
              </div>
              <div className="change-vals">
                <code className="before">{c.before}</code>
                <span className="arrow">→</span>
                <code className="after">{c.after}</code>
              </div>
              {(c.beforeMeaning || c.afterMeaning) && (
                <div className="change-note">{c.afterMeaning ?? c.beforeMeaning}</div>
              )}
            </div>
          ))}
        </div>
      </section>
      )}

      {/* UP THE STACK */}
      <section className="jsec">
        <h2>Up the stack — decapsulation &amp; recovery</h2>
        <p className="jsec-sub">The receiver peels each header off in reverse and hands the bytes back to the app.</p>
        <div className="peel">
          {[...journey.layers].map((l, i) => {
            const st = layerStyle(l.depth);
            return (
              <span key={l.id} className="peel-step" style={{ borderColor: st.border, background: st.bg, color: st.text }}>
                <strong>L{l.layer} {l.name}</strong> strip {l.headerBytes}B{i === 0 && journey.trailerLength ? ` + ${journey.trailerLength}B ${journey.trailerLength > 4 ? 'pad/FCS' : 'FCS'}` : ''}
              </span>
            );
          })}
          <span className="peel-step" style={{ borderColor: PAYLOAD_STYLE.border, background: PAYLOAD_STYLE.bg, color: PAYLOAD_STYLE.text }}>
            <strong>L7 Data</strong> {journey.payloadLength}B payload
          </span>
        </div>
        <div className="recovered">
          <span className="rec-label">recovered</span>
          <code>{journey.recovered || '—'}</code>
          {journey.recovered === message ? (
            <span className="rec-ok">✓ matches what you typed</span>
          ) : (
            <span className="rec-note">round-trip from the dissected bytes</span>
          )}
        </div>
      </section>
    </div>
  );
}

/** Recursively render the encapsulation nest, outermost (index 0) wrapping inward. */
function Nest({ journey, index, maxDepth }: { journey: JourneyModel; index: number; maxDepth: number }) {
  if (index >= journey.layers.length) {
    // innermost: the payload itself (revealed first)
    return (
      <div className="encap payload" style={{ borderColor: PAYLOAD_STYLE.border, background: PAYLOAD_STYLE.bg, animationDelay: '0s' }}>
        <span className="ll" style={{ background: PAYLOAD_STYLE.solid }}>L7 Application Data</span>
        <div className="payload-msg" style={{ color: PAYLOAD_STYLE.text }}>"{journey.payloadAscii}"</div>
        <div className="payload-cnt">{journey.payloadLength} byte{journey.payloadLength === 1 ? '' : 's'}</div>
      </div>
    );
  }
  const l = journey.layers[index];
  const st = layerStyle(l.depth);
  // Reveal innermost first: deeper layers have shorter delay.
  const delay = (maxDepth - l.depth) * 0.16;
  return (
    <div className="encap" style={{ borderColor: st.border, background: st.bg, animationDelay: `${delay}s` }}>
      <span className="ll" style={{ background: st.solid }}>L{l.layer} {l.name}</span>
      <span className="ll-over" style={{ color: st.text }}>+{l.headerBytes}B header</span>
      <Nest journey={journey} index={index + 1} maxDepth={maxDepth} />
    </div>
  );
}

/** NRZ-L signal: the first up-to-32 bits as a square wave. */
function Wire({ bytes }: { bytes: number[] }) {
  const bits: number[] = [];
  for (let i = 0; i < bytes.length && bits.length < 32; i++) {
    for (let b = 7; b >= 0; b--) bits.push((bytes[i] >> b) & 1);
  }
  const unit = 18;
  const W = bits.length * unit;
  const H = 50;
  const hi = 12;
  const lo = 38;
  let d = '';
  let x = 0;
  for (let k = 0; k < bits.length; k++) {
    const y = bits[k] ? hi : lo;
    if (k === 0) d += `M${x} ${y}`;
    else {
      const py = bits[k - 1] ? hi : lo;
      if (py !== y) d += ` L${x} ${y}`;
    }
    d += ` L${x + unit} ${y}`;
    x += unit;
  }
  return (
    <div className="wire">
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="wire-svg">
        <line x1="0" y1={hi} x2={W} y2={hi} className="wire-grid" />
        <line x1="0" y1={lo} x2={W} y2={lo} className="wire-grid" />
        <path d={d} className="wire-path" fill="none" />
        {/* the signal, flowing: bright pulses of energy march left→right along the exact waveform */}
        <path d={d} className="wire-flow" fill="none" pathLength={100} />
        {bits.map((bit, i) => (
          <text key={i} x={i * unit + unit / 2} y={H - 3} className="wire-tick">{bit}</text>
        ))}
      </svg>
    </div>
  );
}
