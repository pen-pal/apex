/** Reads N bits at a time, big-endian (network byte order). Exact for n <= 48. */
export class BitReader {
  private pos = 0;
  constructor(private readonly bytes: number[]) {}
  get bitPosition(): number { return this.pos; }
  get bytePosition(): number { return this.pos >> 3; }
  readBits(n: number): number {
    let v = 0;
    for (let i = 0; i < n; i++) {
      const byte = this.bytes[this.pos >> 3] ?? 0;
      const bit = (byte >> (7 - (this.pos & 7))) & 1;
      v = v * 2 + bit;            // multiply, not <<, so 32+ bit fields stay exact
      this.pos += 1;
    }
    return v;
  }
  /** Read n whole bytes (for fields wider than 48 bits). Requires byte alignment. */
  readBytes(n: number): number[] {
    if (this.pos & 7) throw new Error('readBytes requires a byte-aligned position');
    const start = this.pos >> 3;
    const out: number[] = [];
    for (let i = 0; i < n; i++) out.push(this.bytes[start + i] ?? 0);
    this.pos += n * 8;
    return out;
  }
}
