// cgroups v2, made visible — the resource half of a container. Pick a controller and set its limit against a hungry
// workload: cpu.max throttles a CPU-bound task to its quota (run then paused each period), memory.max OOM-kills a task
// whose working set doesn't fit, pids.max contains a fork bomb. Model + tests in cgroups.ts.
import { useState } from 'react';
import { cpuThrottle, memoryOutcome, pidsOutcome } from './cgroups';

type Ctl = 'cpu' | 'memory' | 'pids';
const MEM_NEED = 700;   // the workload's working set (MB)
const FORKS = 5000;     // a fork bomb's appetite

export function CgroupsSection() {
  const [ctl, setCtl] = useState<Ctl>('cpu');
  const [quota, setQuota] = useState(40);      // cpu.max, % of one core
  const [memMax, setMemMax] = useState(512);   // memory.max, MB
  const [pidsMax, setPidsMax] = useState(100); // pids.max

  const cpu = cpuThrottle(quota, 100);
  const mem = memoryOutcome(MEM_NEED, memMax);
  const pids = pidsOutcome(FORKS, pidsMax);

  return (
    <div className="cgr">
      <div className="cgr-tabs">
        {(['cpu', 'memory', 'pids'] as Ctl[]).map((c) => (
          <button key={c} type="button" className={ctl === c ? 'on' : ''} onClick={() => setCtl(c)}>
            {c === 'cpu' ? 'cpu.max' : c === 'memory' ? 'memory.max' : 'pids.max'}
          </button>
        ))}
      </div>

      {ctl === 'cpu' && (
        <div className="cgr-panel">
          <label className="cgr-slider"><span>cpu.max quota&nbsp;<b>{quota}%</b> of a core&nbsp;<code>({quota}ms / 100ms)</code></span>
            <input type="range" min={10} max={100} step={10} value={quota} onChange={(e) => setQuota(+e.target.value)} /></label>
          <div className="cgr-caption">the task wants a whole core (100%)</div>
          <div className="cgr-period">
            <div className="cgr-run" style={{ width: `${cpu.effectivePct}%` }}>run {cpu.effectivePct}ms</div>
            {cpu.throttled && <div className="cgr-throttle" style={{ width: `${100 - cpu.effectivePct}%` }}>throttled {100 - cpu.effectivePct}ms</div>}
          </div>
          <div className={`cgr-verdict ${cpu.throttled ? 'cgr-cap' : 'cgr-fit'}`}>
            {cpu.throttled
              ? <>Throttled to <b>{cpu.effectivePct}%</b> — the task runs full for {cpu.effectivePct}ms, then the kernel pauses it for {100 - cpu.effectivePct}ms every period. It gets {cpu.throttledPct}% less CPU than it asked for, no matter how many threads it spawns.</>
              : <>Runs at <b>{cpu.effectivePct}%</b> — under quota, so it’s never paused. Raise its demand or lower the quota to see throttling.</>}
          </div>
        </div>
      )}

      {ctl === 'memory' && (
        <div className="cgr-panel">
          <label className="cgr-slider"><span>memory.max&nbsp;<b>{memMax} MB</b></span>
            <input type="range" min={128} max={1024} step={64} value={memMax} onChange={(e) => setMemMax(+e.target.value)} /></label>
          <div className="cgr-caption">the task’s working set is {MEM_NEED} MB</div>
          <div className="cgr-membar">
            <div className={`cgr-memfill ${mem.oom ? 'cgr-memoom' : ''}`} style={{ width: `${Math.min(100, (mem.usedMb / MEM_NEED) * 100)}%` }} />
            <div className="cgr-memlimit" style={{ left: `${Math.min(100, (memMax / MEM_NEED) * 100)}%` }} title="memory.max" />
            <span className="cgr-memlbl">{mem.usedMb} / {MEM_NEED} MB used · limit {memMax}</span>
          </div>
          <div className={`cgr-verdict ${mem.oom ? 'cgr-cap' : 'cgr-fit'}`}>
            {mem.oom
              ? <>💀 <b>OOM-killed</b> — the working set can’t fit in {memMax} MB, so the kernel’s OOM killer terminates the task rather than let it take memory from the rest of the host. Raise the limit past {MEM_NEED} MB.</>
              : <>Fits in {memMax} MB — the {MEM_NEED} MB working set is under the cap, so it runs. Drop the limit below {MEM_NEED} MB to trigger the OOM killer.</>}
          </div>
        </div>
      )}

      {ctl === 'pids' && (
        <div className="cgr-panel">
          <label className="cgr-slider"><span>pids.max&nbsp;<b>{pidsMax}</b></span>
            <input type="range" min={10} max={500} step={10} value={pidsMax} onChange={(e) => setPidsMax(+e.target.value)} /></label>
          <div className="cgr-caption">a fork bomb tries to spawn without limit</div>
          <div className="cgr-pids">
            <div className="cgr-pidcount"><b>{pids.running}</b><span>processes running (capped at pids.max)</span></div>
            <div className="cgr-pidfail"><b>{pids.failedForks.toLocaleString()}</b><span>fork() calls got EAGAIN</span></div>
          </div>
          <div className={`cgr-verdict ${pids.contained ? 'cgr-fit' : 'cgr-cap'}`}>
            {pids.contained
              ? <>✓ <b>contained</b> — once {pidsMax} processes exist, every further <code>fork()</code> returns EAGAIN, so the bomb can’t exhaust the host’s process table or PID space. The blast is limited to this cgroup.</>
              : <>The cap ({pidsMax}) is above the bomb’s reach here — raise the bomb’s appetite or lower pids.max to see it hit the wall.</>}
          </div>
        </div>
      )}

      <p className="cgr-foot">
        A container is namespaces (what a process can <em>see</em>) plus <strong>cgroups</strong> (what it can
        <em> use</em>). cgroups v2 is a tree of groups, each with <strong>controllers</strong> that meter a resource:
        <code> cpu.max</code> is a quota over a period (bandwidth, not priority — so a capped task is <em>paused</em>,
        which is why an overcommitted node shows CPU throttling even with idle cores), <code>memory.max</code> backs the
        OOM killer, <code>pids.max</code> stops fork bombs, and <code>io.max</code> caps disk bandwidth. This is what
        Kubernetes <strong>requests and limits</strong> and <code>docker run --memory/--cpus</code> compile down to, and
        why one noisy tenant can’t starve the others on a shared box. (Linux cgroups v2.)
      </p>
    </div>
  );
}
