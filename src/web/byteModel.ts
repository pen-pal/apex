// Byte/anatomy derivation. Flattens a DissectionNode tree into a per-byte
// attribution array: every byte of the frame is mapped to the layer and the
// field(s) that own it, using each ParsedField's absolute bitOffset/bits.
// Pure (no React/DOM) so it is testable and reusable; it names no protocol.
import type { DissectionNode, Field, ParsedField } from '../core/types';

/** The slice of a single byte that one field covers, MSB-first (bit 0 = MSB). */
export interface FieldSlice {
  field: ParsedField;
  hiBit: number; // first bit of this byte the field covers (0..7, 0 = MSB)
  loBit: number; // last bit of this byte the field covers  (0..7, inclusive)
  fieldKey: string; // stable key: `${depth}:${field.name}` — for colour + legend
  isFieldStart: boolean; // true on the field's first byte
}

/** One byte of the frame, fully attributed. */
export interface ByteCell {
  index: number; // absolute byte index in the frame
  value: number; // 0..255
  depth: number; // 0 = outermost (Ethernet), increasing up the stack
  layerId: string; // owning protocol id (e.g. 'tcp')
  layerName: string; // owning protocol name (e.g. 'TCP')
  layerSummary: string; // owning protocol's one-line teaching summary
  region: 'header' | 'payload' | 'trailer';
  slices: FieldSlice[]; // header fields overlapping this byte ([] for payload/trailer)
}

/** A layer summary for the legend, in stack order. */
export interface LayerInfo {
  depth: number;
  id: string;
  name: string;
  fields: { name: string; label: string; fieldKey: string }[];
}

export interface ByteModel {
  cells: ByteCell[];
  layers: LayerInfo[];
}

/** Bytes a field occupies within a byte window [byteStart*8, +8). */
function sliceForByte(
  field: Field,
  absFieldStart: number,
  byteAbsBit: number,
): { hiBit: number; loBit: number } | null {
  const absFieldEnd = absFieldStart + field.bits; // exclusive
  const winStart = byteAbsBit;
  const winEnd = byteAbsBit + 8;
  if (absFieldStart >= winEnd || absFieldEnd <= winStart) return null;
  const hi = Math.max(absFieldStart, winStart) - winStart;
  const lo = Math.min(absFieldEnd, winEnd) - winStart - 1;
  return { hiBit: hi, loBit: lo };
}

/** Walk the dissection tree, emitting one ByteCell per byte of the frame. */
export function buildByteModel(root: DissectionNode): ByteModel {
  const cells: ByteCell[] = [];
  const layers: LayerInfo[] = [];

  const walk = (node: DissectionNode, absOffset: number, depth: number): void => {
    const spec = node.header.spec;
    const hdrLen = node.header.byteLength;

    layers.push({
      depth,
      id: spec.id,
      name: spec.name,
      fields: node.header.fields.map((p) => ({
        name: p.field.name,
        label: p.field.label,
        fieldKey: `${depth}:${p.field.name}`,
      })),
    });

    // Header bytes — attribute each to the overlapping field(s).
    for (let b = 0; b < hdrLen; b++) {
      const index = absOffset + b;
      const byteAbsBit = b * 8; // relative to this PDU; field.bitOffset is too
      const slices: FieldSlice[] = [];
      for (const p of node.header.fields) {
        const s = sliceForByte(p.field, p.bitOffset, byteAbsBit);
        if (!s) continue;
        slices.push({
          field: p,
          hiBit: s.hiBit,
          loBit: s.loBit,
          fieldKey: `${depth}:${p.field.name}`,
          // The field's first byte is the one whose window contains its bitOffset.
          isFieldStart: p.bitOffset >= byteAbsBit && p.bitOffset < byteAbsBit + 8,
        });
      }
      cells.push({
        index,
        value: node.raw[b],
        depth,
        layerId: spec.id,
        layerName: spec.name,
        layerSummary: spec.summary,
        region: 'header',
        slices,
      });
    }

    const payloadStart = absOffset + hdrLen;
    if (node.child) {
      walk(node.child, payloadStart, depth + 1);
    } else {
      // Leaf payload bytes belong to this layer.
      for (let i = 0; i < node.payload.length; i++) {
        cells.push({
          index: payloadStart + i,
          value: node.payload[i],
          depth,
          layerId: spec.id,
          layerName: spec.name,
          layerSummary: spec.summary,
          region: 'payload',
          slices: [],
        });
      }
    }

    // Trailer bytes (FCS / padding) sit after header+payload of this node.
    const trailerStart = payloadStart + node.payload.length;
    for (let i = 0; i < node.trailer.length; i++) {
      cells.push({
        index: trailerStart + i,
        value: node.trailer[i],
        depth,
        layerId: spec.id,
        layerName: spec.name,
        layerSummary: spec.summary,
        region: 'trailer',
        slices: [],
      });
    }
  };

  walk(root, 0, 0);
  cells.sort((a, b) => a.index - b.index);
  return { cells, layers };
}
