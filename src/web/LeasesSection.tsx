// Leases, made visible. The granter hands node A a lease for D seconds, then waits a GUARD interval before
// re-granting to node B. But A's clock runs slow, so A keeps acting as leader past the granter's expiry.
// Drag the clock skew, network delay, and guard interval and watch the red SPLIT-BRAIN window — where both A
// and B think they hold the lease — open and close. It closes exactly when the guard covers skew + delay.
// Real model from leases.ts.
import { useState } from 'react';
import { analyze, minSafeGuard } from './leases';

function Slider({ label, value, set, min, max, unit }: { label: string; value: number; set: (n: number) => void; min: number; max: number; unit: string }) {
  return (
    <label className="lse-slider">
      <span>{label}<b>{value}{unit}</b></span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => set(+e.target.value)} />
    </label>
  );
}

export function LeasesSection() {
  const [duration, setDuration] = useState(10);
  const [clockSkew, setClockSkew] = useState(3);
  const [netDelay, setNetDelay] = useState(1);
  const [guardInterval, setGuardInterval] = useState(0);

  const r = analyze({ duration, clockSkew, netDelay, guardInterval });
  const need = minSafeGuard({ clockSkew, netDelay });
  const total = Math.max(r.holderBelievesUntil, r.newGrantAt) + 3;
  const pct = (x: number) => `${(x / total) * 100}%`;

  return (
    <div className="lse">
      <p className="lse-intro">
        A lease is a lock that <strong>expires on its own</strong>, so a crashed holder can't freeze the system.
        The granter gives node A the lease for D, then waits a <strong>guard interval</strong> before handing it
        to node B. The danger: if A's clock runs slow (or the grant was delayed), A keeps acting as leader
        <strong> past</strong> the granter's expiry — and if B has already started, you have <strong>two
        leaders</strong>. Drag the knobs:
      </p>

      <div className="lse-sliders">
        <Slider label="lease duration D " value={duration} set={setDuration} min={4} max={20} unit="s" />
        <Slider label="holder clock skew " value={clockSkew} set={setClockSkew} min={0} max={8} unit="s" />
        <Slider label="network delay " value={netDelay} set={setNetDelay} min={0} max={5} unit="s" />
        <Slider label="guard interval " value={guardInterval} set={setGuardInterval} min={0} max={12} unit="s" />
      </div>

      <div className="lse-timeline">
        <div className="lse-lane">
          <span className="lse-lname">granter</span>
          <div className="lse-track">
            <div className="lse-bar granter" style={{ left: 0, width: pct(duration) }}>A's lease (D={duration})</div>
            <div className="lse-tick" style={{ left: pct(r.granterExpiry) }}><i />expiry</div>
          </div>
        </div>
        <div className="lse-lane">
          <span className="lse-lname">node A</span>
          <div className="lse-track">
            <div className="lse-bar holder" style={{ left: 0, width: pct(duration) }} />
            {(clockSkew + netDelay) > 0 && <div className="lse-bar overhold" style={{ left: pct(duration), width: pct(clockSkew + netDelay) }}>over-holds +{clockSkew + netDelay}s</div>}
          </div>
        </div>
        <div className="lse-lane">
          <span className="lse-lname">node B</span>
          <div className="lse-track">
            <div className="lse-bar newholder" style={{ left: pct(r.newGrantAt), width: pct(total - r.newGrantAt) }}>B's lease (after guard {guardInterval}s)</div>
          </div>
        </div>
        {r.overlap > 0 && (
          <div className="lse-overlap" style={{ left: pct(r.newGrantAt), width: pct(r.overlap) }} title="both act as leader">
            <span>⚠ split brain {r.overlap}s</span>
          </div>
        )}
      </div>

      <div className={`lse-verdict ${r.safe ? 'good' : 'bad'}`}>
        {r.safe
          ? `✓ SAFE — the guard (${guardInterval}s) covers the ${need}s of skew + delay, so A has provably stopped before B starts.`
          : `⚠ UNSAFE — A still believes it's leader for ${r.overlap}s after B starts. Set the guard interval to at least ${need}s (skew + delay).`}
      </div>

      <p className="lse-foot">
        Lease safety doesn't depend on the lease <em>length</em> — it depends on the granter
        waiting out the <strong>maximum possible clock skew (plus message delay)</strong> before re-granting, so
        the previous holder has definitely self-expired. Real systems do this two ways: the granter adds a guard
        (etcd/Chubby leader leases hand out a lease shorter than they'll wait to reassign), or the holder
        <strong> self-expires early</strong> by treating its lease as valid only until <code>grant_time +
        D − max_skew</code>. Either way you need a <em>bound</em> on skew — which is why leases assume roughly
        synchronized clocks, and why systems that can't assume that fall back to <strong>fencing tokens</strong>
        (a monotonic number that lets the resource reject a stale leader's writes even if a lease overlaps). A
        lease keeps you live; a fencing token keeps you correct. (Gray &amp; Cheriton, 1989.)
      </p>
    </div>
  );
}
