// Nagle's algorithm (RFC 896) and delayed ACK (RFC 1122) — and the notorious stall when the
// two meet. Nagle fights the "tinygram" problem: if you have unacknowledged data in flight,
// don't send another *sub-MSS* segment — buffer it until either you've accumulated a full MSS
// or all outstanding data is ACKed. Delayed ACK does the dual thing on the receiver: don't ACK
// a lone segment immediately; wait up to a timer (RFC 1122: ≤500 ms, commonly 40–200 ms) hoping
// to piggyback the ACK on reply data or to ACK two segments at once. Each is a fine idea alone.
// Together, in a write-write-read pattern, they deadlock: the sender holds the second small
// segment waiting for an ACK, while the receiver holds the ACK waiting for a second segment.
// Nobody moves until the receiver's delayed-ACK timer fires — a 40–200 ms stall on an otherwise
// instant exchange. Honest discrete-event timing model (one-way delay = RTT/2), tested.

export interface NagleConfig {
  writes: number[]; // application write() sizes (bytes), issued back-to-back as separate syscalls
  mss: number; // maximum segment size (payload bytes per segment)
  rttMs: number; // round-trip time; one-way delay = rttMs / 2
  nagle: boolean; // Nagle's algorithm enabled on the sender (TCP_NODELAY off)
  delayedAck: boolean; // delayed ACK enabled on the receiver
  delayedAckMs: number; // delayed-ACK timer
}

export interface NagleEvent {
  kind: 'send' | 'deliver' | 'ack' | 'ack-recv'; // send=segment leaves sender, deliver=arrives at receiver,
  t: number; //                                     ack=receiver emits ACK, ack-recv=ACK reaches sender
  seg: number; // segment number (1-based) for send/deliver; for ack* the cumulative bytes acked
  bytes: number; // payload bytes (send/deliver) or bytes-acked (ack/ack-recv)
  reason?: string; // why this segment was sent now (only on 'send')
}

export interface NagleResult {
  events: NagleEvent[];
  segments: number; // how many TCP segments carried the payload
  bytes: number; // total payload bytes
  completionMs: number; // when the last byte was ACKed back to the sender
  stalledMs: number; // total wall-clock the sender spent Nagle-blocked with data waiting to go
  stalls: { from: number; to: number }[]; // the exact intervals the sender was Nagle-blocked
}

/** Simulate the exchange and return the segment/ACK timeline. */
export function simulate(cfg: NagleConfig): NagleResult {
  const { mss, nagle, delayedAck, delayedAckMs } = cfg;
  const owd = cfg.rttMs / 2;
  const totalBytes = cfg.writes.reduce((a, b) => a + b, 0);

  // sender state
  let buffer = 0; // bytes accepted from the app but not yet sent
  let sentBytes = 0; // cumulative payload sent
  let ackedBytes = 0; // cumulative payload ACKed
  let segNo = 0; // segments emitted so far
  let heldSince: number | null = null; // when the sender first started Nagle-holding the current data
  let stalledMs = 0;
  const stalls: { from: number; to: number }[] = [];

  // receiver state
  let delivered = 0; // cumulative bytes delivered to the receiver
  let pending = 0; // delivered-but-not-yet-ACKed segments
  let ackGen = 0; // generation counter to invalidate superseded delayed-ACK timers

  const events: NagleEvent[] = [];
  let completionMs = 0;

  // event queue with stable (t, seq) ordering
  type Ev =
    | { t: number; seq: number; type: 'write'; bytes: number }
    | { t: number; seq: number; type: 'deliver'; seg: number; bytes: number }
    | { t: number; seq: number; type: 'ackTimer'; gen: number }
    | { t: number; seq: number; type: 'ackRecv'; ackTo: number };
  const q: Ev[] = [];
  let seq = 0;
  type NoSeq<T> = T extends unknown ? Omit<T, 'seq'> : never; // distribute Omit over the union
  const push = (e: NoSeq<Ev>) => q.push({ ...e, seq: seq++ } as Ev);

  cfg.writes.forEach((w) => push({ t: 0, type: 'write', bytes: w }));

  const outstanding = () => sentBytes - ackedBytes;

  const updateHold = (now: number) => {
    const holding = nagle && buffer > 0 && outstanding() > 0; // (buffer<mss here, else it'd have been sent)
    if (holding && heldSince === null) heldSince = now;
    else if (!holding && heldSince !== null) {
      if (now > heldSince) {
        stalledMs += now - heldSince;
        stalls.push({ from: heldSince, to: now });
      }
      heldSince = null;
    }
  };

  const sendSeg = (now: number, n: number, reason: string) => {
    segNo += 1;
    buffer -= n;
    sentBytes += n;
    events.push({ kind: 'send', t: now, seg: segNo, bytes: n, reason });
    push({ t: now + owd, type: 'deliver', seg: segNo, bytes: n });
  };

  const flush = (now: number) => {
    while (buffer > 0) {
      if (!nagle) {
        sendSeg(now, Math.min(buffer, mss), 'sent immediately (Nagle disabled)');
      } else if (buffer >= mss) {
        sendSeg(now, mss, 'full MSS — Nagle always ships full-sized segments');
      } else if (outstanding() === 0) {
        sendSeg(now, buffer, heldSince !== null ? 'all prior data ACKed — Nagle releases the held segment' : 'no unacknowledged data in flight — small send allowed');
      } else {
        break; // sub-MSS with data in flight → Nagle holds it
      }
    }
    updateHold(now);
  };

  const ackNow = (now: number) => {
    ackGen += 1; // supersede any pending timer
    pending = 0;
    events.push({ kind: 'ack', t: now, seg: delivered, bytes: delivered - ackedBytes });
    push({ t: now + owd, type: 'ackRecv', ackTo: delivered });
  };

  let guard = 0;
  while (q.length && guard++ < 100000) {
    q.sort((a, b) => a.t - b.t || a.seq - b.seq);
    const e = q.shift()!;
    switch (e.type) {
      case 'write':
        buffer += e.bytes;
        flush(e.t);
        break;
      case 'deliver':
        delivered += e.bytes;
        pending += 1;
        if (!delayedAck) ackNow(e.t);
        else if (pending >= 2) ackNow(e.t); // 2nd outstanding segment → ACK immediately (RFC 1122)
        else push({ t: e.t + delayedAckMs, type: 'ackTimer', gen: ackGen }); // arm the timer
        break;
      case 'ackTimer':
        if (e.gen === ackGen && pending > 0) ackNow(e.t);
        break;
      case 'ackRecv':
        ackedBytes = e.ackTo;
        events.push({ kind: 'ack-recv', t: e.t, seg: ackedBytes, bytes: 0 });
        if (ackedBytes >= totalBytes) completionMs = e.t;
        flush(e.t); // an ACK may let Nagle release held data
        break;
    }
  }

  return { events, segments: segNo, bytes: totalBytes, completionMs, stalledMs, stalls };
}

/** A few teaching presets. */
export const PRESETS: { id: string; label: string; writes: number[]; note: string }[] = [
  { id: 'ww', label: 'write-write-read (50 B + 50 B)', writes: [50, 50], note: 'The classic stall: a header then a body as two small writes.' },
  { id: 'keystroke', label: 'telnet keystrokes (1 B ×5)', writes: [1, 1, 1, 1, 1], note: 'Tinygrams — Nagle coalesces them; without it each is a 41-byte packet for 1 byte.' },
  { id: 'bulk', label: 'bulk send (4000 B)', writes: [4000], note: 'Nagle ships full MSS segments instantly and only holds the sub-MSS tail.' },
];
