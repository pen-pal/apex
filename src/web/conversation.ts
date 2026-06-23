// Derive the live seq/ack numbers for each step of a conversation, given the
// real payload length. Relative to each side's ISN (= 0), exactly as a sequence
// diagram shows them. Pure and testable; the lifecycle view renders these.
//   SYN and FIN each consume one sequence number; a data segment consumes its
//   payload length; a pure ACK consumes none. A sender's ack = the next byte it
//   expects from the peer (the peer's current sequence position).
import type { ConversationStep } from '../core/types';

export interface SeqPoint {
  seq: number;
  ack: number;
  ackValid: boolean; // is the ACK field meaningful (ACK flag set)?
  payload: number; // bytes of application data this segment carries
}

const peer = (from: 'client' | 'server') => (from === 'client' ? 'server' : 'client');

export function sequenceTrace(steps: ConversationStep[], payloadLen: number): SeqPoint[] {
  const next: Record<'client' | 'server', number> = { client: 0, server: 0 };
  return steps.map((s) => {
    const seq = next[s.from];
    const ack = next[peer(s.from)];
    const ackValid = !!s.flags && /ack/i.test(s.flags);
    const payload = s.advance === 'data' ? payloadLen : 0;
    const consume = s.advance === 'syn' || s.advance === 'fin' ? 1 : s.advance === 'data' ? payloadLen : 0;
    next[s.from] += consume;
    return { seq, ack, ackValid, payload };
  });
}
