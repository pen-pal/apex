import { describe, it, expect } from 'vitest';
import { PATHS, pathById, stepIndexOf, FEATURED_JOURNEYS } from '../src/web/paths';
import { metaById } from '../src/web/sections';

describe('guided journeys are well-formed', () => {
  it('every path has an id, title, icon, blurb and at least 4 steps', () => {
    for (const p of PATHS) {
      expect(p.id, 'id').toBeTruthy();
      expect(p.title, `${p.id} title`).toBeTruthy();
      expect(p.icon, `${p.id} icon`).toBeTruthy();
      expect(p.blurb, `${p.id} blurb`).toBeTruthy();
      expect(p.steps.length, `${p.id} step count`).toBeGreaterThanOrEqual(4);
    }
  });

  it('path ids are unique', () => {
    const ids = PATHS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('featured journeys are real paths', () => {
    for (const id of FEATURED_JOURNEYS) expect(pathById[id], `featured ${id}`).toBeTruthy();
  });

  it('every step references a REAL section (taxonomy guard — no drift)', () => {
    for (const p of PATHS) {
      for (const s of p.steps) {
        expect(metaById[s.id], `path ${p.id} → unknown section "${s.id}"`).toBeDefined();
      }
    }
  });

  it('steps are unique within a path (so position derives unambiguously)', () => {
    for (const p of PATHS) {
      const ids = p.steps.map((s) => s.id);
      expect(new Set(ids).size, `path ${p.id} has a duplicate step`).toBe(ids.length);
    }
  });

  it('every step has a non-empty note', () => {
    for (const p of PATHS) {
      for (const s of p.steps) expect(s.note.trim().length, `${p.id}/${s.id} note`).toBeGreaterThan(10);
    }
  });
});

describe('position derivation', () => {
  it('pathById round-trips every path', () => {
    for (const p of PATHS) expect(pathById[p.id]).toBe(p);
  });
  it('stepIndexOf finds a member and reports -1 off the path', () => {
    const p = pathById['https'];
    expect(stepIndexOf(p, p.steps[0].id)).toBe(0);
    expect(stepIndexOf(p, p.steps[p.steps.length - 1].id)).toBe(p.steps.length - 1);
    expect(stepIndexOf(p, 'definitely-not-a-step')).toBe(-1);
  });
});
