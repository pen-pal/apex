// Lamport's bakery algorithm — mutual exclusion for N threads using ONLY atomic reads and writes of shared
// variables: no test-and-set, no compare-and-swap, no hardware locks. The metaphor is a bakery counter: on
// entry you take a ticket number one higher than anyone waiting, and customers are served in ticket order,
// lowest first. Two subtleties make it work on real, weakly-ordered memory. (1) The DOORWAY: taking a number
// isn't atomic, so two threads reading the counter at the same instant can grab the SAME number — ties are
// broken by thread id, giving a total order (number, id). (2) A `choosing` flag each thread raises while
// picking its number, so a waiter never compares against a half-written number. Then each thread waits until
// its (number, id) is the smallest among all who want in. It's slow (O(N) shared reads to enter) but it's a
// beautiful proof that mutual exclusion needs nothing but ordinary memory. Reference: Lamport (1974).

export interface Ticket { id: number; number: number }

/** Total order on tickets: lower number first, ties broken by lower id — the (number, id) lexicographic key
 *  that guarantees exactly one thread is "first". */
export const before = (a: Ticket, b: Ticket): boolean => a.number < b.number || (a.number === b.number && a.id < b.id);

/** Simulate the doorway. Each group is a set of threads that read the counter at the same instant, so they
 *  all take the SAME next number (a tie). Groups happen in sequence. Returns each thread's ticket. */
export function takeNumbers(groups: number[][]): Ticket[] {
  const tickets: Ticket[] = [];
  let max = 0;
  for (const group of groups) {
    const num = max + 1; // "one higher than anyone waiting" — everyone in this wave reads the same max
    for (const id of group) tickets.push({ id, number: num });
    max = num;
  }
  return tickets;
}

/** The order in which threads enter the critical section: sorted by (number, id). */
export function entryOrder(tickets: Ticket[]): number[] {
  return [...tickets].sort((a, b) => (before(a, b) ? -1 : 1)).map((t) => t.id);
}

/** Who gets the critical section right now — the single smallest (number, id). */
export function winner(tickets: Ticket[]): number {
  return tickets.reduce((best, t) => (before(t, best) ? t : best)).id;
}

/** Would `me` wait for `other`? Only if other holds a strictly-earlier ticket. Because (number, id) is a
 *  TOTAL order, for any two threads exactly one waits for the other — no deadlock, no two-in-at-once. */
export const waitsFor = (me: Ticket, other: Ticket): boolean => me.id !== other.id && before(other, me);
