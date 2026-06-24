import { describe, it, expect } from 'vitest';
import { handshake, statePath } from '../src/web/tcphandshake';

// ISNs chosen for easy arithmetic; SYN and FIN each consume one sequence number.
const C = 1000, S = 5000;
const segs = handshake(C, S);
const at = (n: number) => segs[n];

describe('three-way handshake seq/ack arithmetic (RFC 9293)', () => {
  it('SYN carries the client ISN', () => {
    expect(at(0).flags).toEqual(['SYN']);
    expect(at(0).seq).toBe(1000);
  });
  it('SYN-ACK carries the server ISN and acks c+1', () => {
    expect(at(1).flags).toEqual(['SYN', 'ACK']);
    expect(at(1).seq).toBe(5000);
    expect(at(1).ack).toBe(1001); // SYN consumed one number
  });
  it('the final ACK uses c+1 and acks s+1', () => {
    expect(at(2).flags).toEqual(['ACK']);
    expect(at(2).seq).toBe(1001);
    expect(at(2).ack).toBe(5001);
    expect(at(2).clientState).toBe('ESTABLISHED');
    expect(at(2).serverState).toBe('ESTABLISHED');
  });
});

describe('connection teardown', () => {
  it("client's FIN and the acks advance correctly (FIN consumes a number)", () => {
    expect(at(3).flags).toEqual(['FIN', 'ACK']);     // client FIN, seq c+1
    expect(at(3).seq).toBe(1001);
    expect(at(4).ack).toBe(1002);                    // server acks the FIN → c+2
    expect(at(5).flags).toEqual(['FIN', 'ACK']);     // server FIN, seq s+1
    expect(at(5).seq).toBe(5001);
    expect(at(6).seq).toBe(1002);
    expect(at(6).ack).toBe(5002);                    // client acks server FIN → s+2
  });

  it('ends in the half-open closing states', () => {
    expect(at(6).clientState).toBe('TIME_WAIT');
    expect(at(6).serverState).toBe('CLOSED');
  });
});

describe('state machine paths', () => {
  it('client walks the active-open / active-close path', () => {
    expect(statePath(segs, 'client')).toEqual([
      'CLOSED', 'SYN_SENT', 'ESTABLISHED', 'FIN_WAIT_1', 'FIN_WAIT_2', 'TIME_WAIT', 'CLOSED',
    ]);
  });
  it('server walks the passive-open / passive-close path', () => {
    expect(statePath(segs, 'server')).toEqual([
      'CLOSED', 'LISTEN', 'SYN_RCVD', 'ESTABLISHED', 'CLOSE_WAIT', 'LAST_ACK', 'CLOSED',
    ]);
  });
});
