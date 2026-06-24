import { describe, it, expect } from 'vitest';
import { varint, encodeField, encodeMessage, grpcFrame } from '../src/web/grpcmsg';

const hex = (b: number[] | Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');

describe('protobuf varint', () => {
  it('matches the canonical examples', () => {
    expect(varint(1)).toEqual([1]);
    expect(varint(150)).toEqual([0x96, 0x01]); // the protobuf docs' famous 150
    expect(varint(300)).toEqual([0xac, 0x02]);
    expect(varint(0)).toEqual([0]);
  });
});

describe('protobuf fields', () => {
  it('encodes field 1 = int 150 as 08 96 01', () => {
    expect(hex(encodeField({ field: 1, type: 'int', value: 150 }).bytes)).toBe('089601');
  });

  it('encodes field 2 = string "testing" as 12 07 + ascii', () => {
    const e = encodeField({ field: 2, type: 'string', value: 'testing' });
    expect(e.tagByte).toBe(0x12); // (2<<3)|2
    expect(e.lenBytes).toEqual([7]);
    expect(hex(e.bytes)).toBe('120774657374696e67');
  });

  it('a whole message concatenates its fields', () => {
    const m = encodeMessage([{ field: 1, type: 'int', value: 150 }, { field: 2, type: 'string', value: 'testing' }]);
    expect(hex(m.bytes)).toBe('089601120774657374696e67');
  });
});

describe('gRPC framing', () => {
  it('prefixes the compressed flag + 4-byte big-endian length', () => {
    const msg = encodeMessage([{ field: 1, type: 'int', value: 150 }]).bytes; // 3 bytes
    const frame = grpcFrame(msg);
    expect(frame[0]).toBe(0); // uncompressed
    expect([...frame.slice(1, 5)]).toEqual([0, 0, 0, 3]); // length = 3, big-endian
    expect(hex(frame)).toBe('0000000003089601');
  });
});
