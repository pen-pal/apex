// TCP Fast Open, made visible. Compare a normal handshake against TFO's first visit (which fetches a
// cookie) and a repeat visit (which puts the request right in the SYN and answers in one RTT instead of
// two) — plus the fallback when a cookie is stale. Drag the RTT to see the saved round trip. From tfo.ts.
import { useMemo, useState } from 'react';
import { normal, firstTfo, repeatTfo, type Conn } from './tfo';

const SCN: { id: string; label: string; make: (rtt: number) => Conn }[] = [
  { id: 'normal', label: 'normal TCP', make: normal },
  { id: 'first', label: 'TFO — first visit', make: firstTfo },
  { id: 'repeat', label: 'TFO — repeat (valid cookie)', make: (r) => repeatTfo(r, true) },
  { id: 'bad', label: 'TFO — stale cookie', make: (r) => repeatTfo(r, false) },
];

export function TfoSection() {
  const [scn, setScn] = useState('repeat');
  const [rtt, setRtt] = useState(100);
  const conn = useMemo(() => SCN.find((s) => s.id === scn)!.make(rtt), [scn, rtt]);
  const baseline = normal(rtt).responseMs;

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>TCP Fast Open — sending data in the SYN</h2></div>
        <p className="jsec-sub">
          Normal TCP makes you finish the SYN/SYN-ACK/ACK handshake before sending a single byte, so a short request wastes a whole round trip
          on setup. <strong>TFO</strong> lets a returning client put its request <em>in the SYN</em> and get an answer one RTT sooner. The catch
          — a SYN’s address is unverified — is solved with a <strong>cookie</strong>: earned on the first visit, spent on later ones.
        </p>

        <div className="tfo-scns">{SCN.map((s) => <button key={s.id} className={`tfo-scn ${scn === s.id ? 'on' : ''}`} onClick={() => setScn(s.id)}>{s.label}</button>)}</div>
        <label className="tfo-slider">round-trip time <input type="range" min={20} max={300} step={10} value={rtt} onChange={(e) => setRtt(+e.target.value)} /><b>{rtt} ms</b></label>

        <div className="tfo-diagram">
          <div className="tfo-lane-labels"><span>client</span><span>server</span></div>
          <div className="tfo-steps">
            {conn.steps.map((s, i) => (
              <div key={i} className={`tfo-step ${s.from} ${s.carriesData ? 'data' : ''}`}>
                <span className="tfo-arrow">{s.from === 'client' ? '→' : '←'}</span>
                <span className="tfo-label">{s.label}{s.carriesData && <i className="tfo-databadge">DATA</i>}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={`tfo-result ${conn.savedMs > 0 ? 'fast' : ''}`}>
          <div className="tfo-stat"><span className="tfo-num">{conn.responseMs} ms</span><span>to first response byte</span></div>
          <div className="tfo-stat"><span className={`tfo-num ${conn.savedMs > 0 ? 'grn' : ''}`}>{conn.savedMs} ms</span><span>saved vs normal ({baseline} ms)</span></div>
          <div className="tfo-mode">{conn.mode}</div>
        </div>

        <p className="tfo-foot">
          The saving is one RTT per connection — small in isolation, big at scale for latency-sensitive, short-lived requests (the web’s bread
          and butter). The cookie is the whole security story: it proves return-routability (you received it at your address last time), so TFO
          can’t be turned into a reflection/amplification attack the way naive SYN-data would. In practice TFO saw limited deployment — middleboxes
          that choke on data-bearing SYNs, and the rise of <strong>QUIC</strong>, whose 0-RTT resumption delivers the same “data in the first
          packet” win at the transport layer without TCP’s baggage. Same idea, cleaner home.
        </p>
      </section>
    </div>
  );
}
