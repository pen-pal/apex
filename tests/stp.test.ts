import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { stp } from '../src/protocols/stp';
import { flagsToString } from '../src/core/format';

// A hand-verified IEEE 802.1D STP Configuration BPDU — the 35 bytes that follow
// the 802.2 LLC header (DSAP/SSAP 0x42) inside an 802.3 frame. These are the
// canonical "root bridge" BPDU values seen in real STP captures: the bridge is
// itself the Root (Root Identifier == Bridge Identifier, Root Path Cost = 0),
// default priority 0x8000, default 802.1D timers.
//
//   offset bytes                       field                     value
//   0      00 00                       Protocol Identifier       0x0000 (STP)
//   2      00                          Protocol Version Id       0 (STP)
//   3      00                          BPDU Type                 0x00 (Configuration)
//   4      00                          Flags                     none
//   5      80 00 00 1c 0e 87 78 00     Root Identifier           prio 0x8000, MAC 00:1c:0e:87:78:00
//   13     00 00 00 00                 Root Path Cost            0 (this bridge is the Root)
//   17     80 00 00 1c 0e 87 78 00     Bridge Identifier         prio 0x8000, MAC 00:1c:0e:87:78:00
//   25     80 01                       Port Identifier           0x8001 (priority 128, port 1)
//   27     00 00                       Message Age               0      -> 0 s
//   29     14 00                       Max Age                   5120   -> 20 s  (1/256 s units)
//   31     02 00                       Hello Time                512    -> 2 s
//   33     0f 00                       Forward Delay             3840   -> 15 s
//   -------------------------------------------------------------------------
//   total = 35 bytes
const bpdu = [
  0x00, 0x00, // Protocol Identifier
  0x00, // Protocol Version Identifier
  0x00, // BPDU Type
  0x00, // Flags
  0x80, 0x00, 0x00, 0x1c, 0x0e, 0x87, 0x78, 0x00, // Root Identifier (8)
  0x00, 0x00, 0x00, 0x00, // Root Path Cost (4)
  0x80, 0x00, 0x00, 0x1c, 0x0e, 0x87, 0x78, 0x00, // Bridge Identifier (8)
  0x80, 0x01, // Port Identifier
  0x00, 0x00, // Message Age
  0x14, 0x00, // Max Age
  0x02, 0x00, // Hello Time
  0x0f, 0x00, // Forward Delay
];

describe('STP Configuration BPDU dissection', () => {
  const reg = new ProtocolRegistry();
  reg.register(stp);

  it('is the fixed 35-byte 802.1D Configuration BPDU', () => {
    expect(bpdu.length).toBe(35);
    const node = dissect(bpdu, 'stp', reg);
    expect(node.header.byteLength).toBe(35);
  });

  it('parses the fixed fields (IEEE 802.1D clause 9.3.1)', () => {
    const h = dissect(bpdu, 'stp', reg).header;
    expect(h.get('protocolId')).toBe(0x0000);
    expect(h.get('protocolVersionId')).toBe(0); // STP
    expect(h.get('bpduType')).toBe(0x00); // Configuration
    expect(h.get('flags')).toBe(0x00);
    expect(h.get('rootPathCost')).toBe(0); // this bridge is the Root
    expect(h.get('portIdentifier')).toBe(0x8001);
  });

  it('decodes the enum meanings against the standard', () => {
    const h = dissect(bpdu, 'stp', reg).header;
    const f = (n: string) => h.fields.find((x) => x.field.name === n)!;
    expect(f('protocolVersionId').meaning).toBe('STP (802.1D)');
    expect(f('bpduType').meaning).toBe('Configuration');
  });

  it('reads the 8-byte Root and Bridge identifiers as raw bytes (priority + MAC)', () => {
    const h = dissect(bpdu, 'stp', reg).header;
    const root = h.fields.find((x) => x.field.name === 'rootIdentifier')!;
    const bridge = h.fields.find((x) => x.field.name === 'bridgeIdentifier')!;
    // priority 0x8000 in the first 2 bytes, MAC 00:1c:0e:87:78:00 in the last 6.
    expect(root.bytes).toEqual([0x80, 0x00, 0x00, 0x1c, 0x0e, 0x87, 0x78, 0x00]);
    // On the Root bridge, Root Identifier == Bridge Identifier.
    expect(bridge.bytes).toEqual(root.bytes);
    expect(root.display).toBe('80 00 00 1c 0e 87 78 00');
  });

  it('decodes the default 802.1D timers from 1/256-second units', () => {
    const h = dissect(bpdu, 'stp', reg).header;
    // Raw on-the-wire values: Max Age 20s = 5120, Hello 2s = 512, Fwd Delay 15s = 3840.
    expect(h.get('messageAge')).toBe(0);
    expect(h.get('maxAge')).toBe(5120);
    expect(h.get('helloTime')).toBe(512);
    expect(h.get('forwardDelay')).toBe(3840);
    // Human meaning shows the second value (value/256).
    const f = (n: string) => h.fields.find((x) => x.field.name === n)!.meaning!;
    expect(f('maxAge')).toContain('20 s');
    expect(f('helloTime')).toContain('2 s');
    expect(f('forwardDelay')).toContain('15 s');
  });

  it('is the top of the stack — no encapsulated child', () => {
    const node = dissect(bpdu, 'stp', reg);
    expect(node.child).toBe(null);
    expect(stp.next!(node.header, reg)).toBe(null);
  });

  it('flag bits map MSB-first: TC = LSB (0x01), TCA = MSB (0x80) per a real capture', () => {
    const flagsField = stp.fields.find((f) => f.name === 'flags')!;
    const labels = flagsField.flagBits!;
    // chrisjhart.com deep-dive (real STP captures): TC-only Config BPDU = 0x01,
    // TCA-only = 0x80, both = 0x81. flagBits[0] is the MSB (0x80) = TCA;
    // flagBits[7] is the LSB (0x01) = TC.
    expect(labels[0]).toBe('TCA');
    expect(labels[7]).toBe('TC');
    expect(flagsToString(0x01, labels)).toBe('TC');
    expect(flagsToString(0x80, labels)).toBe('TCA');
    expect(flagsToString(0x81, labels)).toBe('TCA, TC');
    expect(flagsToString(0x00, labels)).toBe('none');
  });
});
