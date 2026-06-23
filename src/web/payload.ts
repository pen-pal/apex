// Turn the user's input into payload bytes. Pure and testable.
//   text   -> UTF-8 bytes ("443" -> 34 34 33)
//   number -> big-endian bytes; non-negative packs unsigned (443 -> 01 BB),
//             negative packs as minimal-width two's complement (-1 -> FF, -200 -> FF 38)
export type Mode = 'text' | 'number';

export interface Encoded {
  bytes: number[];
  error: string | null;
}

export function encodePayload(input: string, mode: Mode): Encoded {
  if (mode === 'text') return { bytes: [...new TextEncoder().encode(input)], error: null };

  const t = input.trim();
  if (!/^-?\d+$/.test(t)) return { bytes: [], error: 'Enter an integer (negatives allowed).' };

  let n = BigInt(t);
  if (n === 0n) return { bytes: [0], error: null };

  if (n > 0n) {
    const out: number[] = [];
    while (n > 0n) {
      out.unshift(Number(n & 0xffn));
      n >>= 8n;
    }
    return { bytes: out, error: null };
  }

  // Negative: smallest byte width whose signed range still holds n, two's complement.
  let width = 1;
  while (n < -(1n << BigInt(width * 8 - 1))) width++;
  const mod = (1n << BigInt(width * 8)) + n; // two's complement value
  const out: number[] = [];
  for (let i = width - 1; i >= 0; i--) out.push(Number((mod >> BigInt(i * 8)) & 0xffn));
  return { bytes: out, error: null };
}
