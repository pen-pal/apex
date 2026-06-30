// CPU scheduling, made visible. Edit the job set (arrival + burst), pick a policy, and watch the
// Gantt chart and the three metrics every OS course compares move together. The comparison strip runs
// ALL four policies on your jobs at once so the trade-offs are concrete: FCFS's convoy effect, SJF/SRTF
// driving average waiting down, round-robin trading turnaround for response. Real model from cpusched.ts.
import { useMemo, useState } from 'react';
import { schedule, POLICY_LABEL, type Job, type Policy } from './cpusched';

const POLICIES: Policy[] = ['fcfs', 'sjf', 'srtf', 'rr'];
const DEFAULT_JOBS: Job[] = [
  { id: 'A', arrival: 0, burst: 7 },
  { id: 'B', arrival: 2, burst: 4 },
  { id: 'C', arrival: 4, burst: 1 },
  { id: 'D', arrival: 5, burst: 4 },
];
// distinct, legible colours per job id
const HUES: Record<string, number> = { A: 212, B: 150, C: 28, D: 280, E: 340, F: 90 };
const hueOf = (id: string) => HUES[id] ?? 200;
const fill = (id: string) => `hsl(${hueOf(id)} 60% 62%)`;

export function CpuSchedSection() {
  const [jobs, setJobs] = useState<Job[]>(DEFAULT_JOBS);
  const [policy, setPolicy] = useState<Policy>('srtf');
  const [quantum, setQuantum] = useState(2);

  const result = useMemo(() => schedule(jobs, policy, quantum), [jobs, policy, quantum]);
  const all = useMemo(() => POLICIES.map((p) => ({ p, s: schedule(jobs, p, quantum) })), [jobs, quantum]);
  const horizon = result.gantt.length ? result.gantt[result.gantt.length - 1].end : 1;

  const bestWait = Math.min(...all.map((x) => x.s.avgWaiting));
  const bestResp = Math.min(...all.map((x) => x.s.avgResponse));

  const setJob = (i: number, patch: Partial<Job>) =>
    setJobs((js) => js.map((j, k) => (k === i ? { ...j, ...patch } : j)));
  const addJob = () => setJobs((js) => {
    const id = String.fromCharCode(65 + js.length);
    return js.length >= 6 ? js : [...js, { id, arrival: js.length, burst: 3 }];
  });
  const removeJob = (i: number) => setJobs((js) => (js.length <= 2 ? js : js.filter((_, k) => k !== i)));
  const reset = () => { setJobs(DEFAULT_JOBS); setQuantum(2); };

  return (
    <div className="cpu">
      <div className="cpu-controls">
        <div className="cpu-jobs">
          <div className="cpu-jobs-head"><span>Jobs</span><button type="button" className="cpu-mini" onClick={addJob} disabled={jobs.length >= 6}>+ add</button><button type="button" className="cpu-mini" onClick={reset}>reset</button></div>
          <table className="cpu-jobtable">
            <thead><tr><th>job</th><th>arrival</th><th>burst</th><th></th></tr></thead>
            <tbody>
              {jobs.map((j, i) => (
                <tr key={j.id}>
                  <td><span className="cpu-swatch" style={{ background: fill(j.id) }} />{j.id}</td>
                  <td><input type="number" min={0} max={20} value={j.arrival} onChange={(e) => setJob(i, { arrival: Math.max(0, +e.target.value) })} /></td>
                  <td><input type="number" min={1} max={20} value={j.burst} onChange={(e) => setJob(i, { burst: Math.max(1, +e.target.value) })} /></td>
                  <td><button type="button" className="cpu-x" onClick={() => removeJob(i)} disabled={jobs.length <= 2} aria-label={`remove ${j.id}`}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="cpu-policy">
          <div className="cpu-policy-head">Policy</div>
          <div className="cpu-policy-btns">
            {POLICIES.map((p) => (
              <button key={p} type="button" className={`cpu-pbtn ${policy === p ? 'on' : ''}`} onClick={() => setPolicy(p)}>{POLICY_LABEL[p]}</button>
            ))}
          </div>
          {policy === 'rr' && (
            <label className="cpu-quantum">time quantum <input type="range" min={1} max={6} value={quantum} onChange={(e) => setQuantum(+e.target.value)} /><b>{quantum}</b></label>
          )}
        </div>
      </div>

      <div className="cpu-gantt-wrap">
        <div className="cpu-gantt-title">{POLICY_LABEL[policy]} — Gantt chart</div>
        <div className="cpu-gantt">
          {result.gantt.map((g, i) => (
            <div key={i} className="cpu-bar" style={{ flexGrow: g.end - g.start, background: fill(g.id) }} title={`${g.id}: ${g.start}–${g.end}`}>
              <span className="cpu-bar-id">{g.id}</span>
            </div>
          ))}
        </div>
        <div className="cpu-axis">
          {Array.from(new Set([0, ...result.gantt.map((g) => g.end)])).map((t) => (
            <span key={t} className="cpu-tick" style={{ left: `${(t / horizon) * 100}%` }}>{t}</span>
          ))}
        </div>
      </div>

      <table className="cpu-metrics">
        <thead><tr><th>job</th><th>arrival</th><th>burst</th><th>completion</th><th>turnaround</th><th>waiting</th><th>response</th></tr></thead>
        <tbody>
          {result.metrics.map((mt) => (
            <tr key={mt.id}>
              <td><span className="cpu-swatch" style={{ background: fill(mt.id) }} />{mt.id}</td>
              <td>{mt.arrival}</td><td>{mt.burst}</td><td>{mt.completion}</td>
              <td>{mt.turnaround}</td><td>{mt.waiting}</td><td>{mt.response}</td>
            </tr>
          ))}
          <tr className="cpu-avg">
            <td colSpan={4}>average</td>
            <td>{result.avgTurnaround.toFixed(2)}</td>
            <td>{result.avgWaiting.toFixed(2)}</td>
            <td>{result.avgResponse.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      <div className="cpu-compare">
        <div className="cpu-compare-head">All policies on your job set — lower is better</div>
        <table className="cpu-ctable">
          <thead><tr><th>policy</th><th>avg turnaround</th><th>avg waiting</th><th>avg response</th></tr></thead>
          <tbody>
            {all.map(({ p, s }) => (
              <tr key={p} className={p === policy ? 'on' : ''}>
                <td><button type="button" className="cpu-clink" onClick={() => setPolicy(p)}>{POLICY_LABEL[p]}</button></td>
                <td>{s.avgTurnaround.toFixed(2)}</td>
                <td className={s.avgWaiting === bestWait ? 'best' : ''}>{s.avgWaiting.toFixed(2)}</td>
                <td className={s.avgResponse === bestResp ? 'best' : ''}>{s.avgResponse.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="cpu-foot">
          <strong>SRTF</strong> always minimizes average waiting (it’s greedy-optimal for it) but needs known burst times and can starve long jobs.
          <strong> FCFS</strong> is simplest yet suffers the <em>convoy effect</em> — one long job stuck at the front delays everyone.
          <strong> Round-robin</strong> usually has the worst turnaround but the best <em>response</em>, which is why interactive systems favour it.
          Real schedulers (Linux CFS) approximate fair-share with a red-black tree of virtual runtimes rather than picking from these textbook rules.
        </p>
      </div>
    </div>
  );
}
