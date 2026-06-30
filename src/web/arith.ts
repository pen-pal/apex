// Arithmetic coding — the compressor that breaks Huffman's one-whole-bit-per-symbol floor. Instead of
// giving each symbol its own bit-string, it encodes the ENTIRE message as a single number in [0, 1):
// start with the interval [0,1), and for each symbol narrow it to the sub-interval that symbol's
// probability owns. After the whole message the interval is tiny, and ANY number inside it identifies
// the message exactly. Its width is the product of the symbol probabilities, so the bits needed
// (−log2 width) equal the message's information content — reaching the entropy that Huffman can only
// approximate (Huffman must spend ≥1 bit even on a 0.9-probability symbol). Decoding reverses it: see
// which symbol's sub-interval the number falls in, emit it, narrow, repeat. Reference: Witten, Neal &
// Cleary, "Arithmetic Coding for Data Compression" (CACM 1987). (Doubles suffice for short demos.)

export interface Model { order: string[]; freq: Record<string, number> }
export interface Span { sym: string; lo: number; hi: number } // cumulative-probability sub-interval

/** Build a frequency model from a message (every distinct character gets its count). */
export function modelOf(message: string): Model {
  const freq: Record<string, number> = {};
  for (const c of message) freq[c] = (freq[c] ?? 0) + 1;
  return { order: Object.keys(freq).sort(), freq };
}

/** Each symbol's [lo, hi) slice of [0,1), by cumulative frequency. */
export function spans(model: Model): Span[] {
  const total = model.order.reduce((a, s) => a + model.freq[s], 0);
  const out: Span[] = [];
  let acc = 0;
  for (const sym of model.order) {
    const lo = acc / total;
    acc += model.freq[sym];
    out.push({ sym, lo, hi: acc / total });
  }
  return out;
}

export interface Encoded { low: number; high: number; code: number; bits: number }

/** Narrow [0,1) symbol by symbol; the code is the midpoint of the final interval. */
export function encode(message: string, model: Model): Encoded {
  const sp = spans(model);
  let low = 0, high = 1;
  for (const c of message) {
    const s = sp.find((x) => x.sym === c)!;
    const range = high - low;
    high = low + range * s.hi;
    low = low + range * s.lo;
  }
  const width = high - low;
  return { low, high, code: (low + high) / 2, bits: Math.ceil(-Math.log2(width)) };
}

/** Reverse the process: repeatedly locate the symbol whose sub-interval holds `code`. */
export function decode(code: number, model: Model, length: number): string {
  const sp = spans(model);
  let low = 0, high = 1, out = '';
  for (let i = 0; i < length; i++) {
    const range = high - low;
    const value = (code - low) / range;
    const s = sp.find((x) => value >= x.lo && value < x.hi) ?? sp[sp.length - 1];
    out += s.sym;
    high = low + range * s.hi;
    low = low + range * s.lo;
  }
  return out;
}

/** Shannon information content of the message under the model (the ideal bit count). */
export function entropyBits(message: string, model: Model): number {
  const total = model.order.reduce((a, s) => a + model.freq[s], 0);
  let bits = 0;
  for (const c of message) bits += -Math.log2(model.freq[c] / total);
  return bits;
}

/** A lower bound on Huffman's size: it must spend at least 1 whole bit per symbol. */
export const huffmanFloorBits = (message: string) => message.length;
