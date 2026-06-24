// Happy Eyeballs, made visible. Drag the IPv6 and IPv4 connection times (or fail one) and
// watch the race: IPv6 starts immediately, IPv4 launches after the attempt delay (or sooner
// if IPv6 errors), and whichever connects first wins — IPv6 preferred on a tie. The timeline
// shows why a broken IPv6 path no longer stalls you. Real logic in happyeyeballs.ts (tested).
import { useMemo, useState } from 'react';
import { race, type Endpoint } from './happyeyeballs';

const ATD = 250;
const SCALE = 0.7; // px per ms

export function HappyEyeballsSection() {
  const [v6, setV6] = useState(300);
  const [v6fail, setV6fail] = useState(false);
  const [v4, setV4] = useState(40);

  const ipv6: Endpoint = v6fail ? { connectMs: null, failMs: v6 } : { connectMs: v6, failMs: null };
  const ipv4: Endpoint = { connectMs: v4, failMs: null };
  const r = useMemo(() => race(ipv6, ipv4, ATD), [v6, v6fail, v4]);

  const maxMs = Math.max(600, (r.ipv6ConnectMs ?? v6) + 30, (r.ipv4ConnectMs ?? r.ipv4StartMs + v4) + 30);
  const x = (ms: number) => ms * SCALE * (560 / (maxMs * SCALE)); // fit to ~560px

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Happy Eyeballs — racing IPv4 and IPv6</h2></div>
        <p className="jsec-sub">
          A dual-stack client prefers IPv6 — but a broken IPv6 path used to mean waiting a full TCP timeout before trying IPv4. Happy
          Eyeballs races them: start IPv6 now, and if it hasn’t connected within the <strong>{ATD} ms</strong> Connection Attempt Delay,
          start IPv4 in parallel and take whichever wins (IPv6 on a tie). A dead IPv6 path costs a fraction of a second, not 30 seconds.
        </p>

        <div className="he-controls">
          <label>IPv6 {v6fail ? 'fails at' : 'connects at'} <input type="range" min={5} max={600} step={5} value={v6} onChange={(e) => setV6(+e.target.value)} /><b>{v6} ms</b></label>
          <label className="he-chk"><input type="checkbox" checked={v6fail} onChange={(e) => setV6fail(e.target.checked)} /> IPv6 path broken (connection refused)</label>
          <label>IPv4 connects at <input type="range" min={5} max={600} step={5} value={v4} onChange={(e) => setV4(+e.target.value)} /><b>{v4} ms</b></label>
        </div>

        <div className="he-track-wrap">
          <div className="he-axis"><span style={{ left: x(ATD) }} className="he-atd">attempt delay ({ATD}ms)</span></div>
          {/* IPv6 lane */}
          <div className="he-lane">
            <span className="he-llabel v6">IPv6</span>
            <div className="he-bar">
              <div className={`he-fill v6 ${v6fail ? 'fail' : ''}`} style={{ left: 0, width: x(v6) }} />
              <span className="he-dot v6" style={{ left: x(v6) }}>{v6fail ? '✗' : '✓'} {v6}ms</span>
            </div>
          </div>
          {/* IPv4 lane */}
          <div className="he-lane">
            <span className="he-llabel v4">IPv4</span>
            <div className="he-bar">
              <div className="he-fill v4" style={{ left: x(r.ipv4StartMs), width: x(v4) }} />
              <span className="he-dot v4" style={{ left: x(r.ipv4StartMs + v4) }}>✓ {r.ipv4StartMs + v4}ms</span>
              <span className="he-start" style={{ left: x(r.ipv4StartMs) }} title="IPv4 attempt launched" />
            </div>
          </div>
        </div>

        <div className={`he-verdict ${r.winner === 'IPv6' ? 'v6' : r.winner === 'IPv4' ? 'v4' : 'none'}`}>
          {r.winner
            ? <>🏁 Connected over <b>{r.winner}</b> in <b>{r.connectMs} ms</b>{r.winner === 'IPv4' && !v6fail ? ' — IPv6 was too slow, so the IPv4 fallback won' : r.winner === 'IPv4' ? ' — IPv6 failed, IPv4 took over immediately' : ' — IPv6 connected first, as preferred'}.</>
            : '✗ Both families failed — no connection.'}
        </div>

        <p className="he-foot">
          The win is bounded worst-case latency: instead of one TCP timeout per address, you pay at most the attempt delay before the
          other family is in the race. Full RFC 8305 also interleaves addresses returned by DNS (resolve AAAA and A in parallel, sort to
          alternate families) and applies the same staggered-start to multiple addresses of each family. Browsers and OSes ship it by
          default; it’s a big reason IPv6 deployment didn’t make the web feel slower.
        </p>
      </section>
    </div>
  );
}
