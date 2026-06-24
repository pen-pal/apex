// TCP SACK, made visible. A row of segments; click any to mark it lost on the wire. The
// receiver's cumulative ACK gets stuck at the first hole, while SACK blocks report the
// ranges that did arrive above it. Two retransmit strategies are compared side by side:
// SACK resends only the holes, go-back-N resends everything after the gap. Real logic in
// sack.ts (tested on a worked loss pattern).
import { useMemo, useState } from 'react';
import { analyze } from './sack';

const N = 9;

export function SackSection() {
  const [lost, setLost] = useState<Set<number>>(new Set([3, 6]));
  const received = useMemo(() => Array.from({ length: N }, (_, i) => !lost.has(i + 1)), [lost]);
  const a = useMemo(() => analyze(received), [received]);

  const toggle = (seg: number) => setLost((s) => { const n = new Set(s); n.has(seg) ? n.delete(seg) : n.add(seg); return n; });
  const inSack = (seg: number) => a.sackBlocks.some(([s, e]) => seg >= s && seg <= e);

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Selective ACK — retransmit only what was lost</h2></div>
        <p className="jsec-sub">
          A cumulative ACK can only say “I have everything up to here.” So when one segment is lost but later ones arrive, the sender
          is blind to what got through. <strong>SACK</strong> adds blocks naming the exact ranges received beyond the gap, so the sender
          resends only the holes instead of everything after them. Click a segment to drop it on the wire:
        </p>

        <div className="sack-track">
          {Array.from({ length: N }, (_, i) => i + 1).map((seg) => {
            const isLost = lost.has(seg);
            const acked = seg <= a.cumulativeAck;
            const sacked = inSack(seg);
            return (
              <button key={seg} className={`sack-seg ${isLost ? 'lost' : acked ? 'acked' : sacked ? 'sacked' : 'plain'}`} onClick={() => toggle(seg)}>
                <span className="sack-num">{seg}</span>
                <span className="sack-state">{isLost ? '✗ lost' : acked ? 'ACKed' : sacked ? 'SACK' : '·'}</span>
              </button>
            );
          })}
        </div>
        <p className="sack-hint">green = covered by the cumulative ACK · blue = arrived, reported by a SACK block · red = lost · click to toggle</p>

        <div className="sack-info">
          <div className="sack-line"><b>Cumulative ACK:</b> got everything through segment <code>{a.cumulativeAck}</code></div>
          <div className="sack-line"><b>SACK blocks:</b> {a.sackBlocks.length ? a.sackBlocks.map(([s, e]) => `${s}–${e}`).join(', ') : '— (no out-of-order data)'}</div>
        </div>

        <div className="sack-compare">
          <div className="sack-card good">
            <h3>✅ with SACK</h3>
            <div className="sack-resend">resends: {a.retransmitWithSack.length ? a.retransmitWithSack.map((s) => <em key={s}>{s}</em>) : <span className="sack-none">nothing</span>}</div>
            <div className="sack-count">{a.retransmitWithSack.length} segment{a.retransmitWithSack.length === 1 ? '' : 's'}</div>
          </div>
          <div className="sack-card bad">
            <h3>❌ go-back-N (no SACK)</h3>
            <div className="sack-resend">resends: {a.retransmitGoBackN.length ? a.retransmitGoBackN.map((s) => <em key={s} className={lost.has(s) ? '' : 'waste'}>{s}</em>) : <span className="sack-none">nothing</span>}</div>
            <div className="sack-count">{a.retransmitGoBackN.length} segment{a.retransmitGoBackN.length === 1 ? '' : 's'} {a.saved > 0 && <span className="sack-waste-tag">· {a.saved} wasted</span>}</div>
          </div>
        </div>

        <p className="sack-foot">
          The faded numbers on the right are segments that <em>already arrived</em> but get resent anyway because the sender couldn’t
          tell. On long fat networks (high bandwidth × delay) that waste is huge, which is why SACK is on by default everywhere.
          SACK only informs the sender — the receiver still can’t deliver data past a hole until it’s filled (head-of-line blocking), the
          problem QUIC sidesteps with independent streams.
        </p>
      </section>
    </div>
  );
}
