// Chandy-Lamport global snapshot (Chandy & Lamport, 1985: "Distributed Snapshots: Determining
// Global States of Distributed Systems"). How do you photograph the global state of a distributed
// system with no shared clock, without freezing everything? You can't read every process and every
// in-flight message at one instant. Chandy-Lamport gets a *consistent* state — one that could have
// occurred — using marker messages over FIFO channels:
//   • An initiator records its own state, then sends a MARKER on every outgoing channel.
//   • When a process first sees a MARKER (on channel c): it records its own state, records c's
//     channel state as EMPTY, sends MARKERs on all its outgoing channels, and starts recording
//     every OTHER incoming channel.
//   • When an already-recorded process sees a MARKER on c: it stops recording c — c's recorded
//     state is exactly the messages that arrived on c after this process recorded itself.
// We use the classic distributed-bank framing (money moving between accounts over channels) because
// it makes the guarantee checkable: the recorded snapshot — process balances PLUS the money caught
// in-flight in the channels — must conserve the total. A naive read of just the balances would lose
// the in-flight money. Honest event-driven model over FIFO channels, tested against that invariant.

export type ChItem = { kind: 'money'; amount: number } | { kind: 'marker' };

export type SnapEvent =
  | { type: 'send'; from: string; to: string; amount: number } // `from` sends money into channel from→to
  | { type: 'recv'; from: string; to: string } //                 `to` consumes the head of channel from→to
  | { type: 'init'; p: string }; //                               process p initiates the snapshot

export interface Scenario {
  processes: { id: string; balance: number }[];
  channels: [string, string][]; // directed FIFO channels [from, to]
  events: SnapEvent[];
}

export interface Step {
  n: number;
  tag: 'send' | 'recv-money' | 'recv-marker' | 'init';
  desc: string;
  balances: Record<string, number>; // live balances after this step
  queues: Record<string, ChItem[]>; // live channel contents (in-flight) after this step
  recorded: Record<string, boolean>; // which processes have recorded their state
  recordedBalance: Record<string, number | null>;
  chMsgs: Record<string, number[]>; // money recorded as channel state so far
}

export interface SnapResult {
  steps: Step[];
  complete: boolean; // every process recorded and every channel's marker consumed
  recordedBalance: Record<string, number>;
  chMsgs: Record<string, number[]>; // final recorded channel state (in-flight money) per channel
  snapshotTotal: number; // recorded balances + recorded channel money
  naiveTotal: number; // recorded balances only (what you'd get if you ignored channel state)
  initialTotal: number;
  conserved: boolean; // snapshotTotal === initialTotal  ← the Chandy-Lamport guarantee
}

const key = (from: string, to: string) => `${from}->${to}`;

export function run(s: Scenario): SnapResult {
  const balance: Record<string, number> = {};
  s.processes.forEach((p) => (balance[p.id] = p.balance));
  const initialTotal = s.processes.reduce((a, p) => a + p.balance, 0);

  const queue: Record<string, ChItem[]> = {};
  const chMsgs: Record<string, number[]> = {};
  const recording: Record<string, boolean> = {};
  const markerSeen: Record<string, boolean> = {};
  s.channels.forEach(([f, t]) => {
    queue[key(f, t)] = [];
    chMsgs[key(f, t)] = [];
    recording[key(f, t)] = false;
    markerSeen[key(f, t)] = false;
  });

  const recorded: Record<string, boolean> = {};
  const recordedBalance: Record<string, number | null> = {};
  s.processes.forEach((p) => { recorded[p.id] = false; recordedBalance[p.id] = null; });

  const outgoing = (p: string) => s.channels.filter(([f]) => f === p);
  const incoming = (p: string) => s.channels.filter(([, t]) => t === p);

  const recordState = (p: string) => { recorded[p] = true; recordedBalance[p] = balance[p]; };
  const sendMarkers = (p: string) => outgoing(p).forEach(([f, t]) => queue[key(f, t)].push({ kind: 'marker' }));

  const steps: Step[] = [];
  const snap = (tag: Step['tag'], desc: string) => {
    steps.push({
      n: steps.length + 1, tag, desc,
      balances: { ...balance },
      queues: Object.fromEntries(Object.entries(queue).map(([k, v]) => [k, v.map((i) => ({ ...i }))])),
      recorded: { ...recorded },
      recordedBalance: { ...recordedBalance },
      chMsgs: Object.fromEntries(Object.entries(chMsgs).map(([k, v]) => [k, [...v]])),
    });
  };

  for (const e of s.events) {
    if (e.type === 'send') {
      balance[e.from] -= e.amount;
      queue[key(e.from, e.to)].push({ kind: 'money', amount: e.amount });
      snap('send', `${e.from} sends $${e.amount} → ${e.to} (now in flight on ${key(e.from, e.to)})`);
    } else if (e.type === 'init') {
      recordState(e.p);
      incoming(e.p).forEach(([f, t]) => (recording[key(f, t)] = true)); // record all inbound channels
      sendMarkers(e.p);
      snap('init', `${e.p} INITIATES: records its state ($${balance[e.p]}) and sends a marker on every outgoing channel`);
    } else {
      const k = key(e.from, e.to);
      const item = queue[k].shift();
      if (!item) { snap('recv-money', `${e.to} tried to read ${k} but it was empty`); continue; }
      if (item.kind === 'money') {
        balance[e.to] += item.amount;
        const captured = recorded[e.to] && recording[k];
        if (captured) chMsgs[k].push(item.amount);
        snap('recv-money', `${e.to} receives $${item.amount} on ${k}${captured ? ` — CAPTURED as channel state (it was in flight across the cut)` : ''}`);
      } else {
        if (!recorded[e.to]) {
          recordState(e.to);
          markerSeen[k] = true; recording[k] = false; // first marker ⇒ this channel records empty
          incoming(e.to).forEach(([f, t]) => { if (key(f, t) !== k) recording[key(f, t)] = true; });
          sendMarkers(e.to);
          snap('recv-marker', `${e.to} sees its FIRST marker (on ${k}): records its state ($${balance[e.to]}), marks ${k} empty, forwards markers, starts recording its other inbound channels`);
        } else {
          markerSeen[k] = true; recording[k] = false; // finalize this channel's recorded state
          snap('recv-marker', `${e.to} sees a marker on ${k}: stops recording it — channel state = {${chMsgs[k].map((m) => '$' + m).join(', ')}}`);
        }
      }
    }
  }

  const complete = s.processes.every((p) => recorded[p.id]) && s.channels.every(([f, t]) => markerSeen[key(f, t)]);
  const recBal: Record<string, number> = {};
  s.processes.forEach((p) => (recBal[p.id] = recordedBalance[p.id] ?? balance[p.id]));
  const naiveTotal = Object.values(recBal).reduce((a, b) => a + b, 0);
  const channelMoney = Object.values(chMsgs).reduce((a, v) => a + v.reduce((x, y) => x + y, 0), 0);
  const snapshotTotal = naiveTotal + channelMoney;

  return { steps, complete, recordedBalance: recBal, chMsgs, snapshotTotal, naiveTotal, initialTotal, conserved: snapshotTotal === initialTotal };
}

/** The canonical two-account scenario: a $10 transfer is in flight across the cut and only the
 *  channel-state capture keeps the books balanced. */
export const CLASSIC: Scenario = {
  processes: [{ id: 'P0', balance: 100 }, { id: 'P1', balance: 50 }],
  channels: [['P0', 'P1'], ['P1', 'P0']],
  events: [
    { type: 'send', from: 'P0', to: 'P1', amount: 20 }, // $20 P0→P1 (will be received before the marker)
    { type: 'init', p: 'P0' }, //                          P0 starts the snapshot
    { type: 'recv', from: 'P0', to: 'P1' }, //             P1 gets the $20 (pre-marker ⇒ part of P1's state)
    { type: 'send', from: 'P1', to: 'P0', amount: 10 }, // $10 P1→P0 — this is the one caught in flight
    { type: 'recv', from: 'P0', to: 'P1' }, //             P1 gets the marker ⇒ records itself ($60)
    { type: 'recv', from: 'P1', to: 'P0' }, //             P0 gets the $10 ⇒ CAPTURED as channel state
    { type: 'recv', from: 'P1', to: 'P0' }, //             P0 gets the marker ⇒ snapshot complete
  ],
};
