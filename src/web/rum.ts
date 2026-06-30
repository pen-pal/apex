// The RUM conjecture — you can optimize a storage engine for at most two of Read, Update (write), and
// Memory (space) amplification; the third pays. This is why B-trees, leveled-LSM and tiered-LSM exist
// side by side: each picks a different corner to sacrifice. We compute the standard analytical
// amplifications as a function of the dataset size N, the LSM size ratio T, and the B-tree fanout B.
//   • read amp   = extra I/Os per point lookup
//   • write amp  = bytes (re)written per logical write, from compaction
//   • space amp  = storage used ÷ logical data size
// These are the textbook formulas, not measurements — labelled as such in the UI. Reference:
// Athanassoulis et al., "Designing Access Methods: The RUM Conjecture" (EDBT 2016); Dayan et al. on
// LSM tuning ("Monkey", SIGMOD 2017); the standard leveled-vs-tiered compaction analysis.

export interface Amp { read: number; write: number; space: number }
export interface RumResult { levels: number; btreeHeight: number; btree: Amp; leveled: Amp; tiered: Amp }

const clampLog = (n: number, base: number) => Math.max(1, Math.ceil(Math.log(n) / Math.log(base)));
const round2 = (x: number) => Math.round(x * 100) / 100;

export function amplification(N: number, T: number, B: number): RumResult {
  const levels = clampLog(N, T);          // number of LSM levels ≈ log_T(N)
  const btreeHeight = clampLog(N, B);     // B-tree height ≈ log_B(N), in page reads

  return {
    levels,
    btreeHeight,
    // B-tree: read-optimized. Few page reads per lookup; in-place update writes one page; ~1/fill space.
    btree: { read: btreeHeight, write: 1, space: 1.5 },
    // Leveled LSM: space-optimized. One run per level (compact eagerly) → low space, but each entry is
    // rewritten ~T times per level across L levels → high write amp; a point read may probe each level.
    leveled: { read: levels, write: T * levels, space: round2((T + 1) / T) },
    // Tiered LSM: write-optimized. Up to T runs per level (compact lazily) → entries written once per
    // level (low write amp) but a read probes ~T runs per level, and space holds up to T copies.
    tiered: { read: T * levels, write: levels, space: T },
  };
}

/** Which of R/U/M each engine sacrifices (its worst dimension), for the RUM-triangle labelling. */
export function sacrifices(a: Amp): 'read' | 'write' | 'space' {
  // normalize against rough "good" baselines so the dimensions are comparable
  const r = a.read / 3, w = a.write / 5, s = a.space / 1.5;
  if (w >= r && w >= s) return 'write';
  if (r >= w && r >= s) return 'read';
  return 'space';
}
