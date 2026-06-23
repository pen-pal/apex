import { describe, it, expect } from 'vitest';
import { schedule, type TClass } from '../src/web/qos';

// VoIP (highest prio) backed up, plus video and bulk waiting.
const classes: TClass[] = [
  { id: 'voip', priority: 0, weight: 1, queue: 8 },
  { id: 'video', priority: 1, weight: 2, queue: 6 },
  { id: 'bulk', priority: 2, weight: 4, queue: 10 },
];

describe('strict priority', () => {
  it('always serves the highest-priority non-empty class first', () => {
    const r = schedule(classes, 'priority', 5);
    expect(r.order).toEqual(['voip', 'voip', 'voip', 'voip', 'voip']); // all VoIP while it has packets
  });
  it('STARVES lower classes when the high class stays busy', () => {
    const r = schedule(classes, 'priority', 8); // exactly drains VoIP's 8 packets
    expect(r.share).toEqual({ voip: 8, video: 0, bulk: 0 });
    expect(r.starved.sort()).toEqual(['bulk', 'video']); // both had packets, sent none
  });
  it('moves on to the next class only once the higher one is empty', () => {
    const r = schedule(classes, 'priority', 10); // 8 VoIP, then 2 video
    expect(r.share).toEqual({ voip: 8, video: 2, bulk: 0 });
  });
});

describe('weighted round robin', () => {
  it('gives each class its weighted share, so nobody starves', () => {
    // weights 1:2:4 → over 7 slots a round serves voip 1, video 2, bulk 4
    const r = schedule(classes, 'wrr', 7);
    expect(r.share).toEqual({ voip: 1, video: 2, bulk: 4 });
    expect(r.starved).toEqual([]); // every class made progress
    expect(r.order).toEqual(['voip', 'video', 'video', 'bulk', 'bulk', 'bulk', 'bulk']);
  });
  it('keeps cycling proportionally across multiple rounds', () => {
    const r = schedule(classes, 'wrr', 14); // two full rounds of 7
    expect(r.share).toEqual({ voip: 2, video: 4, bulk: 8 });
  });
  it('skips an empty class without stalling the others', () => {
    const cs: TClass[] = [
      { id: 'a', priority: 0, weight: 2, queue: 1 }, // runs dry after 1
      { id: 'b', priority: 1, weight: 2, queue: 10 },
    ];
    const r = schedule(cs, 'wrr', 6);
    expect(r.share.a).toBe(1); // only had 1 packet
    expect(r.share.b).toBe(5); // b keeps getting served
  });
});
