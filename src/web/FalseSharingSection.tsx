// False sharing, made visible. Two threads increment two different counters. Toggle whether those counters sit
// on the SAME 64-byte cache line (packed) or on separate lines (padded), and watch the coherence traffic: when
// they share a line, every write bounces the line between the two cores (a ~100-cycle miss each time) even
// though the threads touch different variables. Pad them apart and the bouncing vanishes. Real model from
// falsesharing.ts.
import { useState } from 'react';
import { simulate, interleaved, bursty, LINE } from './falsesharing';

const N = 1000;

export function FalseSharingSection() {
  const [padded, setPadded] = useState(false);
  const [burstyMode, setBurstyMode] = useState(false);

  const layout = padded ? { offsetA: 0, offsetB: LINE } : { offsetA: 0, offsetB: 8 };
  const seq = burstyMode ? bursty(N, 50) : interleaved(N);
  const r = simulate(layout, seq);
  const contended = r.sameLine && r.transfers > 0;

  // byte cells for the cache-line diagram (show 2 lines of 8 "slots" = simplified 64B line)
  const SLOTS = 8;

  return (
    <div className="fsh">
      <p className="fsh-intro">
        Two threads, two <em>different</em> counters, on two CPU cores. Caches move memory in <strong>64-byte
        lines</strong>, not bytes — so if the two counters land on the <strong>same line</strong>, every write by
        one core must invalidate the other core's copy (MESI), and the line ping-pongs between them on every
        write. No shared data, yet it crawls. Toggle the layout:
      </p>

      <div className="fsh-controls">
        <div className="fsh-toggle">
          <button type="button" className={`fsh-tbtn ${!padded ? 'on bad' : ''}`} onClick={() => setPadded(false)}>packed (same line)</button>
          <button type="button" className={`fsh-tbtn ${padded ? 'on ok' : ''}`} onClick={() => setPadded(true)}>padded (separate lines)</button>
        </div>
        <div className="fsh-toggle">
          <button type="button" className={`fsh-tbtn ${!burstyMode ? 'on' : ''}`} onClick={() => setBurstyMode(false)}>lockstep writes</button>
          <button type="button" className={`fsh-tbtn ${burstyMode ? 'on' : ''}`} onClick={() => setBurstyMode(true)}>bursty writes</button>
        </div>
      </div>

      <div className="fsh-mem">
        <div className={`fsh-line ${!padded ? 'contended' : ''}`}>
          <span className="fsh-lname">cache line 0<br /><i>bytes 0–63</i></span>
          <div className="fsh-slots">
            {Array.from({ length: SLOTS }, (_, i) => (
              <div key={i} className={`fsh-slot ${i === 0 ? 'a' : (!padded && i === 1) ? 'b' : ''}`}>{i === 0 ? 'A' : (!padded && i === 1) ? 'B' : ''}</div>
            ))}
          </div>
        </div>
        <div className={`fsh-line ${padded ? 'owned' : ''}`}>
          <span className="fsh-lname">cache line 1<br /><i>bytes 64–127</i></span>
          <div className="fsh-slots">
            {Array.from({ length: SLOTS }, (_, i) => (
              <div key={i} className={`fsh-slot ${padded && i === 0 ? 'b' : ''}`}>{padded && i === 0 ? 'B' : ''}</div>
            ))}
          </div>
        </div>
      </div>

      <div className="fsh-verdict">
        {contended
          ? <span className="fsh-bad">⚠ Counters A and B share cache line 0. It bounces between the cores <b>{r.transfers.toLocaleString()}</b> times over {N.toLocaleString()} writes.</span>
          : padded
            ? <span className="fsh-ok">✓ Each counter has its own line. Every write is a local L1 hit — <b>0</b> coherence bounces.</span>
            : <span className="fsh-ok">✓ Same line, but bursty access means the line only changes owner {r.transfers} times — contention needs both sharing AND interleaving.</span>}
      </div>

      <div className="fsh-stats">
        <div className={`fsh-stat ${contended ? 'bad' : 'ok'}`}><span>slowdown vs ideal</span><b>{r.slowdown.toFixed(1)}×</b></div>
        <div className="fsh-stat"><span>cache-line bounces</span><b>{r.transfers.toLocaleString()}</b></div>
        <div className="fsh-stat"><span>cycles ({N.toLocaleString()} writes)</span><b>{r.cycles.toLocaleString()}</b></div>
        <div className="fsh-stat"><span>ideal (all L1 hits)</span><b>{r.idealCycles.toLocaleString()}</b></div>
      </div>

      <p className="fsh-foot">
        The tell-tale symptom is a program that gets <em>slower</em> as you add threads — the opposite of what
        parallelism promises — with CPUs pegged but no useful work, all of it burned on coherence traffic. It's
        insidious because the code looks perfectly correct: the threads share nothing logically. Classic
        instances: an array of per-thread counters (<code>counts[threadId]++</code>) packed tight; a lock and the
        data it protects on the same line; the head and tail indices of a queue. Fixes: <strong>pad</strong> each
        hot per-thread field to its own 64-byte line (Java's <code>@Contended</code>, C++'s
        <code> alignas(64)</code>, Rust's <code>CachePadded</code>), lay out read-mostly and write-heavy fields
        separately, or avoid the shared array entirely (thread-local accumulators combined at the end). The
        deeper point: on a multicore machine <strong>memory layout is a concurrency concern</strong> — where two
        variables sit relative to a 64-byte boundary can swing throughput by 10× or more. (See also the MESI
        section, which is the protocol doing the invalidating here.)
      </p>
    </div>
  );
}
