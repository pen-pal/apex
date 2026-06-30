// Leaky bucket, made visible. The top row is the bursty arrival stream; the bottom row is the output —
// and no matter how spiky the input, the output never rises above the leak rate. Drag the capacity and
// leak rate, edit the arrivals, and watch the bucket absorb bursts (the level line) and drop whatever
// overflows. The contrast with a token bucket (which would let a saved-up burst through) is the point.
// Real simulation from leakybucket.ts.
import { useMemo, useState } from 'react';
import { leakyBucket, totalDropped, totalOutput, peakOutput } from './leakybucket';

export function LeakyBucketSection() {
  const [arrStr, setArrStr] = useState('5,0,0,6,0,1,8,0,0,2');
  const [capacity, setCapacity] = useState(5);
  const [leakRate, setLeakRate] = useState(2);

  const arrivals = useMemo(() => arrStr.split(',').map((s) => Math.max(0, Math.min(12, parseInt(s.trim(), 10) || 0))).slice(0, 16), [arrStr]);
  const ticks = useMemo(() => leakyBucket(arrivals, capacity, leakRate), [arrivals, capacity, leakRate]);
  const maxArr = Math.max(1, ...arrivals, capacity);

  return (
    <div className="leak">
      <div className="leak-controls">
        <label>arrivals <input value={arrStr} spellCheck={false} onChange={(e) => setArrStr(e.target.value)} /></label>
        <label>capacity <input type="range" min={2} max={10} value={capacity} onChange={(e) => setCapacity(+e.target.value)} /><b>{capacity}</b></label>
        <label>leak rate <input type="range" min={1} max={6} value={leakRate} onChange={(e) => setLeakRate(+e.target.value)} /><b>{leakRate}/tick</b></label>
      </div>

      <div className="leak-chart">
        <div className="leak-row">
          <span className="leak-rlabel">in</span>
          <div className="leak-bars">
            {ticks.map((t, i) => (
              <div key={i} className="leak-col">
                {t.dropped > 0 && <div className="leak-bar drop" style={{ height: `${(t.dropped / maxArr) * 100}%` }} title={`${t.dropped} dropped`} />}
                <div className="leak-bar in" style={{ height: `${(t.admitted / maxArr) * 100}%` }} title={`${t.arrived} arrived`} />
              </div>
            ))}
          </div>
        </div>

        <div className="leak-bucketline">
          <span className="leak-rlabel">level</span>
          <div className="leak-bars">
            {ticks.map((t, i) => <div key={i} className="leak-col"><div className="leak-level" style={{ height: `${(t.level / capacity) * 100}%` }} title={`level ${t.level}/${capacity}`} /></div>)}
          </div>
          <span className="leak-cap">cap {capacity}</span>
        </div>

        <div className="leak-row out">
          <span className="leak-rlabel">out</span>
          <div className="leak-bars">
            {ticks.map((t, i) => (
              <div key={i} className="leak-col"><div className="leak-bar outb" style={{ height: `${(t.output / maxArr) * 100}%` }} title={`output ${t.output}`} /></div>
            ))}
            <div className="leak-rateline" style={{ bottom: `${(leakRate / maxArr) * 100}%` }} title={`leak rate ${leakRate}`} />
          </div>
        </div>
        <div className="leak-ticks">{ticks.map((_, i) => <span key={i} className="leak-tick">{i}</span>)}</div>
      </div>

      <div className="leak-stats">
        <div className="leak-stat"><span>arrived</span><b>{arrivals.reduce((a, x) => a + x, 0)}</b></div>
        <div className="leak-stat"><span>output</span><b>{totalOutput(ticks)}</b></div>
        <div className="leak-stat hot"><span>dropped</span><b>{totalDropped(ticks)}</b></div>
        <div className="leak-stat"><span>peak output</span><b>{peakOutput(ticks)} <i>≤ {leakRate}</i></b></div>
      </div>

      <p className="leak-foot">
        However spiky the input, the output is a flat line at (or below) the <strong>leak rate</strong> — that’s the whole job of a shaper:
        guarantee a downstream link sees an even flow. The bucket’s <strong>capacity</strong> is its burst tolerance: bigger absorbs more before
        it overflows and starts <em>dropping</em>. Compare the <strong>token bucket</strong> (the rate-limit section): it accumulates unused
        allowance, so after a quiet spell it lets a burst through up to the bucket size — great for average-rate limits that tolerate bursts. Leaky
        bucket trades that flexibility for a hard ceiling on the instantaneous rate. Routers often combine them (policing vs shaping) on the same flow.
      </p>
    </div>
  );
}
