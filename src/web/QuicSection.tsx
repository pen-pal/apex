// QUIC vs TCP+TLS — why HTTP/3 moved off TCP. Two wins, both made visible:
// (1) round trips to first byte — TCP+TLS spends 2 RTTs of setup, QUIC 1 (or 0 on
// resumption); (2) transport head-of-line blocking — one lost packet stalls every
// TCP stream, but only the affected QUIC stream. Models are real (see quic.ts).
import { useEffect, useState } from 'react';
import { allScenarios, headOfLine } from './quic';

export function QuicSection() {
  const scenarios = allScenarios();
  const maxLen = Math.max(...scenarios.map((s) => s.messages.length));
  const [step, setStep] = useState(maxLen);
  const [playing, setPlaying] = useState(false);
  const [dropped, setDropped] = useState(false);

  useEffect(() => {
    if (!playing) return;
    if (step >= maxLen) { setPlaying(false); return; }
    const id = setTimeout(() => setStep((s) => Math.min(s + 1, maxLen)), 850);
    return () => clearTimeout(id);
  }, [playing, step, maxLen]);

  const tcpHol = headOfLine('TCP', [1, 2, 3, 4], 2);
  const quicHol = headOfLine('QUIC', [1, 2, 3, 4], 2);

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>QUIC vs TCP + TLS — fewer round trips, no transport blocking</h2></div>
        <p className="jsec-sub">
          Before any data, TCP+TLS does two handshakes back to back: one RTT to open TCP, another for TLS. QUIC folds
          them into one — and on a resumed session sends the request in the <em>first</em> packet (0-RTT). Step through
          all three and watch when the first byte of real data goes out.
        </p>

        <div className="quic-play">
          <button className="ghost small" onClick={() => { setStep(0); setPlaying(false); }}>⏮</button>
          <button className="ghost small" onClick={() => { if (step >= maxLen) setStep(0); setPlaying((p) => !p); }}>{playing ? '⏸' : '▶ animate'}</button>
          <button className="ghost small" onClick={() => { setStep(maxLen); setPlaying(false); }}>show all</button>
        </div>

        <div className="quic-grid">
          {scenarios.map((sc) => {
            const shown = sc.messages.slice(0, step);
            const dataSent = shown.some((m) => m.appData);
            return (
              <div className="quic-card" key={sc.id}>
                <div className="quic-card-head">
                  <strong>{sc.name}</strong>
                  <span className={`quic-rtt ${dataSent ? 'on' : ''}`}>{sc.rttToFirstData} RTT to data</span>
                </div>
                <div className="quic-cols"><span>client</span><span>server</span></div>
                <div className="quic-flow">
                  {shown.map((m, i) => (
                    <div key={i} className={`quic-msg ${m.from} ${m.appData ? 'data' : ''}`} title={m.note}>
                      <span className="quic-rttn">RTT {m.rtt}</span>
                      <span className="quic-arrow">{m.from === 'client' ? '──▶' : '◀──'}</span>
                      <span className="quic-lbl">{m.label}</span>
                    </div>
                  ))}
                </div>
                {dataSent && <div className="quic-done">✓ first application data sent</div>}
              </div>
            );
          })}
        </div>

        <div className="quic-hol">
          <div className="quic-hol-head">
            <h3>Transport head-of-line blocking — one lost packet</h3>
            <button className="ghost small" onClick={() => setDropped(!dropped)}>{dropped ? '↺ restore' : '✕ drop a packet on stream 2'}</button>
          </div>
          <p className="jsec-sub">Four streams are multiplexed over one connection and a single packet (carrying stream 2) is lost.
            HTTP/2-over-TCP is one ordered byte stream, so everything behind the gap waits. QUIC delivers streams independently.</p>
          <div className="quic-hol-grid">
            {[{ p: 'TCP', r: tcpHol }, { p: 'QUIC', r: quicHol }].map(({ p, r }) => (
              <div className="quic-hol-card" key={p}>
                <div className="quic-hol-title">{p === 'TCP' ? 'TCP (HTTP/2)' : 'QUIC (HTTP/3)'}</div>
                <div className="quic-streams">
                  {[1, 2, 3, 4].map((s) => {
                    const stalled = dropped && r.stalledStreams.includes(s);
                    const lost = dropped && s === r.lostStream;
                    return (
                      <div key={s} className={`quic-stream ${stalled ? 'stalled' : 'flowing'} ${lost ? 'lost' : ''}`}>
                        stream {s} {lost ? '✕ lost' : stalled ? '⏸ stalled' : '▶ flowing'}
                      </div>
                    );
                  })}
                </div>
                {dropped && <div className="quic-hol-note">{r.note}</div>}
              </div>
            ))}
          </div>
        </div>
        <p className="enc-note">QUIC also survives a network change (Wi-Fi → cellular) without reconnecting: a connection is identified by a
          Connection ID, not the 4-tuple of IPs and ports, so it keeps going when your address changes.</p>
      </section>
    </div>
  );
}
