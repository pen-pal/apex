// Operational Transformation (OT) — how Google Docs (and Etherpad, and old Google Wave) let many people type
// in the same document at once without clobbering each other. The problem: two users act on the SAME document
// concurrently, each against their own local copy. If Alice inserts 'X' at position 2 and Bob deletes position
// 1 at the "same time," you can't just replay both operations everywhere — Bob's delete shifts everything after
// it, so Alice's "position 2" means something different once Bob's edit lands. OT's answer: before applying a
// remote operation, TRANSFORM it against the concurrent operations already applied locally, adjusting its
// indices so it still means the right thing. The correctness bar is convergence: no matter what order two
// sites receive the two operations, transforming appropriately must land both on the SAME final document. That
// property is called TP1: apply(apply(doc, a), transform(b, a)) == apply(apply(doc, b), transform(a, b)). This
// models character-wise insert/delete OT with site-id tie-breaking. Reference: Ellis & Gibbs (1989); the
// Jupiter/Google Wave OT model.

export type Op =
  | { type: 'ins'; pos: number; ch: string; site: number }
  | { type: 'del'; pos: number; site: number }
  | { type: 'noop' };

export function apply(doc: string, op: Op): string {
  if (op.type === 'noop') return doc;
  if (op.type === 'ins') return doc.slice(0, op.pos) + op.ch + doc.slice(op.pos);
  return doc.slice(0, op.pos) + doc.slice(op.pos + 1); // del
}

/** Transform `op` so it applies correctly AFTER `against` has already been applied to the same base document. */
export function transform(op: Op, against: Op): Op {
  if (op.type === 'noop' || against.type === 'noop') return op;

  if (op.type === 'ins' && against.type === 'ins') {
    // an earlier (or tie-broken-earlier) insert pushes this one right
    if (op.pos < against.pos || (op.pos === against.pos && op.site < against.site)) return op;
    return { ...op, pos: op.pos + 1 };
  }
  if (op.type === 'ins' && against.type === 'del') {
    // a deletion before this insert shifts it left
    return op.pos > against.pos ? { ...op, pos: op.pos - 1 } : op;
  }
  if (op.type === 'del' && against.type === 'ins') {
    // an insertion at or before this delete shifts it right
    return op.pos >= against.pos ? { ...op, pos: op.pos + 1 } : op;
  }
  // del vs del
  if (op.pos < against.pos) return op;
  if (op.pos > against.pos) return { ...op, pos: op.pos - 1 };
  return { type: 'noop' }; // both deleted the same character → this one becomes a no-op
}

/** Does the TP1 convergence property hold for this base doc and concurrent op pair? */
export function converges(doc: string, a: Op, b: Op): { left: string; right: string; ok: boolean } {
  const left = apply(apply(doc, a), transform(b, a));  // site that saw a first
  const right = apply(apply(doc, b), transform(a, b)); // site that saw b first
  return { left, right, ok: left === right };
}

/** What the naive (no-transform) approach would produce — to show why OT is needed. */
export function naive(doc: string, a: Op, b: Op): { left: string; right: string; ok: boolean } {
  const left = apply(apply(doc, a), b);
  const right = apply(apply(doc, b), a);
  return { left, right, ok: left === right };
}
