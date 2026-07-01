// Spectre, made visible. Memory holds a public array followed by a secret the code should never read. The
// gadget speculatively reads out of bounds and pulls one cache line of array2 in based on the secret byte;
// Flush+Reload then times all 256 lines and the fast one reveals the byte. Step through the leak and watch the
// secret appear one byte at a time, with the timing chart spiking on the leaked value. Flip on the lfence
// barrier and the speculative read never happens — the chart goes flat and nothing leaks. Real model from
// spectre.ts.
import { useMemo, useState } from 'react';
import { makeMemory, probe, HIT_CYCLES, MISS_CYCLES } from './spectre';

const PUBLIC = [10, 20, 30, 40, 50, 60, 70, 80];
const SECRET = 'hunter2!';
const chr = (b: number) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '·');

export function SpectreSection() {
  const [mitigated, setMitigated] = useState(false);
  const [leaked, setLeaked] = useState(0); // how many secret bytes recovered so far

  const mem = useMemo(() => makeMemory(PUBLIC, SECRET), []);
  const secretLen = SECRET.length;
  // the byte currently being probed (or the last one leaked)
  const curX = mem.array1Size + Math.min(leaked, secretLen - 1);
  const cur = probe(mem, curX, mitigated);

  const recovered: (number | null)[] = [];
  for (let i = 0; i < leaked; i++) recovered.push(probe(mem, mem.array1Size + i, mitigated).recovered);

  return (
    <div className="spx">
      <p className="spx-intro">
        The CPU runs ahead <strong>speculatively</strong>: at <code>if (x &lt; size)</code> it guesses the branch
        and executes the body before the check resolves. Train it to guess "in-bounds," then feed a malicious
        out-of-bounds <code>x</code> — it speculatively reads a <strong>secret</strong> byte and loads
        <code> array2[secret·256]</code> into cache. The speculation is rolled back, but the warm cache line
        leaks the byte via <strong>timing</strong>.
      </p>

      <pre className="spx-code">{`if (x < array1_size)           // mispredicted "true"
    y = array2[ array1[x] * 256 ];  // x out of bounds → reads secret`}{mitigated ? `
// + lfence  ← barrier: no speculative load` : ''}</pre>

      <div className="spx-mem">
        <div className="spx-memlbl">memory:</div>
        <div className="spx-cells">
          {mem.bytes.map((b, i) => {
            const isSecret = i >= mem.array1Size;
            const idx = i - mem.array1Size;
            const shown = !isSecret || idx < leaked;
            return (
              <div key={i} className={`spx-cell ${isSecret ? 'secret' : 'pub'} ${isSecret && idx < leaked ? 'leaked' : ''}`} title={isSecret ? `out of bounds (x=${i})` : `array1[${i}]`}>
                <span className="spx-cv">{isSecret ? (shown ? chr(b) : '?') : b}</span>
              </div>
            );
          })}
        </div>
        <div className="spx-memnote"><span className="spx-tag pub">array1 (public)</span><span className="spx-tag secret">secret (past the bounds)</span></div>
      </div>

      <div className="spx-controls">
        <button type="button" className={`spx-mit ${mitigated ? 'on' : ''}`} onClick={() => { setMitigated((m) => !m); setLeaked(0); }}>{mitigated ? '🛡 lfence ON' : 'lfence OFF'}</button>
        <button type="button" className="spx-btn" disabled={leaked >= secretLen} onClick={() => setLeaked((l) => l + 1)}>leak next byte →</button>
        <button type="button" className="spx-btn strong" disabled={leaked >= secretLen} onClick={() => setLeaked(secretLen)}>dump memory</button>
        <button type="button" className="spx-btn ghost" onClick={() => setLeaked(0)}>reset</button>
      </div>

      <div className="spx-fr">
        <div className="spx-frh">Flush+Reload — access time of each of the 256 array2 lines {leaked > 0 || !mitigated ? `(probing x=${curX})` : ''}</div>
        <div className="spx-bars">
          {cur.times.map((t, i) => (
            <div key={i} className={`spx-bar ${i === cur.recovered ? 'hit' : ''}`} style={{ height: `${(t / MISS_CYCLES) * 100}%` }} title={`line ${i}: ${t} cycles`} />
          ))}
        </div>
        <div className="spx-frlabel">
          {cur.recovered !== null
            ? <span className="spx-hitlabel">line <b>{cur.recovered}</b> = <b>'{chr(cur.recovered)}'</b> is a {HIT_CYCLES}-cycle HIT among {MISS_CYCLES}-cycle misses → that's the byte</span>
            : <span className="spx-flat">flat — the barrier stopped the speculative load, so no line is cached and nothing leaks</span>}
        </div>
      </div>

      <div className={`spx-out ${mitigated ? 'safe' : 'bad'}`}>
        recovered secret: <b>{recovered.map((r) => (r === null ? '·' : chr(r))).join('') || '—'}</b>
        {leaked >= secretLen && (mitigated ? ' — nothing leaked ✓' : ` — full secret stolen with no memory-safety violation ☠`)}
      </div>

      <p className="spx-foot">
        What makes Spectre so nasty is that <strong>nothing illegal happens architecturally</strong> — the
        out-of-bounds read is undone, so bounds checks, types, and permission bits all still "work." The leak is
        entirely in <em>microarchitectural</em> state (the cache) that the ISA never promised to protect. That's
        why it broke the fundamental isolation assumption behind sandboxes and shared hosting, and why it can't
        be fully fixed in software: mitigations are targeted (an <code>lfence</code> or an index mask on each
        risky bounds check, <code>retpoline</code> for indirect branches, and browser defenses like coarse
        timers and Site Isolation so a page can't build a fine enough clock or share an address space with a
        victim). The deeper lesson is that <strong>performance optimizations can be security boundaries</strong>:
        speculation, shared caches, hyperthreading, and DVFS have all leaked secrets through timing. (Kocher et
        al., 2018; Meltdown is the sibling attack on out-of-order execution across the user/kernel boundary.)
      </p>
    </div>
  );
}
