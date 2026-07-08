// The Kubernetes scheduler, in miniature. Placing a pod is two phases: FILTER out every node that can't run it (not
// enough allocatable CPU/memory left, a taint the pod doesn't tolerate, a node selector that doesn't match), then SCORE
// the survivors and bind to the best. The default scoring spreads load — the node with the most free capacity after the
// pod lands wins. If filtering leaves no node, the pod stays Pending. This models exactly that; it is not the real
// scheduler's plugin framework, but the feasibility rules and the spread score match how it behaves.

export interface Node { name: string; cpu: number; mem: number; usedCpu: number; usedMem: number; taint: string | null; zone: string }
export interface Pod { cpu: number; mem: number; tolerateGpu: boolean; requireEast: boolean }

export interface Fit {
  node: Node;
  feasible: boolean;
  reason: string;       // why it was filtered, or 'fits'
  score: number;        // 0..100 spread score (higher = more free after placement); 0 if infeasible
  freeCpu: number;
  freeMem: number;
}
export interface Result { chosen: string | null; fits: Fit[]; reason: string }

export function evaluate(node: Node, pod: Pod): Fit {
  const freeCpu = node.cpu - node.usedCpu;
  const freeMem = node.mem - node.usedMem;
  let reason = 'fits';
  let feasible = true;
  if (pod.cpu > freeCpu) { feasible = false; reason = `not enough CPU: needs ${pod.cpu}, ${freeCpu} free`; }
  else if (pod.mem > freeMem) { feasible = false; reason = `not enough memory: needs ${pod.mem}Gi, ${freeMem}Gi free`; }
  else if (node.taint && !(node.taint === 'gpu' && pod.tolerateGpu)) { feasible = false; reason = `tainted "${node.taint}" and the pod doesn't tolerate it`; }
  else if (pod.requireEast && node.zone !== 'us-east') { feasible = false; reason = `nodeSelector zone=us-east doesn't match ${node.zone}`; }
  // Spread score: average fraction of each resource still free AFTER the pod lands (LeastAllocated).
  const score = feasible ? Math.round((((freeCpu - pod.cpu) / node.cpu + (freeMem - pod.mem) / node.mem) / 2) * 100) : 0;
  return { node, feasible, reason, score, freeCpu, freeMem };
}

export function schedule(nodes: Node[], pod: Pod): Result {
  const fits = nodes.map((n) => evaluate(n, pod));
  const feasible = fits.filter((f) => f.feasible);
  if (feasible.length === 0) {
    return { chosen: null, fits, reason: 'no node survives filtering, so the pod stays Pending; the scheduler retries as the cluster changes (a pod finishes, a node joins, or the cluster autoscaler adds one).' };
  }
  // Highest spread score wins; ties break to the first node (stable).
  const best = feasible.reduce((a, b) => (b.score > a.score ? b : a));
  return { chosen: best.node.name, fits, reason: `Scheduled to ${best.node.name}: it passed filtering and scored highest — the most free capacity after the pod lands, so load stays spread.` };
}

export const DEFAULT_NODES = (): Node[] => [
  { name: 'node-a', cpu: 4, mem: 8, usedCpu: 2, usedMem: 4, taint: null, zone: 'us-east' },
  { name: 'node-b', cpu: 8, mem: 16, usedCpu: 6, usedMem: 12, taint: null, zone: 'us-west' },
  { name: 'node-c', cpu: 4, mem: 8, usedCpu: 0, usedMem: 0, taint: 'gpu', zone: 'us-east' },
];
