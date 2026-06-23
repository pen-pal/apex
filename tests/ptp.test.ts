import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { ptp } from '../src/protocols/ptp';

// A hand-verified PTPv2 Sync message, the kind a two-step grandmaster multicasts
// once per second. Every byte is cross-checked against IEEE 1588-2008 §13.3
// (the common-header layout, Table 19 messageType, Table 20 flagField,
// Table 23 controlField).
//
// COMMON HEADER (34 bytes, big-endian / network order):
//   byte 0    = 0x00  -> transportSpecific=0 (hi nibble), messageType=0 Sync (lo)
//   byte 1    = 0x02  -> reserved=0 (hi nibble), versionPTP=2 (lo)
//   bytes 2-3 = 0x002C = 44   messageLength (34 header + 10 Sync body)
//   byte 4    = 0x00          domainNumber (default domain)
//   byte 5    = 0x00          reserved
//   bytes 6-7 = 0x0200        flagField -> twoStepFlag (0x0200) set
//   bytes 8-15  = 00*8        correctionField (no transparent clock)
//   bytes 16-19 = 00*4        reserved
//   bytes 20-27 = 00 1B 19 FF FE EE EF C0   clockIdentity (EUI-64 of MAC 00:1B:19:EE:EF:C0)
//   bytes 28-29 = 0x0001      portNumber  (=> sourcePortIdentity = 10 octets)
//   bytes 30-31 = 0x0539 = 1337  sequenceId
//   byte 32   = 0x00          controlField (Table 23: 0 = Sync)
//   byte 33   = 0x00          logMessageInterval (2^0 = 1 message/s)
// SYNC BODY (10 octets): a Timestamp = 6-octet seconds + 4-octet nanoseconds.
//   here secondsField = 0x000000000064 (100 s), nanoseconds = 0x00000000.
const ptpSyncHeader = [
  0x00, 0x02, 0x00, 0x2c, 0x00, 0x00, 0x02, 0x00, // 0..7
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // correctionField 8..15
  0x00, 0x00, 0x00, 0x00,                         // reserved 16..19
  0x00, 0x1b, 0x19, 0xff, 0xfe, 0xee, 0xef, 0xc0, // clockIdentity 20..27
  0x00, 0x01,                                     // portNumber 28..29
  0x05, 0x39,                                     // sequenceId 30..31
  0x00,                                           // controlField 32
  0x00,                                           // logMessageInterval 33
];
// 10-octet Sync body (originTimestamp): seconds=100, nanoseconds=0.
const syncBody = [0x00, 0x00, 0x00, 0x00, 0x00, 0x64, 0x00, 0x00, 0x00, 0x00];

describe('PTPv2 (IEEE 1588-2008) dissection', () => {
  const reg = new ProtocolRegistry();
  reg.register(ptp);

  it('parses the fixed 34-byte common header', () => {
    const node = dissect([...ptpSyncHeader, ...syncBody], 'ptp', reg);
    const h = node.header;
    expect(h.byteLength).toBe(34);
    expect(h.get('transportSpecific')).toBe(0);
    expect(h.get('messageType')).toBe(0); // Sync
    expect(h.get('reserved0')).toBe(0);
    expect(h.get('versionPTP')).toBe(2);
    expect(h.get('messageLength')).toBe(44);
    expect(h.get('domainNumber')).toBe(0);
    expect(h.get('flagField')).toBe(0x0200); // twoStepFlag
    expect(h.get('sequenceId')).toBe(1337);
    expect(h.get('controlField')).toBe(0); // Table 23: Sync
    expect(h.get('logMessageInterval')).toBe(0);
  });

  it('decodes messageType 0 as a Sync event message (UDP/319)', () => {
    const node = dissect([...ptpSyncHeader, ...syncBody], 'ptp', reg);
    const mt = node.header.fields.find((f) => f.field.name === 'messageType')!;
    expect(mt.meaning).toContain('Sync');
    expect(mt.meaning).toContain('319');
  });

  it('shows twoStepFlag as set in the flag field', () => {
    const node = dissect([...ptpSyncHeader, ...syncBody], 'ptp', reg);
    const flags = node.header.fields.find((f) => f.field.name === 'flagField')!;
    expect(flags.meaning).toContain('twoStep');
  });

  it('reads correctionField as 8 zero octets (no transparent clock)', () => {
    const node = dissect([...ptpSyncHeader, ...syncBody], 'ptp', reg);
    const cf = node.header.fields.find((f) => f.field.name === 'correctionField')!;
    expect(cf.bytes).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('reads sourcePortIdentity as the 10-octet clockIdentity + portNumber', () => {
    const node = dissect([...ptpSyncHeader, ...syncBody], 'ptp', reg);
    const spi = node.header.fields.find((f) => f.field.name === 'sourcePortIdentity')!;
    // 8-octet EUI-64 clockIdentity then 2-octet portNumber = 1.
    expect(spi.bytes).toEqual([0x00, 0x1b, 0x19, 0xff, 0xfe, 0xee, 0xef, 0xc0, 0x00, 0x01]);
  });

  it('bounds the PDU by messageLength so the Sync body (not padding) is the payload', () => {
    // Append 14 bytes of Ethernet padding (a 44-byte PTP message in a min frame
    // gets padded); pduBytes(messageLength=44) must trim it out of the payload.
    const padded = [...ptpSyncHeader, ...syncBody, ...new Array(14).fill(0x00)];
    const node = dissect(padded, 'ptp', reg);
    expect(node.payload.length).toBe(10); // exactly the Sync body
    expect(node.trailer.length).toBe(14); // padding kept out of the PTP message
    expect(node.child).toBeNull(); // body is type-specific, no further protocol
  });
});
