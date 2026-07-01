// TIME_WAIT & ephemeral-port exhaustion, made visible. Drag the connection rate, TIME_WAIT duration, and
// ephemeral-port pool, and watch the port-usage bar fill up — and overflow red when a client opening too many
// short-lived connections runs out of local ports. Then click a fix (shorten TIME_WAIT, widen the range, or —
// the real answer — pool connections) and watch the pressure drop. Real model from timewait.ts.
import { useState } from 'react';
import { analyze } from './timewait';

const fmt = (n: number) => Math.round(n).toLocaleString();

function Slider({ label, value, set, min, max, step, unit }: { label: string; value: number; set: (n: number) => void; min: number; max: number; step: number; unit: string }) {
  return (
    <label className="twt-slider">
      <span>{label}<b>{fmt(value)}{unit}</b></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => set(+e.target.value)} />
    </label>
  );
}

export function TimeWaitSection() {
  const [connRate, setConnRate] = useState(1000);
  const [timeWaitSec, setTimeWaitSec] = useState(60);
  const [portPool, setPortPool] = useState(28232);

  const r = analyze({ connRate, timeWaitSec, portPool });
  const fillPct = Math.min(100, r.utilizationPct);

  return (
    <div className="twt">
      <p className="twt-intro">
        When you <strong>close</strong> a TCP connection, the side that closed first parks it in
        <strong> TIME_WAIT</strong> for 2×MSL (~60s on Linux) — so a stray old segment can't corrupt a new
        connection reusing the same 4-tuple, and so it can re-ACK a lost final FIN. But each outbound connection
        also pins one <strong>ephemeral port</strong> for that whole time. By Little's law, ports held ≈
        <strong> rate × TIME_WAIT</strong> — so enough short-lived connections exhaust the ~28k-port pool and new
        connects fail with <code>EADDRNOTAVAIL</code>. Drag the knobs:
      </p>

      <div className="twt-sliders">
        <Slider label="connect rate " value={connRate} set={setConnRate} min={50} max={3000} step={50} unit="/s" />
        <Slider label="TIME_WAIT " value={timeWaitSec} set={setTimeWaitSec} min={1} max={120} step={1} unit="s" />
        <Slider label="ephemeral pool " value={portPool} set={setPortPool} min={5000} max={65000} step={1000} unit=" ports" />
      </div>

      <div className="twt-pool">
        <div className="twt-pool-h">
          <span>ephemeral ports in TIME_WAIT</span>
          <span className={`twt-count ${r.exhausted ? 'bad' : 'ok'}`}>{fmt(r.portsHeld)} / {fmt(portPool)}</span>
        </div>
        <div className="twt-bar">
          <div className={`twt-fill ${r.exhausted ? 'bad' : r.utilizationPct > 80 ? 'warn' : 'ok'}`} style={{ width: `${fillPct}%` }} />
          {r.exhausted && <div className="twt-over">overflow +{fmt(r.portsHeld - portPool)}</div>}
        </div>
        <div className="twt-util">{r.utilizationPct.toFixed(0)}% utilization · max sustainable ≈ <b>{fmt(r.maxRate)}/s</b></div>
      </div>

      <div className={`twt-verdict ${r.exhausted ? 'bad' : 'ok'}`}>
        {r.exhausted
          ? `⚠ PORT EXHAUSTION — ${fmt(r.portsHeld)} ports needed but only ${fmt(portPool)} exist. New connects fail (EADDRNOTAVAIL) above ~${fmt(r.maxRate)}/s.`
          : `✓ healthy — ${r.utilizationPct.toFixed(0)}% of the pool in use; headroom up to ~${fmt(r.maxRate)}/s.`}
      </div>

      <div className="twt-fixes">
        <span className="twt-fixes-h">fixes:</span>
        <button type="button" className="twt-fix" onClick={() => setTimeWaitSec(15)}>shorten TIME_WAIT (tw_reuse)</button>
        <button type="button" className="twt-fix" onClick={() => setPortPool(65000)}>widen port range</button>
        <button type="button" className="twt-fix strong" onClick={() => setConnRate(50)}>pool connections ✓</button>
      </div>

      <p className="twt-foot">
        Note the fixes are not equal. Shrinking TIME_WAIT (<code>net.ipv4.tcp_tw_reuse</code>) and widening
        <code> ip_local_port_range</code> buy headroom but fight the OS's safety timers — <code>tcp_tw_reuse</code>
        is only safe for <em>outbound</em> connections and relies on timestamps to reject old segments. The real
        fix is to <strong>stop opening so many connections</strong>: keep-alive and <strong>connection
        pooling</strong> turn thousands of short connections into a handful of reused ones, so almost no ports
        ever enter TIME_WAIT. (This is also why a reverse proxy or service mesh in front of a backend matters —
        it pools upstream connections for everyone.) One more subtlety: only the <strong>active closer</strong>
        pays TIME_WAIT, so whether the client or server closes first decides <em>which</em> side accumulates it —
        a server that closes idle keep-alives can pile up its own TIME_WAITs instead. (RFC 793 / 1122.)
      </p>
    </div>
  );
}
