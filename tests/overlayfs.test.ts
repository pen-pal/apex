import { describe, it, expect } from 'vitest';
import { resolve, read, merged, write, remove, type Stack, type Layer } from '../src/web/overlayfs';

// Independent oracle: overlayfs semantics. The merged view takes the topmost occurrence of each path; a write copies
// up into the writable upper and never mutates a lower; deleting a lower path writes a whiteout that hides it; two
// containers sharing the same lowers stay independent. Expected values are worked out from those rules, not the code.

const file = (content: string) => ({ content });
const layer = (name: string, readOnly: boolean, files: Record<string, { content: string } | { whiteout: true }>): Layer => ({ name, readOnly, files });

// base image → app layer → (writable) container upper
const base = () => layer('base', true, { '/etc/os': file('alpine'), '/bin/sh': file('busybox'), '/app/cfg': file('v1') });
const app = () => layer('app', true, { '/app/cfg': file('v2'), '/app/server': file('binary') }); // shadows /app/cfg
const upper = () => layer('upper', false, {});
const stack = (): Stack => [base(), app(), upper()];

describe('union resolution — topmost layer wins', () => {
  it('reads a file from its highest layer', () => {
    const s = stack();
    expect(read(s, '/app/cfg')).toEqual({ content: 'v2', layer: 1 });      // app shadows base
    expect(read(s, '/etc/os')).toEqual({ content: 'alpine', layer: 0 });    // only in base
    expect(read(s, '/nope')).toBeNull();
  });
  it('the merged view is the union with the topmost copy of each path', () => {
    expect(merged(stack())).toEqual({ '/etc/os': 'alpine', '/bin/sh': 'busybox', '/app/cfg': 'v2', '/app/server': 'binary' });
  });
});

describe('copy-up on write', () => {
  it('writing a lower-layer file copies it up into the upper and leaves lowers untouched', () => {
    const s0 = stack();
    const { stack: s1, copiedUp } = write(s0, '/app/cfg', 'v3');
    expect(copiedUp).toBe(true);
    expect(s1[2].files['/app/cfg']).toEqual({ content: 'v3' });     // now in upper
    expect(read(s1, '/app/cfg')).toEqual({ content: 'v3', layer: 2 }); // upper wins
    // lowers are pristine — the original app/base layers are unchanged (both in s1 and s0)
    expect(s1[0].files['/app/cfg']).toEqual({ content: 'v1' });
    expect(s1[1].files['/app/cfg']).toEqual({ content: 'v2' });
    expect(s0[2].files['/app/cfg']).toBeUndefined();               // pure: original stack not mutated
  });
  it('writing a brand-new file is not a copy-up', () => {
    const { copiedUp, stack: s1 } = write(stack(), '/app/new', 'hi');
    expect(copiedUp).toBe(false);
    expect(read(s1, '/app/new')).toEqual({ content: 'hi', layer: 2 });
  });
});

describe('whiteout on delete', () => {
  it('deleting a lower file writes a whiteout that hides it, lowers untouched', () => {
    const { stack: s1, whiteout } = remove(stack(), '/bin/sh');
    expect(whiteout).toBe(true);
    expect(s1[2].files['/bin/sh']).toEqual({ whiteout: true });
    expect(read(s1, '/bin/sh')).toBeNull();                 // hidden from the merged view
    expect(merged(s1)['/bin/sh']).toBeUndefined();
    expect(s1[0].files['/bin/sh']).toEqual({ content: 'busybox' }); // still in the lower layer
    expect(resolve(s1, '/bin/sh')?.index).toBe(2);          // the whiteout is what resolves now
  });
  it('deleting an upper-only file just drops it (no whiteout needed)', () => {
    const written = write(stack(), '/tmp/scratch', 'x').stack;
    const { stack: s1, whiteout } = remove(written, '/tmp/scratch');
    expect(whiteout).toBe(false);
    expect(s1[2].files['/tmp/scratch']).toBeUndefined();
  });
});

describe('containers share lowers but have independent uppers', () => {
  it('a write in one container does not affect another sharing the same image', () => {
    const lowers = [base(), app()];
    const a: Stack = [...lowers, layer('upperA', false, {})];
    const b: Stack = [...lowers, layer('upperB', false, {})];
    const a1 = write(a, '/app/cfg', 'A-edit').stack;
    expect(read(a1, '/app/cfg')).toEqual({ content: 'A-edit', layer: 2 });
    expect(read(b, '/app/cfg')).toEqual({ content: 'v2', layer: 1 }); // B still sees the image's version
  });
});
