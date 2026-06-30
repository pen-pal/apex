import { describe, it, expect } from 'vitest';
import { amplification, sacrifices } from '../src/web/rum';

describe('amplification formulas (N=1,000,000, T=10, B=100)', () => {
  const r = amplification(1_000_000, 10, 100);

  it('LSM has ~log_T(N) levels and the B-tree ~log_B(N) height', () => {
    expect(r.levels).toBe(6);       // log10(1e6) = 6
    expect(r.btreeHeight).toBe(3);  // log100(1e6) = 3
  });

  it('the B-tree is read-optimized (low read amp, low space)', () => {
    expect(r.btree).toEqual({ read: 3, write: 1, space: 1.5 });
  });

  it('leveled LSM trades a high WRITE amp for low space', () => {
    expect(r.leveled.write).toBe(60);   // T·L = 10·6
    expect(r.leveled.read).toBe(6);     // L
    expect(r.leveled.space).toBe(1.1);  // (T+1)/T
  });

  it('tiered LSM trades a high READ amp (and space) for low write amp', () => {
    expect(r.tiered.write).toBe(6);     // L
    expect(r.tiered.read).toBe(60);     // T·L
    expect(r.tiered.space).toBe(10);    // T
  });

  it('leveled and tiered are mirror images on read vs write (the T-factor swaps)', () => {
    expect(r.leveled.write).toBe(r.tiered.read);
    expect(r.leveled.read).toBe(r.tiered.write);
  });
});

describe('the RUM tradeoff — each engine sacrifices a different corner', () => {
  it('B-tree sacrifices neither read nor write the most; leveled→write, tiered→read', () => {
    const r = amplification(1_000_000, 10, 100);
    expect(sacrifices(r.leveled)).toBe('write');
    expect(sacrifices(r.tiered)).toBe('read');
  });
  it('a larger size ratio T sharpens the write-vs-read divergence', () => {
    const lo = amplification(1_000_000, 4, 100);
    const hi = amplification(1_000_000, 20, 100);
    expect(hi.leveled.write).toBeGreaterThan(lo.leveled.write); // bigger T → more rewrites per level
    expect(hi.tiered.read).toBeGreaterThan(lo.tiered.read);
  });
  it('amplifications are at least 1 even for tiny datasets', () => {
    const r = amplification(10, 10, 100);
    expect(r.levels).toBe(1);
    expect(r.btreeHeight).toBe(1);
  });
});
