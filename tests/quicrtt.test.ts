import { describe, it, expect } from 'vitest';
import { tcpTls, quic1Rtt, quic0Rtt, allScenarios, headOfLine } from '../src/web/quic';

describe('round trips to first application data', () => {
  it('TCP+TLS 1.3 needs 2 RTTs (TCP handshake then TLS)', () => {
    const s = tcpTls();
    expect(s.rttToFirstData).toBe(2);
    const appMsg = s.messages.find((m) => m.appData)!;
    expect(appMsg.rtt).toBe(2);
    expect(appMsg.label).toContain('GET /');
  });
  it('QUIC 1-RTT halves it to 1 (combined transport+crypto)', () => {
    const s = quic1Rtt();
    expect(s.rttToFirstData).toBe(1);
    expect(s.messages.find((m) => m.appData)!.rtt).toBe(1);
  });
  it('QUIC 0-RTT sends data in the first packet (0 RTTs of waiting)', () => {
    const s = quic0Rtt();
    expect(s.rttToFirstData).toBe(0);
    const first = s.messages[0];
    expect(first.appData).toBe(true);
    expect(first.from).toBe('client');
    expect(first.rtt).toBe(0);
  });
  it('the three scenarios strictly improve: 2 > 1 > 0', () => {
    const rtts = allScenarios().map((s) => s.rttToFirstData);
    expect(rtts).toEqual([2, 1, 0]);
  });
  it('every scenario marks exactly one first-app-data message', () => {
    for (const s of allScenarios()) expect(s.messages.filter((m) => m.appData)).toHaveLength(1);
  });
  it('messages stay within the RTT budget', () => {
    for (const s of allScenarios()) {
      const maxRtt = Math.max(...s.messages.map((m) => m.rtt));
      expect(maxRtt).toBe(s.rttToFirstData);
    }
  });
});

describe('transport-layer head-of-line blocking', () => {
  const streams = [1, 2, 3, 4];
  it('TCP stalls EVERY stream when one packet is lost', () => {
    const r = headOfLine('TCP', streams, 2);
    expect(r.stalledStreams).toEqual([1, 2, 3, 4]); // all of them wait
  });
  it('QUIC stalls only the stream that lost a packet', () => {
    const r = headOfLine('QUIC', streams, 2);
    expect(r.stalledStreams).toEqual([2]); // only stream 2
  });
});
