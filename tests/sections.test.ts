import { describe, it, expect } from 'vitest';
import { SECTION_META, GROUPS, groupOf, metaById } from '../src/web/sections';

describe('sidebar taxonomy', () => {
  it('every section belongs to exactly one group', () => {
    for (const m of SECTION_META) {
      const groups = GROUPS.filter((g) => g.ids.includes(m.id));
      expect(groups, `section ${m.id}`).toHaveLength(1);
    }
  });

  it('every grouped id is a real section (no typos / stale ids)', () => {
    for (const g of GROUPS) {
      for (const id of g.ids) expect(metaById[id], `group ${g.label} id ${id}`).toBeDefined();
    }
  });

  it('the groups cover all sections with no extras', () => {
    const grouped = GROUPS.flatMap((g) => g.ids).sort();
    const all = SECTION_META.map((m) => m.id).sort();
    expect(grouped).toEqual(all);
  });

  it('groupOf returns the right category', () => {
    expect(groupOf('network')).toBe('Network basics');
    expect(groupOf('raft')).toBe('Distributed systems');
    expect(groupOf('crypto')).toBe('Security & crypto');
    expect(groupOf('nonexistent')).toBeNull();
  });
});
