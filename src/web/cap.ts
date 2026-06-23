// CAP theorem — when a network PARTITION splits your replicas, you can keep the
// system Consistent OR Available, but not both. Two replicas hold a value+version.
// With no partition a write propagates and both agree. Under a partition:
//   CP — only the primary side stays writable/readable; the minority side is made
//        UNAVAILABLE (errors) so clients never read stale data. Consistency over availability.
//   AP — both sides accept writes and DIVERGE; everyone stays available, and the
//        replicas reconcile on heal (last-writer-wins by version). Availability over consistency.
// You don't choose CAP freely — the partition forces the C-vs-A pick (PACELC notes
// that even without a partition you trade latency vs consistency). Pure, tested.

export type Side = 'A' | 'B';
export type Mode = 'CP' | 'AP';
export type OpResult =
  | { ok: true; value: string; version: number }
  | { ok: false; error: string };

export interface Replica { value: string; version: number }

export class CapSystem {
  mode: Mode;
  partitioned = false;
  primary: Side = 'A'; // under CP, the writable side during a partition
  A: Replica;
  B: Replica;

  constructor(mode: Mode, initial = '∅') {
    this.mode = mode;
    this.A = { value: initial, version: 0 };
    this.B = { value: initial, version: 0 };
  }

  private rep(s: Side): Replica { return s === 'A' ? this.A : this.B; }

  /** Is `side` available for ops right now? (Only CP makes the minority unavailable.) */
  available(side: Side): boolean {
    if (!this.partitioned) return true;
    if (this.mode === 'AP') return true; // AP: everyone stays up
    return side === this.primary; // CP: only the primary side serves
  }

  write(side: Side, value: string): OpResult {
    if (!this.available(side)) return { ok: false, error: `${side} is unavailable (CP: minority side rejects writes during a partition)` };
    const r = this.rep(side);
    r.value = value;
    r.version += 1;
    if (!this.partitioned) this.propagate(side); // healthy: replicate immediately
    return { ok: true, value: r.value, version: r.version };
  }

  read(side: Side): OpResult {
    if (!this.available(side)) return { ok: false, error: `${side} is unavailable (CP refuses to serve possibly-stale reads)` };
    const r = this.rep(side);
    return { ok: true, value: r.value, version: r.version };
  }

  private propagate(from: Side): void {
    const src = this.rep(from), dst = this.rep(from === 'A' ? 'B' : 'A');
    dst.value = src.value;
    dst.version = src.version;
  }

  /** True if the two replicas currently hold different values (AP divergence). */
  get diverged(): boolean { return this.A.value !== this.B.value; }

  setPartitioned(p: boolean): void {
    this.partitioned = p;
    if (!p) this.reconcile(); // healing a partition triggers reconciliation
  }

  /** On heal: last-writer-wins by version (higher version, then primary as tie-break). */
  reconcile(): { winner: Side; value: string; version: number } {
    let winner: Side;
    if (this.A.version > this.B.version) winner = 'A';
    else if (this.B.version > this.A.version) winner = 'B';
    else winner = this.primary;
    const w = this.rep(winner);
    const merged: Replica = { value: w.value, version: Math.max(this.A.version, this.B.version) };
    this.A = { ...merged };
    this.B = { ...merged };
    return { winner, value: merged.value, version: merged.version };
  }
}
