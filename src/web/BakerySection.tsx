// Lamport's bakery, made visible. Choose how the threads arrive at the "counter": one at a time (clean
// increasing numbers) or in a simultaneous rush (they read the same value and TIE on their ticket number).
// Then watch the ticket order decide who enters the critical section — lowest number first, ties broken by
// thread id. Exactly one thread is ever "first", which is the mutual-exclusion guarantee. Real model from
// bakery.ts.
import { useMemo, useState } from 'react';
import { takeNumbers, entryOrder, winner } from './bakery';

const ARRIVALS: { id: string; label: string; groups: number[][] }[] = [
  { id: 'seq', label: 'arrive one by one', groups: [[0], [1], [2], [3]] },
  { id: 'rush', label: 'all rush at once (tie)', groups: [[2, 0, 3, 1]] },
  { id: 'waves', label: 'two waves', groups: [[3, 1], [0, 2]] },
];

export function BakerySection() {
  const [arr, setArr] = useState('waves');
  const scenario = ARRIVALS.find((a) => a.id === arr)!;
  const tickets = useMemo(() => takeNumbers(scenario.groups), [arr]);
  const order = entryOrder(tickets);
  const inCS = winner(tickets);
  const byId = (id: number) => tickets.find((t) => t.id === id)!;

  return (
    <div className="bak">
      <p className="bak-intro">
        Mutual exclusion for N threads using <strong>only atomic reads and writes</strong> — no test-and-set, no
        hardware lock. Like a bakery: on entry you take a <strong>ticket</strong> one higher than anyone waiting,
        and threads are served <strong>lowest number first</strong>. Since taking a number isn't atomic, two
        threads can grab the <em>same</em> number — so ties break by <strong>thread id</strong>, making
        <code> (number, id)</code> a total order with exactly one winner.
      </p>

      <div className="bak-arrivals">
        {ARRIVALS.map((a) => (
          <button key={a.id} type="button" className={`bak-abtn ${arr === a.id ? 'on' : ''}`} onClick={() => setArr(a.id)}>{a.label}</button>
        ))}
      </div>

      <div className="bak-counter">
        <div className="bak-ch">the doorway — tickets taken</div>
        <div className="bak-tickets">
          {[...tickets].sort((a, b) => a.id - b.id).map((t) => {
            const tied = tickets.filter((o) => o.number === t.number).length > 1;
            return (
              <div key={t.id} className={`bak-ticket ${t.id === inCS ? 'first' : ''}`}>
                <span className="bak-tid">thread {t.id}</span>
                <span className="bak-tnum">#{t.number}{tied && <i> (tie)</i>}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bak-queue">
        <div className="bak-ch">service order — by (number, id)</div>
        <div className="bak-line">
          {order.map((id, i) => {
            const t = byId(id);
            return (
              <div key={id} className={`bak-slot ${i === 0 ? 'cs' : 'wait'}`}>
                <span className="bak-pos">{i === 0 ? '▶ in CS' : `#${i + 1}`}</span>
                <span className="bak-slot-id">T{id}</span>
                <span className="bak-slot-key">({t.number},{id})</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bak-mx">
        <span className="bak-mx-ok">✓ mutual exclusion</span>
        thread <b>{inCS}</b> holds the critical section — its ticket <code>({byId(inCS).number},{inCS})</code> is
        smaller than every other, and because the order is total, no one else can also be first. Everyone else
        spins on ordinary reads until their turn.
      </div>

      <p className="bak-foot">
        Two guarantees fall out of the total order: <strong>mutual exclusion</strong> (only the global minimum
        enters) and <strong>starvation-freedom</strong> (your number is fixed once taken, so every earlier
        ticket drains and your turn arrives — strict FIFO by ticket). The real algorithm also needs the
        <code> choosing[]</code> flags so a waiter never reads a half-assigned number, and — crucially on modern
        CPUs — <strong>memory barriers</strong>, because the proof assumes reads/writes aren't reordered, which
        weak memory models happily do. That fragility is why production code uses hardware atomics
        (<code>futex</code>, CAS) instead; the bakery's value is the proof that ordinary memory is
        <em> enough</em>. Peterson's algorithm is the elegant two-thread cousin. (Lamport, 1974.)
      </p>
    </div>
  );
}
