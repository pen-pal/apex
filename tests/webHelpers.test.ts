import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { registerCoreProtocols } from '../src/protocols';
import { buildFrame } from '../src/core/builder';
import { dissect } from '../src/core/engine';
import { encodePayload } from '../src/web/payload';
import { findHeaderChecksum, checksumWalk } from '../src/web/checksumWalk';
import { walkStates, TCP_CLIENT_LIFECYCLE } from '../src/web/stateWalk';
import { sequenceTrace } from '../src/web/conversation';
import { buildConnection, DEFAULT_FORM, flagsByte } from '../src/web/connectionForm';
import { tcpStateMachine, tcpHandshake } from '../src/protocols/tcp';

describe('encodePayload', () => {
  it('encodes text as UTF-8', () => {
    expect(encodePayload('443', 'text').bytes).toEqual([0x34, 0x34, 0x33]);
  });
  it('packs non-negative numbers big-endian unsigned', () => {
    expect(encodePayload('443', 'number').bytes).toEqual([0x01, 0xbb]);
    expect(encodePayload('0', 'number').bytes).toEqual([0]);
  });
  it('packs negative numbers as minimal-width twos complement', () => {
    expect(encodePayload('-1', 'number').bytes).toEqual([0xff]);
    expect(encodePayload('-128', 'number').bytes).toEqual([0x80]);
    expect(encodePayload('-129', 'number').bytes).toEqual([0xff, 0x7f]);
    expect(encodePayload('-200', 'number').bytes).toEqual([0xff, 0x38]);
  });
  it('rejects non-integers in number mode', () => {
    expect(encodePayload('4.5', 'number').error).toBeTruthy();
    expect(encodePayload('abc', 'number').error).toBeTruthy();
  });
});

function frameTree(message: string) {
  const registry = new ProtocolRegistry();
  registerCoreProtocols(registry);
  const frame = buildFrame([...new TextEncoder().encode(message)], registry);
  return dissect(frame.bytes, 'ethernet', registry);
}

describe('checksumWalk', () => {
  it('finds the IPv4 header checksum layer and recomputes it to match the stored value', () => {
    const target = findHeaderChecksum(frameTree('Hi'));
    expect(target).not.toBeNull();
    expect(target!.layerName).toBe('IPv4');
    expect(target!.headerBytes.length).toBe(20);
    const walk = checksumWalk(target!);
    expect(walk.steps.length).toBe(10); // 20-byte header = ten 16-bit words
    expect(walk.ok).toBe(true); // recomputed === stored
    expect(walk.result).toBe(walk.stored);
  });
});

describe('buildConnection', () => {
  it('parses valid fields into a Connection', () => {
    const { conn, errors } = buildConnection({
      ...DEFAULT_FORM, srcIp: '10.0.0.1', dstIp: '8.8.8.8', dstPort: '443', ttl: '32', window: '1024',
    });
    expect(Object.keys(errors)).toHaveLength(0);
    expect(conn.srcIp).toEqual([10, 0, 0, 1]);
    expect(conn.dstIp).toEqual([8, 8, 8, 8]);
    expect(conn.dstPort).toBe(443);
    expect(conn.ttl).toBe(32);
    expect(conn.window).toBe(1024);
  });
  it('flags the bad fields and falls back to defaults', () => {
    const { conn, errors } = buildConnection({ ...DEFAULT_FORM, srcIp: '999.1.1.1', ttl: '0', dstPort: '70000' });
    expect(errors.srcIp).toBeTruthy();
    expect(errors.ttl).toBeTruthy(); // 0 is out of 1–255
    expect(errors.dstPort).toBeTruthy();
    expect(conn.ttl).toBe(64); // default fallback
  });
  it('packs the TCP flags byte (CWR ECE URG ACK PSH RST SYN FIN)', () => {
    expect(flagsByte({ SYN: true, ACK: true, PSH: false, RST: false, FIN: false })).toBe(0x12);
    expect(flagsByte({ SYN: false, ACK: true, PSH: true, RST: false, FIN: false })).toBe(0x18);
    expect(flagsByte({ SYN: false, ACK: false, PSH: false, RST: false, FIN: true })).toBe(0x01);
  });
});

describe('sequenceTrace', () => {
  it('derives the canonical seq/ack evolution for a 13-byte payload', () => {
    const t = sequenceTrace(tcpHandshake.steps, 13);
    // SYN, SYN-ACK, ACK, PSH(data 13), ACK, FIN, ACK, FIN, ACK
    expect(t.map((p) => p.seq)).toEqual([0, 0, 1, 1, 1, 14, 1, 1, 15]);
    expect(t.map((p) => p.ack)).toEqual([0, 1, 1, 1, 14, 1, 15, 15, 2]);
    expect(t[0].ackValid).toBe(false); // bare SYN has no ACK
    expect(t[3].payload).toBe(13); // the data segment
  });
  it('reflects the live payload length', () => {
    const t = sequenceTrace(tcpHandshake.steps, 2);
    expect(t[3].payload).toBe(2);
    expect(t[4].ack).toBe(3); // server acks 1 + 2 bytes
    expect(t[5].seq).toBe(3); // client FIN after 2 data bytes
  });
});

describe('walkStates', () => {
  it('follows the TCP client lifecycle through real transitions', () => {
    const steps = walkStates(tcpStateMachine, TCP_CLIENT_LIFECYCLE);
    expect(steps.map((s) => s.state)).toEqual([
      'CLOSED', 'SYN_SENT', 'ESTABLISHED', 'FIN_WAIT_1', 'FIN_WAIT_2', 'TIME_WAIT', 'CLOSED',
    ]);
    // every event resolved to a real next state (no dead ends)
    expect(steps.slice(0, -1).every((s) => s.next !== null)).toBe(true);
  });
});
