import { describe, it, expect } from 'vitest';
import { runAssoc, handshake, type SctpConfig, type SctpEvent } from '../src/web/sctp';

// Thresholds are kept small but the RULES are RFC 9260's (formerly RFC 4960): a path goes INACTIVE
// when its error counter EXCEEDS Path.Max.Retrans (§8.2/8.3); the association fails when the overall
// counter EXCEEDS Association.Max.Retrans (§8.1); an ACK clears the counters (§8.1).
const cfg = (pmr: number, amr: number): SctpConfig => ({
  paths: [{ id: 'A', addr: '203.0.113.1' }, { id: 'B', addr: '198.51.100.1' }],
  pathMaxRetrans: pmr,
  assocMaxRetrans: amr,
});
const T = (path: string): SctpEvent => ({ type: 'timeout', path });
const K = (path: string): SctpEvent => ({ type: 'ack', path });

describe('SCTP multi-homing failover (RFC 9260 §8)', () => {
  it('keeps a path ACTIVE until its error count EXCEEDS Path.Max.Retrans, then fails over', () => {
    // PMR=3: 3 timeouts leave A active (3 is not > 3); the 4th (errors=4>3) marks A inactive → failover to B.
    const r = runAssoc(cfg(3, 20), [T('A'), T('A'), T('A'), T('A')]);
    expect(r.steps[2].current).toBe('A'); // after 3 timeouts, still on A
    expect(r.steps[2].states.find((s) => s.id === 'A')!.active).toBe(true);
    expect(r.steps[3].current).toBe('B'); // 4th timeout triggers failover
    expect(r.steps[3].failedOver).toBe(true);
    expect(r.failovers).toBe(1);
    expect(r.finalAssoc).toBe('ESTABLISHED'); // association survived the path failure — TCP could not
    expect(r.endPath).toBe('B');
  });

  it('an ACK on the recovered primary clears its counter and fails BACK (primary-preferred)', () => {
    const r = runAssoc(cfg(3, 20), [T('A'), T('A'), T('A'), T('A'), K('A')]);
    expect(r.steps[3].current).toBe('B'); // failed over to B
    const last = r.steps[4];
    expect(last.current).toBe('A'); // A healthy again → primary preference brings us back
    expect(last.states.find((s) => s.id === 'A')!.active).toBe(true);
    expect(last.assocErrors).toBe(0); // the ACK reset the association error counter
    expect(r.failovers).toBe(2); // A→B then B→A
  });

  it('tears the association DOWN once total errors EXCEED Association.Max.Retrans', () => {
    // AMR=3, PMR high so no single path is condemned first: the 4th total timeout (errors=4>3) kills it.
    const r = runAssoc(cfg(20, 3), [T('A'), T('B'), T('A'), T('B')]);
    expect(r.steps[2].assoc).toBe('ESTABLISHED'); // 3 errors, still up
    expect(r.steps[3].assoc).toBe('DOWN'); // 4th error exceeds AMR=3
    expect(r.finalAssoc).toBe('DOWN');
    expect(r.endPath).toBe(null);
  });

  it('a healthy ACK resets the path counter so transient losses never escalate', () => {
    const r = runAssoc(cfg(3, 20), [T('A'), T('A'), K('A'), T('A'), T('A')]);
    const a = r.steps[4].states.find((s) => s.id === 'A')!;
    expect(a.errors).toBe(2); // counter was cleared by the ACK, so two more timeouts only reach 2
    expect(a.active).toBe(true);
    expect(r.failovers).toBe(0); // never had to leave A
  });
});

describe('SCTP 4-way cookie handshake (RFC 9260 §5.1)', () => {
  const h = handshake();
  it('is INIT → INIT-ACK → COOKIE-ECHO → COOKIE-ACK', () => {
    expect(h.map((c) => c.chunk)).toEqual(['INIT', 'INIT-ACK', 'COOKIE-ECHO', 'COOKIE-ACK']);
    expect(h.map((c) => c.from)).toEqual(['client', 'server', 'client', 'server']);
  });
  it('defers server state until the cookie is echoed (the SYN-flood defense)', () => {
    expect(h[1].note).toMatch(/allocates NO memory/i); // INIT-ACK: no state yet
    expect(h[1].carries).toMatch(/cookie/i);
    expect(h[3].note).toMatch(/builds the TCB|ESTABLISHED/i); // state created only at COOKIE-ACK
  });
});
