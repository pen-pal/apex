// The Kubernetes scheduler, made visible — filter, score, place. Tune a pod's CPU/memory requests and its taint
// toleration / zone selector, and watch each node get filtered (with the reason) or scored, and the pod bind to the
// winner — or stay Pending when nothing fits. Model + tests in kubesched.ts.
import { useMemo, useState } from 'react';
import { schedule, DEFAULT_NODES, type Pod } from './kubesched';

export function KubeSchedSection() {
  const [pod, setPod] = useState<Pod>({ cpu: 1, mem: 2, tolerateGpu: false, requireEast: false });
  const nodes = useMemo(() => DEFAULT_NODES(), []);
  const result = useMemo(() => schedule(nodes, pod), [nodes, pod]);
  const set = (p: Partial<Pod>) => setPod((prev) => ({ ...prev, ...p }));

  return (
    <div className="ksc">
      <div className="ksc-controls">
        <div className="ksc-spec">
          <div className="ksc-spec-h">the pod to schedule</div>
          <label className="ksc-slider"><span>CPU request <b>{pod.cpu}</b></span>
            <input type="range" min={1} max={6} value={pod.cpu} onChange={(e) => set({ cpu: +e.target.value })} /></label>
          <label className="ksc-slider"><span>memory request <b>{pod.mem} Gi</b></span>
            <input type="range" min={1} max={10} value={pod.mem} onChange={(e) => set({ mem: +e.target.value })} /></label>
          <label className="ksc-tog"><input type="checkbox" checked={pod.tolerateGpu} onChange={(e) => set({ tolerateGpu: e.target.checked })} /> tolerate the <code>gpu</code> taint</label>
          <label className="ksc-tog"><input type="checkbox" checked={pod.requireEast} onChange={(e) => set({ requireEast: e.target.checked })} /> nodeSelector <code>zone=us-east</code></label>
        </div>
      </div>

      <div className="ksc-nodes">
        {result.fits.map((f) => {
          const chosen = result.chosen === f.node.name;
          const bar = (used: number, add: number, cap: number, unit: string) => (
            <div className="ksc-bar">
              <div className="ksc-bar-fill ksc-used" style={{ width: `${(used / cap) * 100}%` }} />
              {chosen && <div className="ksc-bar-fill ksc-add" style={{ width: `${(add / cap) * 100}%` }} />}
              <span className="ksc-bar-lbl">{used}{chosen ? `+${add}` : ''} / {cap}{unit}</span>
            </div>
          );
          return (
            <div key={f.node.name} className={`ksc-node ${chosen ? 'ksc-chosen' : f.feasible ? 'ksc-feasible' : 'ksc-filtered'}`}>
              <div className="ksc-node-h">
                <code>{f.node.name}</code>
                <span className="ksc-zone">{f.node.zone}{f.node.taint && <em className="ksc-taint"> · taint:{f.node.taint}</em>}</span>
              </div>
              {bar(f.node.usedCpu, pod.cpu, f.node.cpu, ' CPU')}
              {bar(f.node.usedMem, pod.mem, f.node.mem, 'Gi')}
              <div className="ksc-status">
                {chosen ? <span className="ksc-chosen-tag">◀ scheduled here · score {f.score}</span>
                  : f.feasible ? <span className="ksc-fit">fits · score {f.score}</span>
                    : <span className="ksc-nofit">✗ filtered — {f.reason}</span>}
              </div>
            </div>
          );
        })}
      </div>

      <div className={`ksc-verdict ${result.chosen ? 'ksc-ok' : 'ksc-pending'}`}>
        <b>{result.chosen ? `✓ Running on ${result.chosen}` : '⏳ Pending'}</b> — {result.reason}
      </div>

      <p className="ksc-foot">
        The scheduler never “balances” by moving things around; it places one pod at a time in two passes.
        <strong> Filter</strong> (predicates) throws out every node that can’t run the pod — not enough allocatable
        CPU/memory, a <strong>taint</strong> the pod doesn’t tolerate, a <strong>nodeSelector</strong>/affinity that
        doesn’t match. <strong>Score</strong> ranks the survivors; the default spreads load, preferring the node with the
        most room left after the pod lands (bin-packing is the opposite, used to pack nodes empty enough to scale down).
        Requests are a <em>contract</em>: the scheduler reserves them even if the pod sits idle, which is why an
        over-large request wastes a whole node — and why a pod with no feasible node stays <strong>Pending</strong> until
        one finishes, a node joins, or the cluster autoscaler adds one. (Kubernetes kube-scheduler.)
      </p>
    </div>
  );
}
