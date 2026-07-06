// The TCP handshake & teardown, made visible. A live sequence diagram: each segment is
// an arrow between the client and server lifelines, labelled with its flags and exact
// seq/ack numbers; a step slider walks the exchange and lights up where each side sits
// in the TCP state machine. Edit either ISN and every number recomputes. Real logic in
// tcphandshake.ts (tested against RFC 9293).
import { useMemo, useState } from 'react';
import { handshake, statePath, type Segment } from './tcphandshake';

const ROW = 52, TOP = 30, LX = 70, RX = 330;

function flagStr(f: Segment['flags']) { return f.join(','); }

export function TcpHandshakeSection() {
  const [c, setC] = useState(1000);
  const [s, setS] = useState(5000);
  const segs = useMemo(() => handshake(c, s), [c, s]);
  const [step, setStep] = useState(3); // show the completed 3-way handshake first; rewind or advance from here

  const shownThrough = Math.min(step, segs.length);
  const cur = shownThrough > 0 ? segs[shownThrough - 1] : null;
  const cPath = statePath(segs, 'client');
  const sPath = statePath(segs, 'server');
  const height = TOP + segs.length * ROW + 20;

  // index into each side's state path that corresponds to the current step
  const stateNow = (side: 'client' | 'server') =>
    cur ? (side === 'client' ? cur.clientState : cur.serverState) : 'CLOSED';

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>TCP — open a connection, then close it</h2></div>
        <p className="jsec-sub">
          The network can lose, duplicate, or reorder the envelopes you send — raw packets alone are unreliable. <strong>TCP</strong>
          builds a <strong>reliable, in-order stream</strong> on top, like a phone call where both sides keep confirming they were
          heard. Before any data flows, the two machines <strong>shake hands</strong> to sync up: the client sends <code>SYN</code>
          (“let’s talk — I’ll number my bytes from X”), the server replies <code>SYN-ACK</code> (“okay, mine start at Y, and I got
          your X”), and the client sends <code>ACK</code> (“got your Y”). Now each side knows the other’s starting <strong>sequence
          number</strong> — the counter that numbers every byte so a lost or reordered one can be caught and resent — and that both
          directions work. Because <code>SYN</code> and <code>FIN</code> each count as one byte, every <code>ACK</code> is exactly
          “their number + 1.” Step through it and watch both state machines move.
        </p>

        <div className="tcph-isn">
          <label>client ISN <input type="number" value={c} onChange={(e) => setC(+e.target.value || 0)} /></label>
          <label>server ISN <input type="number" value={s} onChange={(e) => setS(+e.target.value || 0)} /></label>
        </div>

        <div className="tcph-grid">
          <div className="tcph-diagram">
            <svg viewBox={`0 0 400 ${height}`} width="100%" style={{ maxWidth: 440 }}>
              <text x={LX} y={16} className="tcph-actor" textAnchor="middle">client</text>
              <text x={RX} y={16} className="tcph-actor" textAnchor="middle">server</text>
              <line x1={LX} y1={TOP} x2={LX} y2={height - 10} className="tcph-life" />
              <line x1={RX} y1={TOP} x2={RX} y2={height - 10} className="tcph-life" />
              {segs.slice(0, shownThrough).map((seg, i) => {
                const y = TOP + 28 + i * ROW;
                const ltr = seg.dir === 'c2s';
                const x1 = ltr ? LX : RX, x2 = ltr ? RX : LX;
                const isCur = i === shownThrough - 1;
                return (
                  <g key={i} className={isCur ? 'tcph-cur' : ''}>
                    <line x1={x1} y1={y} x2={x2} y2={y} className={`tcph-arrow ${isCur ? 'on' : ''}`} markerEnd={`url(#tcph-${ltr ? 'r' : 'l'})`} />
                    <text x={(x1 + x2) / 2} y={y - 7} className="tcph-flags" textAnchor="middle">[{flagStr(seg.flags)}]</text>
                    <text x={(x1 + x2) / 2} y={y + 13} className="tcph-seq" textAnchor="middle">
                      seq={seg.seq}{seg.ack !== undefined ? ` ack=${seg.ack}` : ''}
                    </text>
                  </g>
                );
              })}
              <defs>
                <marker id="tcph-r" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6 Z" className="tcph-head" /></marker>
                <marker id="tcph-l" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6 Z" className="tcph-head" /></marker>
              </defs>
            </svg>
          </div>

          <div className="tcph-states">
            {(['client', 'server'] as const).map((side) => {
              const path = side === 'client' ? cPath : sPath;
              const now = stateNow(side);
              return (
                <div key={side} className="tcph-fsm">
                  <h4>{side}</h4>
                  <div className="tcph-track">
                    {path.map((st, i) => (
                      <span key={i} className={`tcph-state ${st === now ? 'active' : ''}`}>{st}</span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="tcph-controls">
          <button onClick={() => setStep(0)} disabled={shownThrough === 0}>⏮</button>
          <button onClick={() => setStep(Math.max(0, shownThrough - 1))} disabled={shownThrough === 0}>◀</button>
          <span className="tcph-count">step {shownThrough} / {segs.length}</span>
          <button onClick={() => setStep(shownThrough + 1)} disabled={shownThrough >= segs.length}>▶</button>
          <button onClick={() => setStep(segs.length)} disabled={shownThrough >= segs.length}>⏭</button>
        </div>

        {cur && <div className="tcph-note">{cur.note}</div>}

        <p className="tcph-foot">
          Why a <em>three</em>-way handshake? Both sides must prove they can send <em>and</em> receive, and exchange ISNs, before any
          data flows — two messages can’t do that safely. <strong>TIME_WAIT</strong> on the active closer lingers for 2×MSL so a delayed
          duplicate segment can’t be mistaken for part of a brand-new connection on the same ports. SYN floods exploit the half-open
          SYN_RCVD state; SYN cookies defend it.
        </p>
      </section>
    </div>
  );
}
