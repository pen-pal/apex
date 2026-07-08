import { describe, it, expect } from 'vitest';
import { formatValue } from '../src/web/playground';

// Independent oracle: how a console renders values. Expected strings are written by hand from those rules (primitives
// as-is, arrays in brackets, objects in braces, cycles marked), not derived from the implementation. runJs itself is
// browser-only (Web Worker) and is verified by running real code in the UI.

describe('formatValue — console-style rendering', () => {
  it('primitives', () => {
    expect(formatValue(6)).toBe('6');
    expect(formatValue(-3)).toBe('-3');
    expect(formatValue('hi')).toBe('hi');
    expect(formatValue(true)).toBe('true');
    expect(formatValue(null)).toBe('null');
    expect(formatValue(undefined)).toBe('undefined');
    expect(formatValue(10n)).toBe('10');
  });
  it('arrays', () => {
    expect(formatValue([-2, 1, -3, 4, -1, 2, 1, -5, 4])).toBe('[-2, 1, -3, 4, -1, 2, 1, -5, 4]');
    expect(formatValue([])).toBe('[]');
    expect(formatValue(['a', 'b'])).toBe('[a, b]');
  });
  it('objects and nesting', () => {
    expect(formatValue({ a: 1, b: 'x' })).toBe('{ a: 1, b: x }');
    expect(formatValue([{ a: 1 }, [2, 3]])).toBe('[{ a: 1 }, [2, 3]]');
  });
  it('functions', () => {
    expect(formatValue(function foo() {})).toBe('[Function: foo]');
    expect(formatValue(() => {})).toMatch(/\[Function/);
  });
  it('circular references do not blow the stack', () => {
    const o: Record<string, unknown> = { a: 1 };
    o.self = o;
    expect(formatValue(o)).toBe('{ a: 1, self: [Circular] }');
  });
});
