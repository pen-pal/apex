// CRC-32 (IEEE 802.3 / zip / PNG), computed the way the hardware does it: a 32-bit shift
// register that, for every input bit, shifts and conditionally XORs the generator
// polynomial. This is the reflected CRC-32 (poly 0xEDB88320, init 0xFFFFFFFF, final XOR
// 0xFFFFFFFF) used by Ethernet FCS, gzip, and PNG. A single flipped bit changes the
// output completely, which is how the receiver catches corruption. Pure and tested
// against the published check value CRC32("123456789") = 0xCBF43926.

export const POLY = 0xedb88320; // the reflected IEEE 802.3 generator

export interface BitStep { bit: number; lsbWasSet: boolean; reg: number }

/** The eight shift-register steps for folding one byte into the running register. */
export function byteBitSteps(crcIn: number, byte: number): BitStep[] {
  let crc = (crcIn ^ byte) >>> 0;
  const steps: BitStep[] = [];
  for (let i = 0; i < 8; i++) {
    const lsb = (crc & 1) === 1;
    crc = lsb ? ((crc >>> 1) ^ POLY) >>> 0 : crc >>> 1;
    steps.push({ bit: i, lsbWasSet: lsb, reg: crc >>> 0 });
  }
  return steps;
}

export interface ByteState { index: number; byte: number; reg: number }

/** Process the whole input, recording the register after each byte. */
export function crc32Trace(data: number[]): { crc: number; bytes: ByteState[] } {
  let crc = 0xffffffff;
  const bytes: ByteState[] = [];
  data.forEach((byte, index) => {
    crc = (crc ^ byte) >>> 0;
    for (let i = 0; i < 8; i++) crc = (crc & 1) ? ((crc >>> 1) ^ POLY) >>> 0 : crc >>> 1;
    bytes.push({ index, byte, reg: crc >>> 0 });
  });
  return { crc: (crc ^ 0xffffffff) >>> 0, bytes };
}

export const crc32 = (data: number[]): number => crc32Trace(data).crc;

export const strBytes = (s: string): number[] => Array.from(new TextEncoder().encode(s));
export const toHex32 = (n: number): string => (n >>> 0).toString(16).padStart(8, '0');
