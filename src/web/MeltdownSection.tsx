// Offensive-security guided story: Meltdown (CVE-2017-5754) — reading kernel memory from user space via out-of-order
// execution + a cache side channel. Conceptual + SANDBOXED (a simulated CPU and cache; no real kernel read, no real
// attack) — same honest-mechanism approach as the bufferoverflow / spectre / padding-oracle stories. An illegal load
// faults, but transient execution uses its result before the fault retires to cache probe[secret]; Flush+Reload then
// times the 256 lines and the one fast line names the secret. Verified in node: the oracle recovers all 256 byte
// values. Defenses-forward: KPTI unmaps the kernel so there is nothing to transiently read. Educational / CTF framing.
import { useMemo, useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const HIT = 40, MISS = 300, N = 256;
const OX = 90, OY = 60, PW = 760, PH = 150;

type Phase = 'wall' | 'ooo' | 'encode' | 'timing' | 'kpti' | 'run';

function timings(secret: number, jitter: number): number[] {
  // deterministic pseudo-noise so a scene is stable; the cached line (secret) is the one hit
  return Array.from({ length: N }, (_, i) => { const n = ((Math.sin(i * 12.9898 + jitter * 78.233) * 43758.5453) % 1 + 1) % 1; return (i === secret ? HIT : MISS) + (n - 0.5) * 34; });
}

export function MeltdownSection() {
  const [secret, setSecret] = useState(0x53);
  const [jitter, setJitter] = useState(1);
  const times = useMemo(() => timings(secret, jitter), [secret, jitter]);
  const recovered = useMemo(() => { let b = 0; for (let i = 1; i < N; i++) if (times[i] < times[b]) b = i; return b; }, [times]);

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <Melt phase={key} secret={secret} times={times} recovered={recovered} /> });

  const scenes: StoryScene[] = [
    scene('wall', 'The wall: user can’t read kernel memory', 'Every memory access is permission-checked by the CPU. When unprivileged code reads a kernel address, the load raises a fault and the value is supposed to never reach the program. That user/kernel isolation is meant to be absolute — the foundation of process security.'),
    scene('ooo', 'But the CPU runs ahead, out of order', 'To stay fast, the CPU executes instructions speculatively and out of order, before it knows they’re permitted. The illegal load’s fault is only delivered when it tries to RETIRE — and in that transient window, the forbidden byte has already been forwarded to the instructions that follow it.'),
    scene('encode', 'Encode the secret into the cache', 'The gadget uses the forbidden byte as an array index: touch probe[secret × 4096]. This runs transiently, before the fault lands, and pulls exactly one cache line — the secret’s — into the cache. Then the fault squashes the registers… but the cache is never rolled back. One line stays warm.'),
    scene('timing', 'Read it back by timing (Flush+Reload)', 'Architecturally, the illegal read never happened. But now reload all 256 probe lines and time each. 255 are cache misses (~300 cycles); exactly one is a hit (~40 cycles) — the line the transient gadget touched. That one fast line’s index IS the secret byte. Repeat byte-by-byte to dump kernel memory.'),
    scene('kpti', 'KPTI: unmap the kernel', 'The attack needs the kernel mapped to transiently read it. So the fix is Kernel Page-Table Isolation: give user mode a page table with the kernel unmapped — a transient read now hits nothing, and there’s nothing to leak. It works, at a cost on every syscall. (Its cousin Spectre mistrains prediction within a domain and is far harder to fix.)'),
    { key: 'run', title: 'Recover a byte yourself', caption: 'Set a “secret” byte and re-run the simulated attack. The transient gadget caches probe[secret]; then Flush+Reload times all 256 lines and the one that comes back fast (dipping below the hit/miss threshold) names the byte — recovered without ever architecturally reading it. This is a sandboxed simulation: no real memory is touched.', render: () => <Melt phase="run" secret={secret} times={times} recovered={recovered} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>The CPU is supposed to enforce an absolute wall: unprivileged code cannot read kernel memory — an illegal access faults before the value is exposed. <strong>Meltdown</strong> breaks that wall using <strong>out-of-order execution</strong>: the CPU runs instructions speculatively, ahead of the permission check, so the forbidden byte is briefly available to later “transient” instructions before the fault is delivered. Those instructions can’t keep the value in a register (the fault squashes that), but they can leave a fingerprint of it in the CPU <strong>cache</strong> — and that fingerprint survives, to be read back by timing.</>,
        takeaway: <>Meltdown (2018, CVE-2017-5754) exploits the gap between when a load’s result is available and when its permission fault is delivered. On affected (mostly Intel) CPUs an out-of-order load of a kernel address forwards the byte to dependent instructions <em>transiently</em>, and only at retirement is the privilege fault raised and the architectural results discarded. The gadget turns that transient window into a leak with the <strong>Flush+Reload</strong> cache side channel: (1) flush a 256-line probe array from cache; (2) in the transient window, read the forbidden byte and use it as an index — <code>touch probe[secret × 4096]</code>, caching exactly one line; (3) after the fault is handled (suppressed with a signal handler, or wrapped in an Intel TSX transaction so it never surfaces), reload all 256 lines and time each — 255 are misses (~300 cycles), one is a hit (~40 cycles), and that fast line’s index is the secret (verified here: the oracle recovers every byte value 0–255). Repeat byte-by-byte and an unprivileged process dumps kernel — even all physical — memory at kilobytes per second. Meltdown is <em>not</em> Spectre: it crosses the user/kernel boundary by racing a deferred permission check, so it’s fixed in software by <strong>Kernel Page-Table Isolation</strong> (KPTI/KAISER) — unmapping the kernel from the user page table so nothing is there to transiently read, at a syscall-time cost — and in hardware by checking permissions before forwarding load results. It’s the canonical proof that microarchitectural state (caches, predictors) is part of your security model, not an invisible optimization.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="mlt-ctl">
          <label className="mlt-lbl">secret byte 0x<input type="range" min={0} max={255} value={secret} onChange={(e) => setSecret(+e.target.value)} /><b>{secret.toString(16).padStart(2, '0')}</b> ({secret >= 32 && secret < 127 ? `'${String.fromCharCode(secret)}'` : '·'})</label>
          <button type="button" className="mlt-btn" onClick={() => setJitter((j) => j + 1)}>↻ re-run</button>
          <span className={`mlt-live ${recovered === secret ? 'ok' : ''}`}>recovered 0x{recovered.toString(16).padStart(2, '0')} {recovered === secret ? '✓' : ''}</span>
        </div>
      )}
    />
  );
}

function Melt({ phase, secret, times, recovered }: { phase: Phase; secret: number; times: number[]; recovered: number }) {
  const on = (p: Phase) => phase === p;
  const bw = PW / N;
  const maxT = MISS + 20;
  const showBars = on('timing') || on('run') || on('kpti');
  const showProbe = on('encode') || showBars;
  const blocked = on('kpti');
  return (
    <svg viewBox="0 0 900 400" className="story-svg">
      <text x="60" y="24" className="mlt-col">sandboxed simulation — no real memory is read</text>

      {/* the transient gadget */}
      <text x={OX} y={44} className="mlt-code">
        <tspan className="mlt-c-kw">transient</tspan>{'  '}secret = *kernel_ptr;{'   '}
        <tspan className={on('wall') || blocked ? 'mlt-c-fault' : 'mlt-c-dim'}>{blocked ? '// unmapped → nothing to read' : '// faults (illegal)'}</tspan>
      </text>
      <text x={OX} y={64} className="mlt-code">{'          '}touch probe[secret × 4096];{'  '}<tspan className="mlt-c-dim">// transient → caches one line</tspan></text>

      {/* probe array strip (256 lines) */}
      {showProbe && <>
        <text x={OX} y={98} className="mlt-lbl2">probe[] — 256 cache lines (one per possible byte value)</text>
        {Array.from({ length: N }, (_, i) => <rect key={i} x={OX + i * bw} y={104} width={Math.max(1, bw - 0.3)} height={12} className={`mlt-line ${i === secret && !blocked ? 'hot' : ''}`} />)}
        {!blocked && <text x={OX + secret * bw} y={100} className="mlt-tag" textAnchor="middle">probe[0x{secret.toString(16)}] cached</text>}
      </>}

      {/* Flush+Reload timing bars */}
      {showBars && <>
        <text x={OX} y={150} className="mlt-lbl2">Flush+Reload: reload each line, measure access time (cycles)</text>
        <line x1={OX} y1={OY + PH - ((HIT + MISS) / 2 / maxT) * PH} x2={OX + PW} y2={OY + PH - ((HIT + MISS) / 2 / maxT) * PH} className="mlt-thresh" />
        {times.map((t, i) => { const h = (t / maxT) * PH; return <rect key={i} x={OX + i * bw} y={OY + PH - h} width={Math.max(1, bw - 0.3)} height={h} className={`mlt-bar ${!blocked && i === recovered ? 'fast' : ''}`} />; })}
        {!blocked && <><text x={OX + recovered * bw} y={OY + PH - (times[recovered] / maxT) * PH - 6} className="mlt-tag" textAnchor="middle">0x{recovered.toString(16)}</text>
          <text x={OX + PW} y={OY + PH + 24} className="mlt-recover" textAnchor="end">recovered secret = 0x{recovered.toString(16).padStart(2, '0')} {secret >= 32 && secret < 127 ? `'${String.fromCharCode(secret)}'` : ''} {recovered === secret ? '✓' : ''}</text></>}
        {blocked && <text x={OX + PW / 2} y={OY + PH / 2} className="mlt-recover" textAnchor="middle">no line cached → all misses → nothing leaks</text>}
        <text x={OX - 6} y={OY + PH - (HIT / maxT) * PH} className="mlt-axis" textAnchor="end">~{HIT}</text>
        <text x={OX - 6} y={OY + PH - (MISS / maxT) * PH} className="mlt-axis" textAnchor="end">~{MISS}</text>
      </>}

      <text x="450" y="392" className="mlt-foot" textAnchor="middle">
        {on('wall') ? 'an unprivileged kernel read faults — the value must never surface'
          : on('ooo') ? 'out-of-order execution uses the byte transiently before the fault retires'
          : on('encode') ? 'touch probe[secret] transiently → exactly one cache line goes warm'
          : on('timing') ? 'one line reloads fast (~40 cyc) among 255 slow — its index is the secret'
          : on('kpti') ? 'KPTI unmaps the kernel from user page tables → nothing to read, no leak'
          : recovered === secret ? `recovered 0x${recovered.toString(16)} via cache timing — never architecturally read` : 'run the timing to recover the byte'}
      </text>
    </svg>
  );
}
