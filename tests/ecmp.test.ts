import { describe, it, expect } from 'vitest';
import { pickPath, distribute, twoStageLinks, makeFlows, type Flow } from '../src/web/ecmp';

const flow: Flow = { srcIp: '10.0.0.5', dstIp: '10.0.9.9', srcPort: 5000, dstPort: 443, proto: 'TCP' };

describe('ECMP flow hashing', () => {
  it('a flow is pinned to one path (every packet hashes the same) — in-order delivery', () => {
    const p = pickPath(flow, 4, 1);
    for (let i = 0; i < 20; i++) expect(pickPath(flow, 4, 1)).toBe(p); // deterministic
  });
  it('different flows scatter across the paths', () => {
    const counts = distribute(makeFlows(400), 4, 1);
    expect(counts.every((c) => c > 0)).toBe(true); // all paths used
    const max = Math.max(...counts), min = Math.min(...counts);
    expect(max / min).toBeLessThan(1.6); // reasonably balanced (hashing, not perfect round-robin)
    expect(counts.reduce((a, b) => a + b, 0)).toBe(400); // nothing lost
  });
  it('changing only the source port can move a flow to a different path', () => {
    const a = pickPath({ ...flow, srcPort: 5000 }, 4, 1);
    const moved = [5001, 5002, 5003, 5004, 5005].some((p) => pickPath({ ...flow, srcPort: p }, 4, 1) !== a);
    expect(moved).toBe(true);
  });
});

describe('polarization across two tiers', () => {
  const flows = makeFlows(600);
  it('IDENTICAL hash seeds polarize — only the diagonal links carry traffic', () => {
    const t = twoStageLinks(flows, 4, 7, 7);
    expect(t.used).toBe(4); // only 4 of the 16 tier-2 links are used (n of n²)
    expect(t.total).toBe(16);
  });
  it('a per-router seed lights up the full mesh', () => {
    const t = twoStageLinks(flows, 4, 7, 99);
    expect(t.used).toBeGreaterThan(4); // far more than the diagonal — cross paths now carry traffic
    expect(t.used).toBeLessThanOrEqual(16);
  });
});
