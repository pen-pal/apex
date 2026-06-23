// Step-by-step walkthrough of an Internet checksum (RFC 1071) over a header,
// for the animated checksum view. Pure — the view just renders these steps.
// It also locates which dissected layer carries a header-only checksum, by the
// field's label, so no protocol id or offset is hardcoded.
import type { DissectionNode } from '../core/types';

export interface CkStep {
  index: number; // word index
  hi: number; // high byte
  lo: number; // low byte
  word: number; // 16-bit word (checksum field shows as 0x0000)
  isChecksumField: boolean;
  running: number; // 32-bit running sum after adding this word
}

export interface CkWalk {
  layerName: string;
  steps: CkStep[];
  rawSum: number; // before folding carries
  folded: number; // after folding carries into 16 bits
  result: number; // ones-complement -> the checksum
  stored: number; // the checksum actually in the header
  ok: boolean; // result === stored
}

export interface CkTarget {
  layerName: string;
  headerBytes: number[]; // the header only
  checksumByteOffset: number; // byte offset of the 16-bit checksum within the header
}

/** Find the dissected layer whose header carries its own (header-only) checksum. */
export function findHeaderChecksum(root: DissectionNode): CkTarget | null {
  let node: DissectionNode | null = root;
  while (node) {
    const cs = node.header.fields.find((p) => /header checksum/i.test(p.field.label));
    if (cs) {
      return {
        layerName: node.header.spec.name,
        headerBytes: node.raw.slice(0, node.header.byteLength),
        checksumByteOffset: cs.bitOffset / 8,
      };
    }
    node = node.child;
  }
  return null;
}

/** Run the ones-complement sum over a header, zeroing the checksum field itself. */
export function checksumWalk(target: CkTarget): CkWalk {
  const { headerBytes, checksumByteOffset } = target;
  const steps: CkStep[] = [];
  let running = 0;
  for (let i = 0; i + 1 < headerBytes.length; i += 2) {
    const isChecksumField = i === checksumByteOffset;
    const hi = isChecksumField ? 0 : headerBytes[i];
    const lo = isChecksumField ? 0 : headerBytes[i + 1];
    const word = (hi << 8) | lo;
    running += word;
    steps.push({ index: i / 2, hi, lo, word, isChecksumField, running });
  }
  const rawSum = running;
  let folded = running;
  while (folded >> 16) folded = (folded & 0xffff) + (folded >> 16);
  const result = ~folded & 0xffff;
  const stored = ((headerBytes[checksumByteOffset] << 8) | headerBytes[checksumByteOffset + 1]) & 0xffff;
  return { layerName: target.layerName, steps, rawSum, folded, result, stored, ok: result === stored };
}
