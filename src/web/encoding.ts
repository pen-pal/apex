// Pure, testable encoding logic for the Encoding section. The same "bytes are
// real" creed applies: every transformation here is genuine, not illustrative.

/** One character of a string with its Unicode code point and real UTF-8 bytes. */
export interface CharCell {
  char: string;
  codepoint: number;
  bytes: number[];
}

/** Break a string into characters (by code point) with their UTF-8 encoding. */
export function utf8Breakdown(s: string): CharCell[] {
  const enc = new TextEncoder();
  const out: CharCell[] = [];
  for (const char of s) {
    // `for…of` iterates by code point, so surrogate pairs (emoji) stay whole.
    out.push({ char, codepoint: char.codePointAt(0) ?? 0, bytes: [...enc.encode(char)] });
  }
  return out;
}

export interface BaseView {
  ok: boolean;
  decimal: string;
  binary: string; // grouped in nibbles
  hex: string;
  octal: string;
  bits: number[]; // MSB-first, `width` long
  width: number; // 8 | 16 | 32
  negative: boolean;
}

/** Render an integer in binary/hex/octal, using two's complement for negatives. */
export function toBases(input: string, width: 8 | 16 | 32 = 8): BaseView {
  const t = input.trim();
  if (!/^-?\d+$/.test(t)) return { ok: false, decimal: '', binary: '', hex: '', octal: '', bits: [], width, negative: false };
  let n = BigInt(t);
  const max = (1n << BigInt(width)) - 1n;
  const negative = n < 0n;
  // two's complement into the fixed width
  let mod = ((n % (1n << BigInt(width))) + (1n << BigInt(width))) % (1n << BigInt(width));
  if (!negative && n > max) mod = n & max; // clamp oversized positives to the width
  const bits: number[] = [];
  for (let i = width - 1; i >= 0; i--) bits.push(Number((mod >> BigInt(i)) & 1n));
  const binRaw = mod.toString(2).padStart(width, '0');
  const binary = binRaw.replace(/(.{4})(?=.)/g, '$1 ');
  return {
    ok: true,
    decimal: n.toString(),
    binary,
    hex: '0x' + mod.toString(16).toUpperCase().padStart(width / 4, '0'),
    octal: '0o' + mod.toString(8),
    bits,
    width,
    negative,
  };
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export interface B64Group {
  bytes: number[]; // 1..3 source bytes
  bits: string; // the 24-bit (or padded) bit string
  indices: (number | null)[]; // four 6-bit values (null = padding)
  chars: string[]; // four output chars ('=' for padding)
}

export interface B64Result {
  groups: B64Group[];
  output: string;
}

/** Base64-encode bytes, exposing each 3-byte → 4-char group for the step view. */
export function base64Steps(bytes: number[]): B64Result {
  const groups: B64Group[] = [];
  let output = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const chunk = bytes.slice(i, i + 3);
    const bitStr = chunk.map((b) => b.toString(2).padStart(8, '0')).join('');
    const padded = bitStr.padEnd(24, '0');
    const indices: (number | null)[] = [];
    const chars: string[] = [];
    for (let g = 0; g < 4; g++) {
      // a 6-bit group is real only if it covers at least one real source bit
      if (g * 6 < chunk.length * 8) {
        const v = parseInt(padded.slice(g * 6, g * 6 + 6), 2);
        indices.push(v);
        chars.push(B64[v]);
      } else {
        indices.push(null);
        chars.push('=');
      }
    }
    groups.push({ bytes: chunk, bits: bitStr, indices, chars });
    output += chars.join('');
  }
  return { groups, output };
}

/** Decompose a JS number into IEEE-754 single-precision (32-bit) parts. */
export interface FloatView {
  ok: boolean;
  bits: number[]; // 32, MSB first
  sign: number;
  exponentBits: number[];
  mantissaBits: number[];
  exponentRaw: number;
  exponentUnbiased: number;
  reconstructed: number;
  hex: string;
}

export function float32Bits(input: string): FloatView {
  const t = input.trim();
  if (!/^-?\d*\.?\d+(e-?\d+)?$/i.test(t)) {
    return { ok: false, bits: [], sign: 0, exponentBits: [], mantissaBits: [], exponentRaw: 0, exponentUnbiased: 0, reconstructed: 0, hex: '' };
  }
  const buf = new ArrayBuffer(4);
  new DataView(buf).setFloat32(0, Number(t), false); // big-endian
  const u = new DataView(buf).getUint32(0, false);
  const bits: number[] = [];
  for (let i = 31; i >= 0; i--) bits.push((u >>> i) & 1);
  const exponentRaw = (u >>> 23) & 0xff;
  return {
    ok: true,
    bits,
    sign: bits[0],
    exponentBits: bits.slice(1, 9),
    mantissaBits: bits.slice(9),
    exponentRaw,
    exponentUnbiased: exponentRaw - 127,
    reconstructed: new DataView(buf).getFloat32(0, false),
    hex: '0x' + u.toString(16).toUpperCase().padStart(8, '0'),
  };
}
