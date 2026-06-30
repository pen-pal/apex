import { describe, it, expect } from 'vitest';
import { compare, drain } from '../src/web/epoll';

describe('epoll vs select/poll — the C10k scaling gap', () => {
  it('select scans every fd each call; epoll only the ready ones', () => {
    const r = compare(1000, [1, 1, 1]); // 1000 conns, 1 active per wait
    expect(r.selectScans).toBe(3000);   // 1000 × 3 calls
    expect(r.epollScans).toBe(3);       // 1 × 3
    expect(r.ratio).toBe(1000);
  });
  it('the gap widens with idle connections (the whole point)', () => {
    const few = compare(100, [2, 2]);
    const many = compare(10000, [2, 2]);
    expect(many.ratio).toBeGreaterThan(few.ratio); // more idle conns → epoll wins by more
    expect(many.ratio).toBe(10000 / 2);
  });
  it('when most fds are active, the advantage shrinks', () => {
    const r = compare(100, [100, 100]); // everyone ready → both scan ~all
    expect(r.ratio).toBe(1);
  });
  it('counts at least one unit of work per call even with zero ready', () => {
    const r = compare(50, [0]);
    expect(r.perCall[0].epoll).toBe(1);
  });
});

describe('level- vs edge-triggered draining', () => {
  it('level-triggered keeps waking until the buffer is empty', () => {
    const r = drain(1000, 256, 'level');
    expect(r.wakeups).toBe(Math.ceil(1000 / 256)); // 4 wakeups
    expect(r.bytesRead).toBe(1000);
    expect(r.stalled).toBe(0);
  });
  it('edge-triggered wakes once — a naive single read strands the rest (the classic stall)', () => {
    const r = drain(1000, 256, 'edge');
    expect(r.wakeups).toBe(1);
    expect(r.bytesRead).toBe(256);
    expect(r.stalled).toBe(744); // unread, and NO further wakeup will come
  });
  it('edge-triggered is fine when one read drains everything', () => {
    const r = drain(200, 256, 'edge');
    expect(r.bytesRead).toBe(200);
    expect(r.stalled).toBe(0);
  });
  it('no data → no wakeup', () => {
    expect(drain(0, 256, 'level').wakeups).toBe(0);
    expect(drain(0, 256, 'edge').wakeups).toBe(0);
  });
});
