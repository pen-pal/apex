// Animated Internet-checksum walkthrough (RFC 1071). Renders the real one's-
// complement sum over the live IP header, word by word, then folds the carry
// and complements — proving the stored checksum is genuine. All numbers come
// from checksumWalk(); this component only animates and formats them.
import { useEffect, useRef, useState } from 'react';
import { checksumWalk, type CkTarget } from './checksumWalk';

const h16 = (v: number) => '0x' + (v & 0xffff).toString(16).toUpperCase().padStart(4, '0');
const h32 = (v: number) => '0x' + (v >>> 0).toString(16).toUpperCase().padStart(8, '0');
const b2 = (v: number) => v.toString(16).toUpperCase().padStart(2, '0');

export function ChecksumView({ target }: { target: CkTarget | null }) {
  if (!target) {
    return (
      <div className="journey">
        <section className="jsec">
          <h2>Header checksum</h2>
          <p className="jsec-sub">
            This capture has no IPv4-style header-only checksum to walk. UDP, TCP, ICMP and friends
            checksum a pseudo-header or the whole message rather than a fixed header, so only IPv4's
            header checksum is shown step by step here. Select the default text frame (or an example
            that includes IPv4) to see it.
          </p>
        </section>
      </div>
    );
  }
  const walk = checksumWalk(target);
  const N = walk.steps.length;
  const [revealed, setRevealed] = useState(N); // default: fully shown; Play re-animates
  const timer = useRef<number | null>(null);

  const stop = () => {
    if (timer.current != null) {
      clearInterval(timer.current);
      timer.current = null;
    }
  };
  useEffect(() => stop, []);
  // Reset the animation if the underlying header changes.
  useEffect(() => { setRevealed(N); }, [N, walk.stored]);

  const play = () => {
    stop();
    setRevealed(0);
    timer.current = window.setInterval(() => {
      setRevealed((r) => {
        if (r >= N) { stop(); return r; }
        return r + 1;
      });
    }, 450);
  };

  const done = revealed >= N;
  const runningAt = revealed > 0 ? walk.steps[Math.min(revealed, N) - 1].running : 0;

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head">
          <h2>{walk.layerName} header checksum — RFC 1071</h2>
          <div className="play-group">
            <button className="play" onClick={play}>▶ Play</button>
            <button className="ghost" onClick={() => { stop(); setRevealed(N); }}>Show all</button>
          </div>
        </div>
        <p className="jsec-sub">
          The Internet checksum is a one's-complement sum of every 16-bit word in the header (with the
          checksum field itself taken as zero). Add the words, fold the carry back in, then invert.
        </p>

        <div className="ck-words">
          {walk.steps.map((s) => {
            const shown = s.index < revealed;
            return (
              <div key={s.index} className={`ck-word ${shown ? 'in' : 'out'} ${s.isChecksumField ? 'cksum' : ''}`}>
                <span className="ck-i">w{s.index}</span>
                <code className="ck-hex">{b2(s.hi)} {b2(s.lo)}</code>
                <span className="ck-eq">=</span>
                <code className="ck-val">{h16(s.word)}</code>
                {s.isChecksumField && <span className="ck-tag">checksum field → 0</span>}
                <span className="ck-run">Σ {h32(s.running)}</span>
              </div>
            );
          })}
        </div>

        <div className={`ck-final ${done ? 'in' : 'out'}`}>
          <div className="ck-line"><span>Sum of words</span><code>{h32(walk.rawSum)}</code></div>
          <div className="ck-line"><span>Fold carry into 16 bits</span><code>{h16(walk.folded)}</code></div>
          <div className="ck-line"><span>One's complement (~)</span><code className="ck-result">{h16(walk.result)}</code></div>
          <div className={`ck-verdict ${walk.ok ? 'ok' : 'bad'}`}>
            {walk.ok
              ? `✓ equals the checksum stored in the header (${h16(walk.stored)}) — the bytes are real`
              : `✗ does not match stored ${h16(walk.stored)}`}
          </div>
        </div>
        {!done && <p className="ck-progress">running sum: <code>{h32(runningAt)}</code> · {revealed}/{N} words</p>}
      </section>
    </div>
  );
}
