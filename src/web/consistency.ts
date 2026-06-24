// Consistency models — when many clients read and write one shared value, which results
// are "allowed"? We check two classic models on a single register by searching for a valid
// total order of the operations:
//   • Linearizable: a total order exists that (a) respects REAL TIME — if op A finished
//     before op B started, A precedes B — and (b) makes every read return the latest write.
//   • Sequential: a total order exists that respects each client's PROGRAM ORDER (not real
//     time) and makes every read return the latest write.
// Every linearizable history is sequential, but not vice-versa. Brute force over the small
// histories (≤7 ops) — exact, not heuristic. Tested against textbook examples.

export interface Op { id: string; proc: number; kind: 'w' | 'r'; val: number; start: number; end: number; po: number }

function* permutations<T>(arr: T[]): Generator<T[]> {
  if (arr.length <= 1) { yield arr; return; }
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const p of permutations(rest)) yield [arr[i], ...p];
  }
}

/** Does this total order make every read return the most-recent write? (register init 0) */
function registerValid(order: Op[]): boolean {
  let cur = 0;
  for (const op of order) {
    if (op.kind === 'w') cur = op.val;
    else if (op.val !== cur) return false; // a read that didn't see the latest write
  }
  return true;
}

function satisfies(ops: Op[], respectsRealTime: boolean): boolean {
  for (const order of permutations(ops)) {
    const pos = new Map(order.map((o, i) => [o.id, i]));
    let ok = true;
    for (const a of ops) {
      for (const b of ops) {
        if (a === b) continue;
        // real-time edge: a fully precedes b ⇒ a must come first
        if (respectsRealTime && a.end <= b.start && pos.get(a.id)! > pos.get(b.id)!) { ok = false; break; }
        // program-order edge: same client, earlier issue ⇒ must come first
        if (a.proc === b.proc && a.po < b.po && pos.get(a.id)! > pos.get(b.id)!) { ok = false; break; }
      }
      if (!ok) break;
    }
    if (ok && registerValid(order)) return true;
  }
  return false;
}

export const isLinearizable = (ops: Op[]): boolean => satisfies(ops, true);
export const isSequential = (ops: Op[]): boolean => satisfies(ops, false);

export interface Classification { linearizable: boolean; sequential: boolean; label: string }

export function classify(ops: Op[]): Classification {
  const linearizable = isLinearizable(ops);
  const sequential = linearizable || isSequential(ops);
  return {
    linearizable, sequential,
    label: linearizable ? 'Linearizable' : sequential ? 'Sequential (not linearizable)' : 'Not sequentially consistent',
  };
}
