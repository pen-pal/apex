import { describe, it, expect } from 'vitest';
import { schedule, reassemble, arrivalOrder, throughput, type Path } from '../src/web/mptcp';

const chunks = 'HELLO-MULTIPATH-TCP-WORLD'.split('');
const original = chunks.join('');
const twoPaths = (wifiUp = true, cellUp = true): Path[] => [
  { id: 0, name: 'Wi-Fi', capacity: 10, latencyMs: 30, up: wifiUp },
  { id: 1, name: 'Cellular', capacity: 5, latencyMs: 15, up: cellUp }, // lower latency, lower capacity → reordering
];

describe('DSN reassembly recovers the exact stream', () => {
  it('striped across two paths, reassembles to the original', () => {
    expect(reassemble(schedule(chunks, twoPaths()))).toBe(original);
  });
  it('works for many random streams and path mixes', () => {
    let s = 1; const rnd = (n: number) => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s % n; };
    for (let t = 0; t < 500; t++) {
      const data = Array.from({ length: 5 + rnd(40) }, () => String.fromCharCode(65 + rnd(26)));
      const paths: Path[] = [0, 1, 2].map((id) => ({ id, name: 'p' + id, capacity: 1 + rnd(10), latencyMs: 5 + rnd(90), up: rnd(4) !== 0 || id === 0 }));
      expect(reassemble(schedule(data, paths))).toBe(data.join(''));
    }
  });
});

describe('segments really do arrive out of order — that is why DSN exists', () => {
  it('a lower-latency path delivers a later chunk before an earlier one, yet reassembly is correct', () => {
    const segs = schedule(chunks, twoPaths());
    const arr = arrivalOrder(segs).map((x) => x.dsn);
    const inOrder = arr.every((d, i) => i === 0 || d > arr[i - 1]);
    expect(inOrder).toBe(false);        // arrival order is scrambled vs DSN
    expect(reassemble(segs)).toBe(original); // ...but DSN reassembly fixes it
  });
});

describe('failover: a path dies, no data is lost', () => {
  it('Wi-Fi failure reroutes everything to cellular and the stream still completes', () => {
    const segs = schedule(chunks, twoPaths(false, true));
    expect(reassemble(segs)).toBe(original);
    expect(segs.every((x) => x.pathId === 1)).toBe(true); // all on the surviving path
  });
  it('capacity distributes proportionally and throughput is the sum of up paths', () => {
    const paths = twoPaths();
    const segs = schedule(chunks, paths);
    const wifi = segs.filter((x) => x.pathId === 0).length, cell = segs.filter((x) => x.pathId === 1).length;
    expect(wifi).toBeGreaterThan(cell);      // Wi-Fi has 2× the capacity → carries more
    expect(throughput(paths)).toBe(15);
    expect(throughput(twoPaths(false, true))).toBe(5); // Wi-Fi down → cellular only
  });
});
