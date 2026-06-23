import { BitReader } from './bits';
import { formatValue, fieldMeaning } from './format';
import type { DissectionNode, Field, ParsedField, ParsedHeader, ProtocolSpec, Registry } from './types';

const totalHeaderBits = (fields: Field[]): number => fields.reduce((s, f) => s + f.bits, 0);

function buildHeader(spec: ProtocolSpec, parsed: ParsedField[]): ParsedHeader {
  const values = new Map<string, number>();
  for (const p of parsed) values.set(p.field.name, p.value);
  return { spec, fields: parsed, byteLength: 0, get: (name) => values.get(name) ?? 0 };
}

/** Walk raw bytes through the protocol stack, producing one node per layer. */
export function dissect(bytes: number[], protocolId: string, registry: Registry): DissectionNode {
  const spec = registry.get(protocolId);
  if (!spec) throw new Error(`dissect: unknown protocol "${protocolId}"`);

  const reader = new BitReader(bytes);
  const parsed: ParsedField[] = [];
  for (const f of spec.fields) {
    const bitOffset = reader.bitPosition;
    // Fields wider than 48 bits (e.g. an IPv6 address) are read as bytes, not a number.
    if (f.bits > 48) {
      const fieldBytes = reader.readBytes(Math.ceil(f.bits / 8));
      parsed.push({ field: f, value: 0, bytes: fieldBytes, bitOffset, bits: f.bits, display: formatValue(f, 0, fieldBytes) });
    } else if (f.endian === 'le' && f.bits % 8 === 0 && bitOffset % 8 === 0) {
      // Little-endian (byte-aligned) field, e.g. SMB2 — combine bytes low-first.
      const raw = reader.readBytes(f.bits / 8);
      let value = 0;
      for (let k = raw.length - 1; k >= 0; k--) value = value * 256 + raw[k];
      parsed.push({ field: f, value, bitOffset, bits: f.bits, display: formatValue(f, value) });
    } else {
      const value = reader.readBits(f.bits);
      parsed.push({ field: f, value, bitOffset, bits: f.bits, display: formatValue(f, value) });
    }
  }
  const header = buildHeader(spec, parsed);
  for (const p of parsed) p.meaning = fieldMeaning(p.field, p.value, header); // may read siblings
  header.byteLength = spec.headerBytes ? spec.headerBytes(header) : Math.ceil(totalHeaderBits(spec.fields) / 8);

  const pduLen = spec.pduBytes ? Math.min(spec.pduBytes(header), bytes.length) : bytes.length;
  // A protocol may reserve N bytes from the END of its PDU as a trailer (e.g. an
  // end-anchored ICV). Clamp so it never goes negative, past pduLen, or into the header.
  const tb = spec.trailerBytes ? Math.max(0, Math.min(spec.trailerBytes(header), pduLen - header.byteLength)) : 0;
  const payloadEnd = pduLen - tb;
  const payload = bytes.slice(header.byteLength, payloadEnd);
  const trailer = bytes.slice(payloadEnd); // reserved end-anchored trailer (ICV) + any outer padding beyond pduLen

  let child: DissectionNode | null = null;
  if (payload.length > 0 && spec.next) {
    const nextId = spec.next(header, registry);
    if (nextId && registry.get(nextId)) child = dissect(payload, nextId, registry);
  }
  return { header, raw: bytes, payload, trailer, child };
}

/** Plain-text rendering of a dissection tree (used by the CLI demo and tests). */
export function describe(node: DissectionNode, indent = 0): string {
  const pad = '  '.repeat(indent);
  const lines: string[] = [`${pad}${node.header.spec.name} (${node.header.byteLength}-byte header)`];
  for (const f of node.header.fields) {
    const meaning = f.meaning && f.field.type !== 'enum' ? '  -- ' + f.meaning : '';
    lines.push(`${pad}  ${f.field.label}: ${f.display}${meaning}`);
  }
  if (node.child) lines.push(describe(node.child, indent + 1));
  else if (node.payload.length) lines.push(`${pad}  payload: ${node.payload.length} bytes`);
  if (node.trailer.length) lines.push(`${pad}  trailer (FCS / padding): ${node.trailer.length} bytes`);
  return lines.join('\n');
}
