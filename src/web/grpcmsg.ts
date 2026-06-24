// gRPC on the wire — Protocol Buffers framed inside HTTP/2. A protobuf message is a
// flat sequence of fields, each a tag (field-number<<3 | wire-type) then the value;
// integers are varints (base-128, little-endian, high bit = "more bytes"), strings are
// length-delimited. gRPC then prefixes each message with a 1-byte compressed flag and a
// 4-byte big-endian length, and carries it in HTTP/2 DATA frames. Real encoding,
// verified against the canonical protobuf examples.

/** Base-128 varint, little-endian, MSB = continuation. */
export function varint(n: number): number[] {
  const out: number[] = [];
  let v = n >>> 0;
  do { let b = v & 0x7f; v >>>= 7; if (v) b |= 0x80; out.push(b); } while (v);
  return out;
}

export type FieldType = 'int' | 'string';
export interface ProtoField { field: number; type: FieldType; value: number | string }

export interface EncodedField {
  field: number;
  wireType: number; // 0 = varint, 2 = length-delimited
  tagByte: number;
  lenBytes: number[]; // length varint for strings (empty for ints)
  valueBytes: number[];
  bytes: number[]; // tag ‖ len ‖ value
}

export function encodeField(f: ProtoField): EncodedField {
  if (f.type === 'int') {
    const tagByte = (f.field << 3) | 0;
    const valueBytes = varint(Number(f.value));
    return { field: f.field, wireType: 0, tagByte, lenBytes: [], valueBytes, bytes: [tagByte, ...valueBytes] };
  }
  const tagByte = (f.field << 3) | 2;
  const valueBytes = [...new TextEncoder().encode(String(f.value))];
  const lenBytes = varint(valueBytes.length);
  return { field: f.field, wireType: 2, tagByte, lenBytes, valueBytes, bytes: [tagByte, ...lenBytes, ...valueBytes] };
}

export function encodeMessage(fields: ProtoField[]): { fields: EncodedField[]; bytes: Uint8Array } {
  const enc = fields.map(encodeField);
  return { fields: enc, bytes: Uint8Array.from(enc.flatMap((e) => e.bytes)) };
}

/** gRPC length-prefixed framing: [compressed flag][4-byte big-endian length][message]. */
export function grpcFrame(msg: Uint8Array): Uint8Array {
  const out = new Uint8Array(5 + msg.length);
  out[0] = 0; // not compressed
  out[1] = (msg.length >>> 24) & 0xff;
  out[2] = (msg.length >>> 16) & 0xff;
  out[3] = (msg.length >>> 8) & 0xff;
  out[4] = msg.length & 0xff;
  out.set(msg, 5);
  return out;
}

export const wireName = (w: number): string => (w === 0 ? 'varint' : w === 2 ? 'len-delimited' : `wire ${w}`);
