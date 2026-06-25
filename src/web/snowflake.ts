// Snowflake IDs (Twitter, 2010) — how distributed services mint 64-bit unique IDs with
// no coordination, that still sort roughly by time. The 64 bits pack four fields: an
// unused sign bit, a 41-bit millisecond timestamp (since a custom epoch), a 10-bit
// machine id (1024 workers), and a 12-bit per-millisecond sequence (4096 IDs/ms/worker).
// Because the timestamp is the high-order field, larger ID ⇒ later (or equal) time, so
// IDs are k-sortable — great for database primary keys. Pure BigInt bit-packing, tested.

export const TWITTER_EPOCH = 1288834974657n; // 2010-11-04T01:42:54.657Z
export const TIMESTAMP_BITS = 41n, WORKER_BITS = 10n, SEQUENCE_BITS = 12n;
export const MAX_WORKER = (1n << WORKER_BITS) - 1n;   // 1023
export const MAX_SEQUENCE = (1n << SEQUENCE_BITS) - 1n; // 4095

const WORKER_SHIFT = SEQUENCE_BITS;                 // 12
const TIMESTAMP_SHIFT = SEQUENCE_BITS + WORKER_BITS; // 22

/** Pack (timestamp, worker, sequence) into a 64-bit Snowflake. */
export function encode(tsMs: bigint, worker: bigint, sequence: bigint, epoch = TWITTER_EPOCH): bigint {
  return ((tsMs - epoch) << TIMESTAMP_SHIFT) | (worker << WORKER_SHIFT) | sequence;
}

export interface Parts { tsMs: bigint; worker: bigint; sequence: bigint }

/** Unpack a Snowflake back into its fields. */
export function decode(id: bigint, epoch = TWITTER_EPOCH): Parts {
  return {
    tsMs: (id >> TIMESTAMP_SHIFT) + epoch,
    worker: (id >> WORKER_SHIFT) & MAX_WORKER,
    sequence: id & MAX_SEQUENCE,
  };
}

export interface GenState { lastMs: bigint; sequence: bigint }

/** Generate the next ID for `worker` at clock `nowMs`, handling same-millisecond
 *  sequence increment and roll-over into the next millisecond. */
export function next(state: GenState, nowMs: bigint, worker: bigint, epoch = TWITTER_EPOCH): { id: bigint; state: GenState; rolledOver: boolean } {
  let ms: bigint, seq: bigint, rolledOver = false;
  if (nowMs > state.lastMs) {
    ms = nowMs; seq = 0n; // the clock advanced to a fresh millisecond → sequence resets
  } else {
    // same ms, OR the clock is behind our last ID (a sequence roll-over already spilled us into the
    // next ms, or the wall clock stepped backward): stay on state.lastMs and keep the sequence
    // strictly increasing, so IDs never go backward or repeat.
    ms = state.lastMs;
    seq = state.sequence + 1n;
    if (seq > MAX_SEQUENCE) { ms = state.lastMs + 1n; seq = 0n; rolledOver = true; } // exhausted this ms → spill to the next
  }
  return { id: encode(ms, worker, seq, epoch), state: { lastMs: ms, sequence: seq }, rolledOver };
}

/** 64-bit binary string split for display: [sign, timestamp, worker, sequence]. */
export function bitFields(id: bigint): { sign: string; timestamp: string; worker: string; sequence: string } {
  const bin = id.toString(2).padStart(64, '0');
  return { sign: bin.slice(0, 1), timestamp: bin.slice(1, 42), worker: bin.slice(42, 52), sequence: bin.slice(52, 64) };
}
