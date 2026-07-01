import { describe, it, expect } from 'vitest';
import { connect, safeForEarlyData, replay } from '../src/web/zerortt';

describe('handshake modes & round trips', () => {
  it('a full handshake is 1 RTT to first byte, no ticket, no early data', () => {
    expect(connect('full', false)).toEqual({ mode: 'full', rttToFirstByte: 1, usesTicket: false, earlyData: false, replayable: false });
  });
  it('0-RTT with a ticket sends early data at 0 RTT — and it is replayable', () => {
    expect(connect('0rtt', true)).toEqual({ mode: '0rtt', rttToFirstByte: 0, usesTicket: true, earlyData: true, replayable: true });
  });
  it('plain resumption is 1 RTT, uses the ticket, but sends NO early data (not replayable)', () => {
    expect(connect('resume', true)).toMatchObject({ mode: 'resume', rttToFirstByte: 1, earlyData: false, replayable: false });
  });
  it('0-RTT / resume without a ticket fall back to a full handshake', () => {
    expect(connect('0rtt', false).mode).toBe('full');
    expect(connect('0rtt', false).earlyData).toBe(false);
    expect(connect('resume', false).mode).toBe('full');
  });
  it('0-RTT saves the round trip a full handshake pays', () => {
    expect(connect('0rtt', true).rttToFirstByte).toBeLessThan(connect('full', false).rttToFirstByte);
  });
});

describe('which requests are safe in early data', () => {
  it('idempotent/safe methods only', () => {
    for (const m of ['GET', 'HEAD', 'OPTIONS', 'get']) expect(safeForEarlyData(m)).toBe(true);
    for (const m of ['POST', 'PUT', 'DELETE', 'PATCH']) expect(safeForEarlyData(m)).toBe(false);
  });
});

describe('the replay problem', () => {
  it('a replayed idempotent GET has the same single effect no matter how many times it lands', () => {
    expect(replay('GET', 5)).toEqual({ deliveries: 5, logicalEffects: 1, harmful: false });
  });
  it('a replayed non-idempotent POST applies once PER delivery — the double-charge bug', () => {
    expect(replay('POST', 3)).toEqual({ deliveries: 3, logicalEffects: 3, harmful: true });
  });
  it('a POST delivered once is fine — the harm is only in the DUPLICATE', () => {
    expect(replay('POST', 1)).toMatchObject({ logicalEffects: 1, harmful: false });
  });
  it('zero deliveries → no effect', () => {
    expect(replay('GET', 0).logicalEffects).toBe(0);
  });
});
