// Linux CFS, made visible. Give each task a nice value and run the scheduler tick by tick: CFS always
// runs the task with the smallest virtual runtime (the leftmost in its red-black tree), and a task's
// vruntime advances faster the lower its weight — so niced-down tasks fall behind and get less CPU.
// Watch the achieved CPU share converge to the weight-proportional ideal. Real model from cfs.ts.
import { useMemo, useState } from 'react';
import { run, weightOf, leftmost, initCfs, type Task } from './cfs';

const SLICE = 3;
const HUES: Record<string, number> = { A: 212, B: 150, C: 280 };
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

export function CfsSection() {
  const [tasks, setTasks] = useState<Task[]>([{ id: 'A', nice: 0 }, { id: 'B', nice: 0 }, { id: 'C', nice: 5 }]);
  const [steps, setSteps] = useState(0);

  const r = useMemo(() => run(tasks, SLICE, steps), [tasks, steps]);
  const state = steps === 0 ? initCfs(tasks) : r.state;
  const next = leftmost(tasks, state);
  const maxVr = Math.max(1, ...tasks.map((t) => state.vruntime[t.id]));
  const recent = r.picks.slice(-48);

  const setNice = (id: string, nice: number) => { setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, nice } : t))); setSteps(0); };

  return (
    <div className="cfs">
      <div className="cfs-top">
        <div className="cfs-run">
          <button type="button" className="primary" onClick={() => setSteps((s) => s + 1)}>run 1 slice ▶</button>
          <button type="button" onClick={() => setSteps((s) => s + 20)}>+20</button>
          <button type="button" onClick={() => setSteps((s) => s + 200)}>+200</button>
          <button type="button" onClick={() => setSteps(0)} disabled={steps === 0}>reset</button>
        </div>
        <div className="cfs-meta">slice {SLICE}ms · {steps} slices run · running next: <b style={{ color: `hsl(${HUES[next] ?? 200} 60% 38%)` }}>{next}</b></div>
      </div>

      <div className="cfs-tasks">
        {tasks.map((t) => {
          const hue = HUES[t.id] ?? 200;
          const vr = state.vruntime[t.id];
          const isNext = t.id === next;
          return (
            <div key={t.id} className={`cfs-task ${isNext ? 'next' : ''}`}>
              <div className="cfs-task-h">
                <span className="cfs-tid" style={{ color: `hsl(${hue} 60% 38%)` }}>task {t.id}</span>
                <label className="cfs-nice">nice <input type="range" min={-5} max={5} value={t.nice} onChange={(e) => setNice(t.id, +e.target.value)} /><b>{t.nice}</b></label>
                <span className="cfs-weight">weight {weightOf(t.nice)}</span>
              </div>
              <div className="cfs-vrow">
                <span className="cfs-vrlabel">vruntime</span>
                <div className="cfs-vbar"><div className="cfs-vfill" style={{ width: `${(vr / maxVr) * 100}%`, background: `hsl(${hue} 60% 60%)` }} /></div>
                <span className="cfs-vval">{vr.toFixed(1)}</span>
              </div>
              <div className="cfs-srow">
                <span className="cfs-vrlabel">CPU share</span>
                <div className="cfs-sbar">
                  <div className="cfs-sfill" style={{ width: `${(r.share[t.id] || 0) * 100}%`, background: `hsl(${hue} 60% 55%)` }} />
                  <div className="cfs-ideal" style={{ left: `${(r.ideal[t.id] || 0) * 100}%` }} title={`ideal ${pct(r.ideal[t.id] || 0)}`} />
                </div>
                <span className="cfs-sval">{steps === 0 ? '—' : pct(r.share[t.id] || 0)} <i>/ {pct(r.ideal[t.id] || 0)}</i></span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="cfs-timeline">
        <div className="cfs-tl-h">recent slices (who ran)</div>
        <div className="cfs-tl">
          {recent.length === 0 ? <span className="cfs-tl-empty">press “run” to schedule</span>
            : recent.map((p, i) => <span key={i} className="cfs-cell" style={{ background: `hsl(${HUES[p.id] ?? 200} 60% 62%)` }} title={p.id}>{p.id}</span>)}
        </div>
      </div>

      <p className="cfs-foot">
        CFS keeps runnable tasks in a <strong>red-black tree keyed by vruntime</strong> and always runs the leftmost (smallest). A task’s
        vruntime advances by <code>slice × 1024/weight</code>, so a high-weight task’s clock ticks slowly and it earns more real CPU — the
        achieved share converges to <strong>weight / Σweight</strong>, which is exactly the nice-proportional fair share. A <code>min_vruntime</code>
        floor stops a task that just woke from sleeping at vruntime 0 and hogging the CPU. (This ran Linux from 2.6.23 until EEVDF replaced it in
        6.6; the weight table is the kernel’s <code>sched_prio_to_weight[]</code>.)
      </p>
    </div>
  );
}
