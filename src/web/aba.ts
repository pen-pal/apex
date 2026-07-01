// The ABA problem — the subtle bug that makes lock-free programming genuinely hard. Lock-free data structures
// coordinate threads with COMPARE-AND-SWAP (CAS): "atomically set this location to NEW, but only if it still
// holds the value I last read (OLD)." The idea is that if the location is unchanged, nothing happened while I
// was working, so my update is safe. The flaw: CAS only checks that the value is the SAME, not that it never
// CHANGED. If another thread moves the location A → B → A while I'm preempted, my CAS sees A, concludes "all
// good," and succeeds — even though the world underneath shifted completely. It bites hardest with pointers: in
// a lock-free stack, I read the top node A, plan to pop it by CAS-ing top from A to A.next; but another thread
// pops A, pops the node under it, frees them, and (because allocators reuse addresses) pushes a NEW node that
// happens to land at the same address A. My CAS on the pointer "A" succeeds and splices a freed, dangling node
// back into the stack — corruption or a crash. The standard fix is a versioned/tagged pointer: pair the value
// with a monotonic counter and CAS the PAIR, so any intervening change bumps the counter and my stale CAS
// fails, forcing a correct retry. This models the classic stack interleaving under a plain CAS versus a
// versioned CAS. Reference: the Treiber stack; IBM System/370 (compare-double-and-swap).

export interface Register { node: string; version: number }
export interface Event { actor: 'T1' | 'T2'; detail: string; top: string; version: number }
export interface Result { events: Event[]; t1CasSucceeded: boolean; corrupted: boolean; finalTop: string }

/**
 * Run the canonical ABA interleaving on a stack A→B→C:
 *   T1 reads top=A (intending to pop it: CAS top A→B), then is preempted.
 *   T2 pops A, pops B, then pushes a reused node back at address A (now A.next = C, not B).
 *   T1 resumes and attempts its CAS.
 * With `tagged` = false (plain CAS on the pointer) T1's stale CAS SUCCEEDS and corrupts the stack.
 * With `tagged` = true (CAS on pointer+version) it FAILS, so T1 retries — safe.
 */
export function runScenario(tagged: boolean): Result {
  let top: Register = { node: 'A', version: 0 };
  const events: Event[] = [];
  const log = (actor: 'T1' | 'T2', detail: string) => events.push({ actor, detail, top: top.node, version: top.version });

  const t1Read = { node: top.node, version: top.version, next: 'B' }; // A.next was B at read time
  log('T1', 'reads top = A and A.next = B; about to CAS top: A → B (pop A)');

  top = { node: 'B', version: top.version + 1 };
  log('T2', 'pops A → top = B (node A freed)');
  top = { node: 'C', version: top.version + 1 };
  log('T2', 'pops B → top = C (node B freed)');
  top = { node: 'A', version: top.version + 1 };
  log('T2', 'pushes a reused node at address A → top = A again, but now A.next = C');

  // T1 resumes its CAS.
  const t1CasSucceeded = tagged
    ? top.node === t1Read.node && top.version === t1Read.version   // pointer AND version must match
    : top.node === t1Read.node;                                    // plain CAS: only the pointer
  if (t1CasSucceeded) {
    top = { node: t1Read.next, version: top.version + (tagged ? 1 : 0) }; // splices in the stale next (freed B!)
    log('T1', `CAS(top: A → B) SUCCEEDS — top set to B, a freed node (version ${t1Read.version} matched)`);
  } else {
    log('T1', `CAS(top: A → B) FAILS — version ${t1Read.version} ≠ ${top.version}; the change was detected, T1 retries`);
  }

  // In this interleaving, T1 succeeding is exactly the corruption: it points top at the already-freed B.
  const corrupted = t1CasSucceeded;
  return { events, t1CasSucceeded, corrupted, finalTop: top.node };
}
