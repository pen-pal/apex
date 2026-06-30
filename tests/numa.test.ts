import { describe, it, expect } from 'vitest';
import { firstTouch, interleave, cost, LOCAL_NS, REMOTE_NS, type Topology } from '../src/web/numa';

// 2 sockets: cpu 0,1 on node 0; cpu 2,3 on node 1.
const TOPO: Topology = { cpuNode: [0, 0, 1, 1] };
// The shared workload: each core hammers "its" page.
const WORK = [{ page: 0, cpu: 0 }, { page: 1, cpu: 1 }, { page: 2, cpu: 2 }, { page: 3, cpu: 3 }];

describe('first-touch placement', () => {
  it('places each page on the node of the core that first touched it', () => {
    // serial init: core 0 (node 0) touches everything → all pages on node 0
    expect(firstTouch([0, 0, 0, 0], TOPO)).toEqual([0, 0, 0, 0]);
    // parallel init: each core touches its own page → pages spread to match
    expect(firstTouch([0, 1, 2, 3], TOPO)).toEqual([0, 0, 1, 1]);
  });
});

describe('access cost — local vs remote', () => {
  it('serial init forces the far socket onto remote memory', () => {
    const placement = firstTouch([0, 0, 0, 0], TOPO); // all on node 0
    const r = cost(placement, WORK, TOPO);
    // cores 0,1 (node 0) hit local pages; cores 2,3 (node 1) reach across to node-0 pages
    expect(r).toEqual({ local: 2, remote: 2, ns: 2 * LOCAL_NS + 2 * REMOTE_NS, avgNs: (2 * LOCAL_NS + 2 * REMOTE_NS) / 4 });
    expect(r.ns).toBe(520);
  });

  it('parallel first-touch makes every access local', () => {
    const placement = firstTouch([0, 1, 2, 3], TOPO); // each page local to its user
    const r = cost(placement, WORK, TOPO);
    expect(r).toEqual({ local: 4, remote: 0, ns: 4 * LOCAL_NS, avgNs: LOCAL_NS });
    expect(r.ns).toBe(400);
  });

  it('parallel init is strictly faster than serial init for this workload', () => {
    const serial = cost(firstTouch([0, 0, 0, 0], TOPO), WORK, TOPO).ns;
    const parallel = cost(firstTouch([0, 1, 2, 3], TOPO), WORK, TOPO).ns;
    expect(parallel).toBeLessThan(serial);
  });
});

describe('interleave policy', () => {
  it('round-robins pages across nodes', () => {
    expect(interleave(4, 2)).toEqual([0, 1, 0, 1]);
    expect(interleave(5, 3)).toEqual([0, 1, 2, 0, 1]);
  });
  it('interleave is a middle ground — better than worst-case serial, worse than perfect first-touch', () => {
    const inter = cost(interleave(4, 2), WORK, TOPO).ns;
    const serial = cost(firstTouch([0, 0, 0, 0], TOPO), WORK, TOPO).ns;
    const parallel = cost(firstTouch([0, 1, 2, 3], TOPO), WORK, TOPO).ns;
    // pages 0,2→node0, 1,3→node1; cpu0→p0 local, cpu1→p1 remote, cpu2→p2 remote, cpu3→p3 local
    expect(inter).toBe(2 * LOCAL_NS + 2 * REMOTE_NS); // 520 here — equals serial for this particular map
    expect(inter).toBeGreaterThanOrEqual(parallel);
    expect(inter).toBeLessThanOrEqual(serial);
  });
});

describe('empty workload', () => {
  it('avoids divide-by-zero', () => {
    expect(cost([], [], TOPO)).toEqual({ local: 0, remote: 0, ns: 0, avgNs: 0 });
  });
});
