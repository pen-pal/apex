import { describe, it, expect } from 'vitest';
import { CowMemory } from '../src/web/cow';

describe('fork shares pages without copying', () => {
  it('after fork every page is shared and nothing has been copied', () => {
    const m = new CowMemory(4);
    m.fork();
    expect(m.copies).toBe(0);
    expect(m.view('parent').every((p) => p.shared && p.refcount === 2)).toBe(true);
    expect(m.view('child')!.every((p) => p.shared)).toBe(true);
  });
  it('parent and child see the same frames until a write', () => {
    const m = new CowMemory(3);
    m.fork();
    expect(m.view('parent').map((p) => p.frame)).toEqual(m.view('child').map((p) => p.frame));
  });
});

describe('writes trigger lazy copies — only of the pages actually modified', () => {
  it("a write to a shared page copies exactly that one page", () => {
    const m = new CowMemory(4);
    m.fork();
    m.write('child', 1);
    expect(m.copies).toBe(1);
    expect(m.view('child')[1].shared).toBe(false);   // now private to the child
    expect(m.view('parent')[1].shared).toBe(false);  // parent's copy refcount dropped to 1
    expect(m.view('parent')[1].frame).not.toBe(m.view('child')[1].frame); // diverged
    // untouched pages are still shared
    expect(m.view('child')[0].shared).toBe(true);
  });
  it('writing the same page again does not copy a second time', () => {
    const m = new CowMemory(4);
    m.fork();
    m.write('child', 1);
    m.write('child', 1);
    expect(m.copies).toBe(1); // already private
  });
  it('parent and child writing different pages each cost one copy', () => {
    const m = new CowMemory(4);
    m.fork();
    m.write('child', 0);
    m.write('parent', 2);
    expect(m.copies).toBe(2);
  });
});

describe('the fork+exec fast path', () => {
  it('a child that exec()s before writing copies nothing', () => {
    const m = new CowMemory(8);
    m.fork();
    m.execChild();          // child replaces its address space
    expect(m.copies).toBe(0);
    // the parent's pages are no longer shared — refcount back to 1
    expect(m.view('parent').every((p) => !p.shared)).toBe(true);
  });
});
