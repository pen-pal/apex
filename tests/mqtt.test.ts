import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { mqtt } from '../src/protocols/mqtt';
import { dissect } from '../src/core/engine';

// Hand-verified MQTT 3.1.1 fixed-header bytes (OASIS 3.1.1 §2.2). We model byte 0
// only; the Remaining Length varint and the variable header/payload fall through
// as node.payload. Assertions are anchored to the OASIS standard, not to our own
// output.
//
// CASE 1 — a CONNECT packet (the first packet on a fresh TCP/1883 connection).
//   byte 0 = 0x10  -> high nibble 0x1 = CONNECT (type 1), low nibble 0x0 = flags 0
//   byte 1 = 0x0C  -> Remaining Length = 12 (a 1-byte varint, < 128), §2.2.3
//   bytes 2.. = the start of the variable header: protocol-name length 0x00 0x04
//               then "MQTT" (OASIS 3.1.1 §3.1.2.1). These fall through as payload.
const connect = [
  0x10, // CONNECT, flags 0
  0x0c, // Remaining Length = 12
  0x00, 0x04, 0x4d, 0x51, 0x54, 0x54, // protocol-name: len 4, "MQTT"
];

// CASE 2 — a PUBLISH packet with QoS 1, RETAIN set, DUP clear.
//   byte 0 = 0x33  -> high nibble 0x3 = PUBLISH (type 3),
//                     low nibble 0b0011 = DUP 0, QoS 0b01 = 1, RETAIN 1
//   byte 1 = 0x07  -> Remaining Length = 7
const publish = [
  0x33, // PUBLISH, DUP=0 QoS=1 RETAIN=1
  0x07, // Remaining Length = 7
  0x00, 0x03, 0x61, 0x2f, 0x62, // topic: len 3, "a/b"
  0x68, 0x69, // payload "hi"
];

describe('MQTT 3.1.1 fixed header dissection (OASIS 3.1.1 §2.2)', () => {
  const reg = new ProtocolRegistry();
  reg.register(mqtt);

  it('models exactly the 1-byte fixed-header first byte', () => {
    const node = dissect(connect, 'mqtt', reg);
    expect(node.header.byteLength).toBe(1);
    expect(node.child).toBeNull();
  });

  it('lets the Remaining Length and variable header fall through as payload', () => {
    const node = dissect(connect, 'mqtt', reg);
    // Everything after byte 0: the Remaining Length varint (0x0C) and the
    // variable header bytes.
    expect(node.payload).toEqual([0x0c, 0x00, 0x04, 0x4d, 0x51, 0x54, 0x54]);
  });

  it('identifies CONNECT (type 1) with reserved flags 0', () => {
    const node = dissect(connect, 'mqtt', reg);
    expect(node.header.get('packetType')).toBe(1);
    const pt = node.header.fields.find((x) => x.field.name === 'packetType')!;
    expect(pt.display).toBe('1 (CONNECT)');

    expect(node.header.get('flags')).toBe(0);
    const fl = node.header.fields.find((x) => x.field.name === 'flags')!;
    expect(fl.meaning).toBe('reserved (MUST be 0)');
  });

  it('decodes the PUBLISH flag nibble: DUP=0, QoS=1, RETAIN=1', () => {
    const node = dissect(publish, 'mqtt', reg);
    expect(node.header.get('packetType')).toBe(3);
    const pt = node.header.fields.find((x) => x.field.name === 'packetType')!;
    expect(pt.display).toBe('3 (PUBLISH)');

    // Low nibble 0b0011 = DUP 0, QoS 0b01 = 1, RETAIN 1.
    expect(node.header.get('flags')).toBe(0b0011);
    const fl = node.header.fields.find((x) => x.field.name === 'flags')!;
    expect(fl.meaning).toBe('PUBLISH: DUP=0, QoS=1, RETAIN=1');
    // flagBits MSB-first: bit3 DUP clear, bits set are QoS-lo and RETAIN.
    expect(fl.display).toBe('QoS-lo, RETAIN');
  });

  it('bounds the PUBLISH header to 1 byte; the rest is payload', () => {
    const node = dissect(publish, 'mqtt', reg);
    expect(node.header.byteLength).toBe(1);
    expect(node.payload).toEqual([0x07, 0x00, 0x03, 0x61, 0x2f, 0x62, 0x68, 0x69]);
  });

  it('field bit widths sum to exactly 1 byte', () => {
    const totalBits = mqtt.fields.reduce((s, f) => s + f.bits, 0);
    expect(totalBits).toBe(8);
  });
});
