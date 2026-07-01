import { describe, it, expect } from 'vitest';
import { RCU } from '../src/web/rcu';

const live = (r: RCU) => r.liveVersions().map((v) => v.value);

describe('readers never block and see a consistent snapshot', () => {
  it('a reader keeps seeing its old version after a writer publishes a new one', () => {
    const r = new RCU('v0');
    const R1 = r.readerPin();
    r.update(() => 'v1');
    expect(r.read(R1)).toBe('v0'); // still the version it pinned — safe, no torn/freed read
    const R2 = r.readerPin();
    expect(r.read(R2)).toBe('v1'); // a reader arriving after the swap sees the new one
  });
  it('the pointer swap is atomic — no reader ever sees a half-updated value', () => {
    const r = new RCU('A');
    const readers = Array.from({ length: 5 }, () => r.readerPin());
    r.update(() => 'B');
    // every pre-existing reader sees exactly A (old), never a mix
    readers.forEach((id) => expect(r.read(id)).toBe('A'));
  });
});

describe('the grace period — reclaim only after all pre-existing readers leave', () => {
  it('the old version stays live while any reader still references it', () => {
    const r = new RCU('v0');
    const R1 = r.readerPin();
    r.update(() => 'v1');
    expect(live(r).sort()).toEqual(['v0', 'v1']); // both alive: v0 retired but pinned
    expect(r.read(R1)).toBe('v0');
  });
  it('the old version is reclaimed exactly when the last reader of it unpins', () => {
    const r = new RCU('v0');
    const R1 = r.readerPin();
    const R2 = r.readerPin(); // two readers on v0
    r.update(() => 'v1');
    r.readerUnpin(R1);
    expect(live(r).sort()).toEqual(['v0', 'v1']); // R2 still holds v0 → not yet
    r.readerUnpin(R2);
    expect(live(r)).toEqual(['v1']); // grace period complete → v0 freed
  });
  it('a reader with no readers present → update reclaims the old copy immediately', () => {
    const r = new RCU('v0');
    r.update(() => 'v1');
    expect(live(r)).toEqual(['v1']);
  });
});

describe('no use-after-free, ever', () => {
  it('reading a pinned version never touches a reclaimed one, across several updates', () => {
    const r = new RCU('v0');
    const R = r.readerPin(); // pins v0
    r.update(() => 'v1');
    r.update(() => 'v2');
    r.update(() => 'v3');
    expect(r.read(R)).toBe('v0'); // still valid — v0 can't be freed while R holds it
    expect(() => r.read(R)).not.toThrow();
    r.readerUnpin(R);
    expect(live(r)).toEqual(['v3']); // once R leaves, all the intermediate copies drain
  });
  it('three concurrent readers pinned to three different versions all read correctly', () => {
    const r = new RCU('v0');
    const A = r.readerPin();      // v0
    r.update(() => 'v1');
    const B = r.readerPin();      // v1
    r.update(() => 'v2');
    const C = r.readerPin();      // v2
    expect([r.read(A), r.read(B), r.read(C)]).toEqual(['v0', 'v1', 'v2']);
    expect(live(r).sort()).toEqual(['v0', 'v1', 'v2']);
  });
});
