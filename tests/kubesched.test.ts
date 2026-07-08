import { describe, it, expect } from 'vitest';
import { schedule, evaluate, DEFAULT_NODES, type Pod, type Node } from '../src/web/kubesched';

// Independent oracle: the scheduler's rules. A node is feasible iff free CPU/mem >= the pod's requests AND its taint is
// tolerated AND the node selector matches; if none is feasible the pod is Pending; otherwise it binds to the feasible
// node with the most free capacity after placement. Node facts (below) are worked out by hand, not from the model.
// node-a: 4cpu/8Gi, 2/4 used → free 2/4, us-east, untainted
// node-b: 8cpu/16Gi, 6/12 used → free 2/4, us-west, untainted
// node-c: 4cpu/8Gi, 0/0 used → free 4/8, us-east, taint "gpu"
const pod = (over: Partial<Pod> = {}): Pod => ({ cpu: 1, mem: 2, tolerateGpu: false, requireEast: false, ...over });
const fitFor = (r: ReturnType<typeof schedule>, name: string) => r.fits.find((f) => f.node.name === name)!;

describe('filtering', () => {
  it('a tainted node is filtered when the pod does not tolerate it', () => {
    const r = schedule(DEFAULT_NODES(), pod());
    expect(fitFor(r, 'node-c').feasible).toBe(false);
    expect(fitFor(r, 'node-c').reason).toMatch(/taint/i);
  });
  it('an over-large CPU request filters the nodes that lack the capacity', () => {
    const r = schedule(DEFAULT_NODES(), pod({ cpu: 3 }));
    expect(fitFor(r, 'node-a').feasible).toBe(false);        // only 2 free
    expect(fitFor(r, 'node-a').reason).toMatch(/CPU/i);
    expect(fitFor(r, 'node-b').feasible).toBe(false);        // only 2 free
  });
  it('a nodeSelector filters nodes in the wrong zone', () => {
    const r = schedule(DEFAULT_NODES(), pod({ requireEast: true }));
    expect(fitFor(r, 'node-b').feasible).toBe(false);        // us-west
    expect(fitFor(r, 'node-b').reason).toMatch(/zone|selector/i);
  });
});

describe('placement', () => {
  it('a small pod lands on a feasible node and never on the tainted one', () => {
    const r = schedule(DEFAULT_NODES(), pod());
    expect(r.chosen).not.toBeNull();
    expect(r.chosen).not.toBe('node-c');
    // the winner has the top score among feasible nodes
    const feasible = r.fits.filter((f) => f.feasible);
    const top = feasible.reduce((a, b) => (b.score > a.score ? b : a));
    expect(r.chosen).toBe(top.node.name);
  });
  it('tolerating the GPU taint opens the emptiest node, which then wins the spread score', () => {
    const r = schedule(DEFAULT_NODES(), pod({ tolerateGpu: true }));
    expect(fitFor(r, 'node-c').feasible).toBe(true);
    expect(r.chosen).toBe('node-c'); // 0-used node has the most free capacity after placement
    expect(fitFor(r, 'node-c').score).toBeGreaterThan(fitFor(r, 'node-a').score);
  });
});

describe('Pending', () => {
  it('a pod bigger than every node stays Pending', () => {
    const r = schedule(DEFAULT_NODES(), pod({ cpu: 10 }));
    expect(r.chosen).toBeNull();
    expect(r.reason).toMatch(/Pending/);
  });
  it('a 3-CPU pod is Pending unless it can use the GPU node', () => {
    expect(schedule(DEFAULT_NODES(), pod({ cpu: 3 })).chosen).toBeNull();
    expect(schedule(DEFAULT_NODES(), pod({ cpu: 3, tolerateGpu: true })).chosen).toBe('node-c');
  });
});

describe('evaluate score is zero for infeasible nodes', () => {
  it('does not score a node it filtered', () => {
    const n: Node = { name: 'x', cpu: 4, mem: 8, usedCpu: 4, usedMem: 8, taint: null, zone: 'us-east' };
    expect(evaluate(n, pod()).score).toBe(0);
  });
});
