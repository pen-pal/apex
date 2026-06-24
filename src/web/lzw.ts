// LZW compression (Lempel-Ziv-Welch, 1984) — the dictionary scheme behind GIF, TIFF, PDF,
// and old Unix `compress`. Unlike LZ77's sliding window, LZW builds a dictionary on the fly
// that BOTH sides reconstruct identically, so the codes alone are enough to decode — no
// offsets, no explicit dictionary shipped. It starts with every single byte already in the
// dictionary, then greedily extends: emit the longest prefix it already knows, and add that
// prefix-plus-the-next-byte as a new entry. Repetition quickly builds long dictionary
// entries, so repeated substrings collapse to a single code. Pure and tested (independent
// decoder → round-trip is a real check; the ABABABA codes are hand-verified).

export interface Step { emit: number; forString: string; added: { code: number; str: string } | null }

export interface Encoded { codes: number[]; steps: Step[]; finalDictSize: number }

/** Encode a string to LZW codes, recording each emitted code and dictionary addition. */
export function encode(input: string): Encoded {
  const dict = new Map<string, number>();
  for (let i = 0; i < 256; i++) dict.set(String.fromCharCode(i), i);
  let next = 256;
  const codes: number[] = [];
  const steps: Step[] = [];
  if (input === '') return { codes, steps, finalDictSize: next };

  let w = input[0];
  for (let i = 1; i < input.length; i++) {
    const c = input[i];
    const wc = w + c;
    if (dict.has(wc)) {
      w = wc; // keep extending the match
    } else {
      const code = dict.get(w)!;
      codes.push(code);
      dict.set(wc, next);
      steps.push({ emit: code, forString: w, added: { code: next, str: wc } });
      next++;
      w = c;
    }
  }
  codes.push(dict.get(w)!);
  steps.push({ emit: dict.get(w)!, forString: w, added: null });
  return { codes, steps, finalDictSize: next };
}

/** Decode LZW codes, rebuilding the same dictionary the encoder did. */
export function decode(codes: number[]): string {
  if (codes.length === 0) return '';
  const dict: string[] = [];
  for (let i = 0; i < 256; i++) dict.push(String.fromCharCode(i));
  let prev = dict[codes[0]];
  let out = prev;
  for (let i = 1; i < codes.length; i++) {
    const code = codes[i];
    // the classic special case: a code can refer to the entry being created this step
    const entry = code < dict.length ? dict[code] : prev + prev[0];
    out += entry;
    dict.push(prev + entry[0]);
    prev = entry;
  }
  return out;
}

export const strBytes = (s: string): number => s.length;
