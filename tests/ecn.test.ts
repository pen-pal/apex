import { describe, it, expect } from 'vitest';
import { routerHandle, runFlow, isECT } from '../src/web/ecn';

describe('ECN codepoints & router behaviour (RFC 3168)', () => {
  it('classifies ECN-capable codepoints', () => {
    expect(isECT('ECT(0)')).toBe(true);
    expect(isECT('ECT(1)')).toBe(true);
    expect(isECT('Not-ECT')).toBe(false);
    expect(isECT('CE')).toBe(false);
  });
  it('a congested router MARKS an ECN-capable packet instead of dropping', () => {
    const d = routerHandle('ECT(0)', true);
    expect(d.action).toBe('mark');
    expect(d.codepoint).toBe('CE'); // ECT → CE
  });
  it('a congested router DROPS a non-ECN packet (no other signal)', () => {
    expect(routerHandle('Not-ECT', true).action).toBe('drop');
  });
  it('forwards when uncongested, and leaves an already-CE packet alone', () => {
    expect(routerHandle('ECT(0)', false).action).toBe('forward');
    expect(routerHandle('CE', true).action).toBe('forward'); // already marked upstream
  });
});

describe('ECN vs drop-based congestion control — same backoff, no loss', () => {
  const N = 40, every = 8;
  const withEcn = runFlow(N, every, true);
  const noEcn = runFlow(N, every, false);

  it('ECN never drops a packet — congestion is signalled by marks', () => {
    expect(withEcn.drops).toBe(0);
    expect(withEcn.retransmits).toBe(0);
    expect(withEcn.marks).toBeGreaterThan(0);
    expect(withEcn.delivered).toBe(N); // everything gets through
  });
  it('the non-ECN flow drops packets and must retransmit them', () => {
    expect(noEcn.drops).toBeGreaterThan(0);
    expect(noEcn.retransmits).toBe(noEcn.drops);
    expect(noEcn.delivered).toBe(N - noEcn.drops);
  });
  it('both back off the same amount — ECN just avoids the loss penalty', () => {
    expect(withEcn.cwndHalvings).toBe(noEcn.cwndHalvings); // identical congestion response
    expect(withEcn.marks).toBe(noEcn.drops); // a mark stands in for each drop
  });
});
