import { describe, it, expect } from 'vitest';
import { freshEnv, lookup, safeMerge, demo } from '../src/web/protopollute';

const ATTACK = '{"__proto__":{"isAdmin":true,"role":"root"}}';

describe('the vulnerability', () => {
  it('a fresh empty object has none of the attacker properties before the merge', () => {
    const env = freshEnv();
    expect(lookup({}, 'isAdmin', env)).toBeUndefined();
  });
  it('merging a __proto__ payload pollutes the shared prototype so EVERY object inherits it', () => {
    const r = demo(ATTACK, 'vulnerable', ['isAdmin', 'role', 'other']);
    expect(r.freshObjectSees.isAdmin).toBe(true);   // a brand-new {} now looks like an admin
    expect(r.freshObjectSees.role).toBe('root');
    expect(r.freshObjectSees.other).toBeUndefined();
  });
  it('the attack is invisible on the merged object itself — it hid in the prototype', () => {
    const r = demo(ATTACK, 'vulnerable', ['isAdmin']);
    expect(Object.keys(r.target)).toHaveLength(0); // target is still {}
    expect(r.polluted.isAdmin).toBe(true);         // ...but the prototype is polluted
  });
});

describe('the fix', () => {
  it('the safe merge drops __proto__ and leaves the prototype clean', () => {
    const r = demo(ATTACK, 'safe', ['isAdmin', 'role']);
    expect(r.freshObjectSees.isAdmin).toBeUndefined();
    expect(r.freshObjectSees.role).toBeUndefined();
    expect(Object.keys(r.polluted)).toHaveLength(0);
  });
  it('safe merge also drops constructor / prototype keys', () => {
    const env = freshEnv(); const t: Record<string, any> = {};
    safeMerge(t, JSON.parse('{"constructor":{"x":1},"prototype":{"y":2},"ok":3}'), env);
    expect(t.ok).toBe(3);
    // safeMerge must not have ADDED them as own properties (t.constructor would otherwise read real Object)
    expect(Object.prototype.hasOwnProperty.call(t, 'constructor')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(t, 'prototype')).toBe(false);
  });
});

describe('the constructor.prototype vector (dodges a filter that only blocks __proto__)', () => {
  const CTOR = '{"constructor":{"prototype":{"isAdmin":true,"role":"root"}}}';
  it('rests on a real-JS fact: obj.constructor.prototype IS Object.prototype', () => {
    expect(({}).constructor.prototype).toBe(Object.prototype); // the independent oracle
  });
  it('vulnerable merge pollutes the shared prototype via constructor.prototype too', () => {
    const r = demo(CTOR, 'vulnerable', ['isAdmin', 'role']);
    expect(r.freshObjectSees.isAdmin).toBe(true);
    expect(r.freshObjectSees.role).toBe('root');
    expect(Object.keys(r.target)).toHaveLength(0); // invisible on the target, exactly like __proto__
  });
  it('both vectors pollute identically', () => {
    const a = demo(ATTACK, 'vulnerable', ['isAdmin', 'role']).freshObjectSees;
    expect(demo(CTOR, 'vulnerable', ['isAdmin', 'role']).freshObjectSees).toEqual(a);
  });
  it('the safe merge blocks the constructor vector too', () => {
    expect(demo(CTOR, 'safe', ['isAdmin']).freshObjectSees.isAdmin).toBeUndefined();
  });
  it('a constructor key without a prototype sub-object does not pollute', () => {
    expect(Object.keys(demo('{"constructor":{"x":1}}', 'vulnerable', []).polluted)).toHaveLength(0);
  });
  it('the sandbox still never touches the real Object.prototype', () => {
    demo(CTOR, 'vulnerable', ['isAdmin']);
    expect(Object.prototype.hasOwnProperty.call(Object.prototype, 'isAdmin')).toBe(false);
  });
});

describe('normal deep merges still work (both modes)', () => {
  it('non-dangerous nested data merges the same', () => {
    const json = '{"theme":"dark","nested":{"a":1,"b":{"c":2}}}';
    for (const mode of ['vulnerable', 'safe'] as const) {
      const r = demo(json, mode, []);
      expect(r.target).toEqual({ theme: 'dark', nested: { a: 1, b: { c: 2 } } });
      expect(Object.keys(r.polluted)).toHaveLength(0); // no pollution from clean data
    }
  });
});

describe('the sandbox never touches the real prototype', () => {
  it('running the attack does not pollute the actual Object.prototype', () => {
    demo(ATTACK, 'vulnerable', ['isAdmin']);
    expect(({} as any).isAdmin).toBeUndefined(); // the REAL runtime is unaffected
    expect(Object.prototype.hasOwnProperty.call(Object.prototype, 'isAdmin')).toBe(false);
  });
});
