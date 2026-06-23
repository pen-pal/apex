import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { amqp } from '../src/protocols/amqp';
import { dissect } from '../src/core/engine';

// A hand-verified AMQP 0-9-1 METHOD frame: a client's Channel.Open, the frame a
// client sends to open logical channel 1 after the connection is up. AMQP 0-9-1
// §4.2.3 (general frame) + the Channel.Open method definition (class id 20 =
// Channel, method id 10 = Open; one short-string "reserved-1" argument, sent
// empty). All multi-byte fields are big-endian (network order).
//
// FRAME LAYOUT ON THE WIRE:
//   offset 0   01            type    = 1  (METHOD)
//   offset 1   00 01         channel = 1
//   offset 3   00 00 00 05   size    = 5  (payload bytes)
//   offset 7   00 14         class id  = 20 (Channel)        ┐
//          9   00 0A         method id = 10 (Open)           │ payload
//         11   00            reserved-1 short-string len = 0 ┘ (5 bytes)
//   offset 12  CE            frame-end = 0xCE (206)
//
// Total on the wire = 7 (header) + 5 (payload) + 1 (frame-end) = 13 bytes.
const PAYLOAD = [0x00, 0x14, 0x00, 0x0a, 0x00]; // class 20, method 10, reserved len 0
const frame = [
  0x01, // type = METHOD
  0x00, 0x01, // channel = 1
  0x00, 0x00, 0x00, 0x05, // size = 5
  ...PAYLOAD,
  0xce, // frame-end
];

describe('AMQP 0-9-1 general frame dissection (§4.2.3)', () => {
  const reg = new ProtocolRegistry();
  reg.register(amqp);

  it('parses the 7-byte frame header and reads its fields', () => {
    const node = dissect(frame, 'amqp', reg);
    expect(node.header.byteLength).toBe(7);
    expect(node.header.get('type')).toBe(1); // METHOD
    expect(node.header.get('channel')).toBe(1);
    expect(node.header.get('size')).toBe(5);
  });

  it('bounds the PDU to header(7) + size + frame-end(1) so no following frame leaks in', () => {
    // Append a second frame's first byte; pduBytes must stop the PDU before it.
    const withNext = [...frame, 0x02 /* start of a following HEADER frame */];
    const node = dissect(withNext, 'amqp', reg);
    // The PDU is header(7) + size(5) + frame-end(1) = 13 bytes. The payload is
    // everything after the 7-byte header up to the PDU end: the 5 method bytes
    // plus the trailing 0xCE frame-end octet (which is part of THIS frame's PDU,
    // a self-checking delimiter — exactly like RTP padding, it stays in payload).
    expect(node.payload).toEqual([...PAYLOAD, 0xce]);
    // The following frame's byte must fall into the trailer, not this payload.
    expect(node.trailer).toEqual([0x02]);
  });

  it('stops dissecting (no encapsulated child protocol)', () => {
    const node = dissect(frame, 'amqp', reg);
    expect(node.child).toBeNull();
  });

  it('decodes the frame type enum to METHOD', () => {
    const node = dissect(frame, 'amqp', reg);
    const typeField = node.header.fields.find((f) => f.field.name === 'type')!;
    expect(typeField.meaning).toContain('METHOD');
  });

  it('treats a HEARTBEAT (type 4, channel 0, size 0) as an 8-byte frame with empty payload', () => {
    // §4.2.3: a heartbeat is type(4) + channel(0) + size(0) + 0xCE = 8 bytes.
    const hb = [0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xce];
    const node = dissect(hb, 'amqp', reg);
    expect(node.header.get('type')).toBe(4);
    expect(node.header.get('channel')).toBe(0);
    expect(node.header.get('size')).toBe(0);
    // size=0 means no method payload; the PDU is just the 0xCE frame-end byte.
    expect(node.payload).toEqual([0xce]);
    expect(node.trailer).toEqual([]);
  });
});
