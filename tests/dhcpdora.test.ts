import { describe, it, expect } from 'vitest';
import { doraMessages, leaseTimers, leasePhaseAt, renewMessages } from '../src/web/dhcp';

describe('DORA exchange (RFC 2131 §3.1)', () => {
  const msgs = doraMessages('192.168.1.50', '192.168.1.1', 86400);
  it('is the four messages in order, alternating client/server', () => {
    expect(msgs.map((m) => m.type)).toEqual(['DISCOVER', 'OFFER', 'REQUEST', 'ACK']);
    expect(msgs.map((m) => m.from)).toEqual(['client', 'server', 'client', 'server']);
  });
  it('DISCOVER and the selecting REQUEST broadcast; OFFER/ACK unicast by default (RFC 2131 §4.1)', () => {
    // with the broadcast flag clear (default), the server unicasts OFFER and ACK
    expect(msgs.map((m) => m.broadcast)).toEqual([true, false, true, false]);
  });
  it('OFFER/ACK broadcast only when the client sets the broadcast flag', () => {
    const bMsgs = doraMessages('192.168.1.50', '192.168.1.1', 86400, true);
    expect(bMsgs.map((m) => m.broadcast)).toEqual([true, true, true, true]);
  });
  it('DISCOVER carries no address; OFFER/REQUEST/ACK carry the offered IP', () => {
    expect(msgs[0].yourIp).toBeNull();
    expect(msgs.slice(1).every((m) => m.yourIp === '192.168.1.50')).toBe(true);
  });
});

describe('lease timers (RFC 2131 §4.4.5)', () => {
  it('T1 = 50% and T2 = 87.5% of the lease', () => {
    const t = leaseTimers(86400); // 24h
    expect(t.t1).toBe(43200); // 12h
    expect(t.t2).toBe(75600); // 21h
    expect(t.expiry).toBe(86400);
  });
});

describe('lease phase over time', () => {
  const t = leaseTimers(1000); // T1=500, T2=875, expiry=1000
  it('walks bound → renewing → rebinding → expired', () => {
    expect(leasePhaseAt(0, t)).toBe('bound');
    expect(leasePhaseAt(499, t)).toBe('bound');
    expect(leasePhaseAt(500, t)).toBe('renewing'); // T1
    expect(leasePhaseAt(874, t)).toBe('renewing');
    expect(leasePhaseAt(875, t)).toBe('rebinding'); // T2
    expect(leasePhaseAt(999, t)).toBe('rebinding');
    expect(leasePhaseAt(1000, t)).toBe('expired');
  });
});

describe('renewal at T1', () => {
  const r = renewMessages('192.168.1.50', '192.168.1.1', 86400);
  it('is a UNICAST Request→Ack (no broadcast — the client still has its address)', () => {
    expect(r.map((m) => m.type)).toEqual(['REQUEST', 'ACK']);
    expect(r.every((m) => m.broadcast === false)).toBe(true);
    expect(r[0].from).toBe('client');
    expect(r[1].from).toBe('server');
  });
});
