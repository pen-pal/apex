import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { modbus } from '../src/protocols/modbus';

// A real Modbus/TCP "Read Holding Registers" (function 3) REQUEST, the classic
// worked example from the MODBUS TCP documentation (e.g. simplymodbus.ca and the
// Modbus Messaging Implementation Guide):
//
//   0001 0000 0006 11 03 006B 0003
//
// MBAP header (7 bytes):
//   0x0001      Transaction Identifier = 1
//   0x0000      Protocol Identifier    = 0 (Modbus)
//   0x0006      Length                 = 6 (bytes following: unit id + 5-byte PDU)
//   0x11        Unit Identifier        = 17
// PDU:
//   0x03        Function Code          = 3 (Read Holding Registers)
//   0x006B      Starting Address       = 0x006B (107) — follows as payload
//   0x0003      Quantity of Registers  = 3           — follows as payload
//
// Full frame = Length(6) + 6 = 12 bytes.
const frame = [
  0x00, 0x01, // transaction id
  0x00, 0x00, // protocol id
  0x00, 0x06, // length
  0x11,       // unit id
  0x03,       // function code (Read Holding Registers)
  0x00, 0x6b, // starting address (PDU data)
  0x00, 0x03, // quantity of registers (PDU data)
];

describe('Modbus/TCP dissection', () => {
  const reg = new ProtocolRegistry();
  reg.register(modbus);

  it('parses the 8-byte MBAP header + function code (Modbus Implementation Guide)', () => {
    const node = dissect(frame, 'modbus', reg);
    const h = node.header;
    expect(h.byteLength).toBe(8);
    expect(h.get('transactionId')).toBe(1);
    expect(h.get('protocolId')).toBe(0);
    expect(h.get('length')).toBe(6);
    expect(h.get('unitId')).toBe(0x11);
    expect(h.get('functionCode')).toBe(3);
    expect(h.fields.find((f) => f.field.name === 'functionCode')!.meaning).toBe(
      'Read Holding Registers',
    );
  });

  it('bounds the PDU by Length + 6 and leaves the function data as payload', () => {
    const node = dissect(frame, 'modbus', reg);
    // Length=6 counts unit id + 5-byte PDU; total frame = 12 bytes.
    expect(modbus.pduBytes!(node.header)).toBe(12);
    expect(node.child).toBe(null);
    expect(modbus.next!(node.header, reg)).toBe(null);
    // After the 8-byte modelled header, the 4 data bytes (address + quantity)
    // fall through as payload: 0x006B starting address, 0x0003 quantity.
    expect(node.payload).toEqual([0x00, 0x6b, 0x00, 0x03]);
  });

  it('does not let trailing stream bytes leak past Length + 6 into the payload', () => {
    // Append a second frame's bytes; pduBytes must clip them off as trailer.
    const coalesced = [...frame, 0x99, 0x88, 0x77];
    const node = dissect(coalesced, 'modbus', reg);
    expect(node.payload).toEqual([0x00, 0x6b, 0x00, 0x03]);
    expect(node.trailer).toEqual([0x99, 0x88, 0x77]);
  });
});
