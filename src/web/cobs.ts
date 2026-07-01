// COBS — Consistent Overhead Byte Stuffing. A framing trick that solves a real serial/packet problem: you want
// a single byte value (0x00) to mean "end of frame," so a receiver can find frame boundaries in a stream by
// scanning for it. But your payload can contain 0x00 anywhere, which would create false boundaries. Classic
// escaping (like PPP/SLIP) replaces each troublesome byte with a two-byte escape sequence — cheap on average
// but the worst case DOUBLES the data, so you can't bound your buffers. COBS instead removes EVERY zero from the
// payload with a guaranteed tiny, predictable overhead: exactly 1 byte for every 254 bytes of payload, plus 1 —
// never more, no matter what the data is. The idea: chop the data into runs separated by zero bytes; prefix each
// run with a "code" byte holding the distance to the next zero (or end). A zero byte is never emitted — its
// position is encoded in the code byte instead — so the only 0x00 in the whole stream is the frame delimiter you
// append yourself. Runs longer than 254 use a code of 0xFF (254 data bytes, no implied trailing zero) and
// continue. Decoding is the mirror: read a code c, copy c−1 bytes, then (unless c==0xFF or it's the last group)
// emit one zero. Used in packet radio, microcontroller UART protocols, and anywhere you frame a byte stream.
// Reference: Cheshire & Baker, "Consistent Overhead Byte Stuffing" (IEEE/ACM ToN, 1999).

/** Encode: produce a zero-free byte sequence. Append a 0x00 to it to delimit the frame on the wire. */
export function encode(data: number[]): number[] {
  const out: number[] = [];
  let codeIdx = 0;     // index of the current code byte (a placeholder we backfill)
  out.push(0);         // placeholder for the first code byte
  let code = 1;        // 1 + number of non-zero bytes seen in the current run

  for (const b of data) {
    if (b === 0) {
      out[codeIdx] = code;   // close this run; the zero is implied, not written
      codeIdx = out.length; out.push(0);
      code = 1;
    } else {
      out.push(b);
      code++;
      if (code === 0xff) {   // a full run of 254 non-zero bytes: close it with 0xFF, no implied zero
        out[codeIdx] = code;
        codeIdx = out.length; out.push(0);
        code = 1;
      }
    }
  }
  out[codeIdx] = code;       // final code byte
  return out;
}

/** Decode a COBS block (the bytes BEFORE the 0x00 delimiter) back to the original payload. */
export function decode(enc: number[]): number[] {
  const out: number[] = [];
  let i = 0;
  while (i < enc.length) {
    const code = enc[i++];
    if (code === 0) break;   // a real zero here would be the delimiter / malformed — stop
    for (let j = 1; j < code && i < enc.length; j++) out.push(enc[i++]);
    if (code < 0xff && i < enc.length) out.push(0); // implied zero between runs, but not after the last
  }
  return out;
}

/** Worst-case COBS overhead for a payload of n bytes: floor(n/254)+1 bytes (plus the frame's trailing delimiter). */
export const overhead = (n: number): number => Math.floor(n / 254) + 1;
