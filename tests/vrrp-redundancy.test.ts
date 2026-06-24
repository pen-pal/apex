import { describe, it, expect } from 'vitest';
import { virtualMac, skewTime, masterDownInterval, elect, failover, type Router } from '../src/web/vrrp';

const routers: Router[] = [
  { id: 'R1', priority: 200, up: true },
  { id: 'R2', priority: 150, up: true },
  { id: 'R3', priority: 100, up: true },
];

describe('VRRP formulas (RFC 5798 §6.1)', () => {
  it('virtual MAC embeds the VRID', () => {
    expect(virtualMac(1)).toBe('00:00:5e:00:01:01');
    expect(virtualMac(42)).toBe('00:00:5e:00:01:2a');
  });
  it('skew time shrinks as priority grows', () => {
    expect(skewTime(255, 100)).toBeCloseTo(0.39, 2); // ((256-255)/256)*100
    expect(skewTime(200, 100)).toBeCloseTo(21.875, 3);
    expect(skewTime(100, 100)).toBeCloseTo(60.9375, 3);
    expect(skewTime(255, 100)).toBeLessThan(skewTime(100, 100)); // higher priority detects sooner
  });
  it('Master_Down_Interval = 3·adv + skew', () => {
    expect(masterDownInterval(200, 100)).toBeCloseTo(321.875, 3); // 300 + 21.875
    expect(masterDownInterval(100, 100)).toBeCloseTo(360.9375, 3);
  });
});

describe('mastership election', () => {
  it('the highest priority router is master, the rest are backups', () => {
    const e = elect(routers, 100);
    expect(e.master).toBe('R1');
    expect(e.backups).toEqual(['R2', 'R3']);
  });
  it('skips a downed router', () => {
    const e = elect([{ id: 'R1', priority: 200, up: false }, { id: 'R2', priority: 150, up: true }], 100);
    expect(e.master).toBe('R2');
  });
});

describe('failover (no split-brain)', () => {
  const f = failover(routers, 100);
  it('the highest-priority SURVIVOR takes over', () => {
    expect(f.master).toBe('R1'); // who failed
    expect(f.newMaster).toBe('R2'); // next highest
  });
  it('takes over after the new master’s own Master_Down_Interval', () => {
    expect(f.takeoverCs).toBeCloseTo(masterDownInterval(150, 100), 3); // R2 (priority 150)
  });
  it('the higher-priority backup wins the race because its timer is shorter', () => {
    // R2 (150) times out before R3 (100), so R2 alone becomes master — no collision
    expect(masterDownInterval(150, 100)).toBeLessThan(masterDownInterval(100, 100));
  });
});
