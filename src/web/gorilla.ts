// Gorilla compression — how monitoring systems (Facebook's Gorilla, then Prometheus, InfluxDB, TimescaleDB)
// store billions of (timestamp, value) points in a fraction of the space. Two observations about real metrics:
// (1) timestamps are almost perfectly REGULAR — a data point every 60s — so instead of storing each timestamp,
// store the delta, and then the DELTA-OF-DELTA (how much the interval changed). For a steady stream that's 0,
// which encodes as a single bit. (2) consecutive VALUES are usually close, so XOR each double with the previous
// one: identical values XOR to all-zeros (one bit), and similar values XOR to a small run of bits in the middle
// that you can store with just its leading/trailing zero counts. Together this squeezes the typical 128 bits
// per sample (a 64-bit time + 64-bit double) down to ~1.4 bytes on real data — often 10× smaller. This file
// implements the real bit-level scheme and round-trips it. Reference: Pelkonen et al., "Gorilla: A Fast,
// Scalable, In-Memory Time Series Database" (VLDB 2015).

// ---- bit stream (one bit per array slot; the COUNT is the compressed size) ----
class BitW {
  bits: number[] = [];
  put(bit: number) { this.bits.push(bit & 1); }
  putN(val: number, n: number) { const u = ((val % 2 ** n) + 2 ** n) % 2 ** n; for (let i = n - 1; i >= 0; i--) this.put(Math.floor(u / 2 ** i) & 1); }
  putBig(val: bigint, n: number) { for (let i = BigInt(n - 1); i >= 0n; i--) this.put(Number((val >> i) & 1n)); }
}
class BitR {
  i = 0;
  constructor(public bits: number[]) {}
  get() { return this.bits[this.i++]; }
  getN(n: number) { let v = 0; for (let k = 0; k < n; k++) v = v * 2 + this.bits[this.i++]; return v; }
  getSigned(n: number) { const v = this.getN(n); return v >= 2 ** (n - 1) ? v - 2 ** n : v; }
  getBig(n: number) { let v = 0n; for (let k = 0; k < n; k++) v = (v << 1n) | BigInt(this.bits[this.i++]); return v; }
}

// double ↔ its 64-bit pattern
const _buf = new ArrayBuffer(8), _dv = new DataView(_buf);
const doubleBits = (x: number): bigint => { _dv.setFloat64(0, x); return _dv.getBigUint64(0); };
const bitsToDouble = (b: bigint): number => { _dv.setBigUint64(0, b); return _dv.getFloat64(0); };
const clz64 = (x: bigint): number => { if (x === 0n) return 64; let n = 0; for (let i = 63n; i >= 0n; i--) { if ((x >> i) & 1n) break; n++; } return n; };
const ctz64 = (x: bigint): number => { if (x === 0n) return 64; let n = 0; for (let i = 0n; i < 64n; i++) { if ((x >> i) & 1n) break; n++; } return n; };

// delta-of-delta timestamp buckets: [tagBits, valueBits, halfRange]
const TS_BUCKETS: [number[], number, number][] = [
  [[1, 0], 7, 64],    // '10'  + 7 bits
  [[1, 1, 0], 9, 256],   // '110' + 9 bits
  [[1, 1, 1, 0], 12, 2048],  // '1110'+ 12 bits
];

export interface Encoded { bits: number[]; count: number }

export function encode(samples: { t: number; v: number }[]): Encoded {
  const w = new BitW();
  if (samples.length === 0) return { bits: [], count: 0 };
  // header: first timestamp (64) and first value (64), full
  w.putBig(BigInt(samples[0].t), 64);
  w.putBig(doubleBits(samples[0].v), 64);
  let prevDelta = 0, prevLead = -1, prevTrail = -1;
  for (let i = 1; i < samples.length; i++) {
    // --- timestamp: delta of delta ---
    const delta = samples[i].t - samples[i - 1].t;
    if (i === 1) { w.putN(delta, 32); prevDelta = delta; }        // first delta, full
    else {
      const dod = delta - prevDelta; prevDelta = delta;
      if (dod === 0) w.put(0);
      else {
        let done = false;
        for (const [tag, vbits, half] of TS_BUCKETS) {
          if (dod >= -half && dod < half) { tag.forEach((b) => w.put(b)); w.putN(dod, vbits); done = true; break; }
        }
        if (!done) { w.put(1); w.put(1); w.put(1); w.put(1); w.putN(dod, 32); } // '1111' + 32
      }
    }
    // --- value: XOR with previous ---
    const x = doubleBits(samples[i].v) ^ doubleBits(samples[i - 1].v);
    if (x === 0n) w.put(0);
    else {
      w.put(1);
      const lead = Math.min(clz64(x), 31), trail = ctz64(x);
      if (prevLead >= 0 && lead >= prevLead && trail >= prevTrail) {
        w.put(0); // reuse the previous window
        const len = 64 - prevLead - prevTrail;
        w.putBig((x >> BigInt(prevTrail)) & ((1n << BigInt(len)) - 1n), len);
      } else {
        w.put(1);
        const len = 64 - lead - trail;
        w.putN(lead, 5); w.putN(len - 1, 6);
        w.putBig((x >> BigInt(trail)) & ((1n << BigInt(len)) - 1n), len);
        prevLead = lead; prevTrail = trail;
      }
    }
  }
  return { bits: w.bits, count: w.bits.length };
}

export function decode(enc: Encoded, n: number): { t: number; v: number }[] {
  if (n === 0) return [];
  const r = new BitR(enc.bits);
  const out: { t: number; v: number }[] = [];
  let t = Number(r.getBig(64));
  let vb = r.getBig(64);
  out.push({ t, v: bitsToDouble(vb) });
  let prevDelta = 0, prevLead = -1, prevTrail = -1;
  for (let i = 1; i < n; i++) {
    if (i === 1) { prevDelta = r.getSigned(32); t += prevDelta; }
    else {
      let dod: number;
      if (r.get() === 0) dod = 0;
      else if (r.get() === 0) dod = r.getSigned(7);
      else if (r.get() === 0) dod = r.getSigned(9);
      else if (r.get() === 0) dod = r.getSigned(12);
      else dod = r.getSigned(32);
      prevDelta += dod; t += prevDelta;
    }
    // value
    if (r.get() === 0) { /* xor 0 → same value */ }
    else {
      let lead: number, len: number;
      if (r.get() === 0) { lead = prevLead; len = 64 - prevLead - prevTrail; }
      else { lead = r.getN(5); len = r.getN(6) + 1; prevLead = lead; prevTrail = 64 - lead - len; }
      const meaningful = r.getBig(len);
      const x = meaningful << BigInt(prevTrail);
      vb = vb ^ x;
    }
    out.push({ t, v: bitsToDouble(vb) });
  }
  return out;
}

/** Compressed bits per sample vs the naive 128 (64-bit time + 64-bit double). */
export function ratio(samples: { t: number; v: number }[]): { bits: number; perSample: number; naivePerSample: number; factor: number } {
  const enc = encode(samples);
  const perSample = enc.count / samples.length;
  return { bits: enc.count, perSample, naivePerSample: 128, factor: 128 / perSample };
}
