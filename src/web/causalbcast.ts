// Causal broadcast — delivering messages in an order that respects cause and effect, even when the
// network reorders them. If Alice posts "the build is broken" and Bob replies "on it", nobody should
// ever see Bob's reply before Alice's message. Vector clocks make this enforceable: every broadcast
// is tagged with the sender's vector clock, and a receiver DELIVERS a message only when it has already
// delivered everything that message causally depends on — otherwise it BUFFERS it and releases it
// later, once the gap is filled. The rule (Birman-Schiper-Stephenson): a message m from process j is
// deliverable at k iff m.vc[j] == k.vc[j]+1 (it's the next one from j) AND m.vc[l] <= k.vc[l] for every
// other l (k has seen everything m saw). Pure model of one receiver's delivery logic, tested.

export interface BMsg { id: string; from: number; vc: number[] } // tagged with the sender's clock at send

export interface CBEvent { msgId: string; action: 'delivered' | 'buffered' | 'released'; vc: number[] | null }
export interface CBRun { events: CBEvent[]; deliveryOrder: string[]; finalVc: number[] }

/** Is message m deliverable to a receiver whose current vector clock is kvc? */
export function deliverable(kvc: number[], m: BMsg): boolean {
  if (m.vc[m.from] !== kvc[m.from] + 1) return false; // must be the very next message from its sender
  for (let l = 0; l < kvc.length; l++) if (l !== m.from && m.vc[l] > kvc[l]) return false; // and no missing dependency
  return true;
}

/** Process arrivals (possibly reordered) at one receiver, buffering until each is causally deliverable. */
export function receive(numProcs: number, arrivals: BMsg[]): CBRun {
  const kvc = new Array(numProcs).fill(0);
  const buffer: BMsg[] = [];
  const events: CBEvent[] = [];
  const deliveryOrder: string[] = [];

  const deliver = (m: BMsg) => {
    kvc[m.from] += 1; // record that we've now seen this message from its sender
    deliveryOrder.push(m.id);
    events.push({ msgId: m.id, action: 'delivered', vc: [...kvc] });
  };
  const drainBuffer = () => {
    let progress = true;
    while (progress) {
      progress = false;
      for (let i = 0; i < buffer.length; i++) {
        if (deliverable(kvc, buffer[i])) {
          const bm = buffer.splice(i, 1)[0];
          events.push({ msgId: bm.id, action: 'released', vc: null }); // a buffered message becomes deliverable
          deliver(bm);
          progress = true;
          break;
        }
      }
    }
  };

  for (const m of arrivals) {
    if (deliverable(kvc, m)) { deliver(m); drainBuffer(); }
    else { buffer.push(m); events.push({ msgId: m.id, action: 'buffered', vc: null }); }
  }
  return { events, deliveryOrder, finalVc: kvc };
}
