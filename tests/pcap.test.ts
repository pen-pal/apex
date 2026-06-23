import { describe, it, expect } from 'vitest';
import { parsePcap, parsePcapng, parseCapture } from '../src/web/pcap';
import { ProtocolRegistry } from '../src/core/registry';
import { registerCoreProtocols } from '../src/protocols';
import { dissect } from '../src/core/engine';

// Build a tiny little-endian .pcap with two Ethernet frames (14-byte eth header
// + a couple payload bytes) so we can parse it back.
function makePcap(frames: number[][]): ArrayBuffer {
  const recs = frames.map((f) => {
    const r = new Uint8Array(16 + f.length);
    const dv = new DataView(r.buffer);
    dv.setUint32(0, 0x5f000000, true); // ts_sec
    dv.setUint32(4, 0, true);          // ts_usec
    dv.setUint32(8, f.length, true);   // incl_len
    dv.setUint32(12, f.length, true);  // orig_len
    r.set(f, 16);
    return r;
  });
  const total = 24 + recs.reduce((s, r) => s + r.length, 0);
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, 0xd4c3b2a1, false); // little-endian magic, written big-endian
  dv.setUint16(4, 2, true); dv.setUint16(6, 4, true); // version
  dv.setUint32(20, 1, true); // linktype = Ethernet
  let off = 24;
  for (const r of recs) { out.set(r, off); off += r.length; }
  return out.buffer;
}

const eth = (et: [number, number], payload: number[]) =>
  [0xff,0xff,0xff,0xff,0xff,0xff, 0xde,0xad,0xbe,0xef,0x00,0x01, ...et, ...payload];

describe('parsePcap', () => {
  it('parses the global header and packet records (Ethernet)', () => {
    const buf = makePcap([eth([0x08,0x06], [1,2,3]), eth([0x08,0x00], [4,5])]);
    const pc = parsePcap(buf);
    expect(pc.linkType).toBe(1);
    expect(pc.startId).toBe('ethernet');
    expect(pc.packets).toHaveLength(2);
    expect(pc.packets[0].bytes.length).toBe(17); // 14 eth + 3
    expect(pc.packets[1].origLen).toBe(16);
  });

  it('rejects a non-pcap buffer', () => {
    const bad = new Uint8Array([0,1,2,3, ...new Array(24).fill(0)]).buffer;
    expect(() => parsePcap(bad)).toThrow(/bad magic|classic/i);
  });

  it('parses a pcapng (SHB + IDB + EPB) and auto-detects format', () => {
    const frame = eth([0x08, 0x00], [7, 7, 7]); // 17 bytes
    const blocks: number[] = [];
    const u32 = (v: number) => [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255];
    // Section Header Block (28 bytes)
    blocks.push(...u32(0x0a0d0d0a), ...u32(28), ...u32(0x1a2b3c4d), 1, 0, 0, 0, ...u32(0xffffffff), ...u32(0xffffffff), ...u32(28));
    // Interface Description Block (20 bytes): linktype=1 (Ethernet)
    blocks.push(...u32(0x00000001), ...u32(20), 1, 0, 0, 0, ...u32(0), ...u32(20));
    // Enhanced Packet Block: data padded to 4 (17 -> 20)
    const pad = (4 - (frame.length % 4)) % 4;
    const epbLen = 32 + frame.length + pad;
    blocks.push(...u32(0x00000006), ...u32(epbLen), ...u32(0), ...u32(0), ...u32(0),
      ...u32(frame.length), ...u32(frame.length), ...frame, ...new Array(pad).fill(0), ...u32(epbLen));
    const buf = new Uint8Array(blocks).buffer;

    const pc = parsePcapng(buf);
    expect(pc.linkType).toBe(1);
    expect(pc.startId).toBe('ethernet');
    expect(pc.packets).toHaveLength(1);
    expect(pc.packets[0].bytes).toEqual(frame);
    // parseCapture should route it to the pcapng parser by magic
    expect(parseCapture(buf).packets[0].bytes).toEqual(frame);
  });

  it('parsed Ethernet frames dissect through the engine', () => {
    const reg = new ProtocolRegistry(); registerCoreProtocols(reg);
    const pc = parsePcap(makePcap([eth([0x08,0x06], [9,9,9])]));
    const node = dissect(pc.packets[0].bytes, pc.startId, reg);
    expect(node.header.spec.id).toBe('ethernet');
    expect(node.header.get('etherType')).toBe(0x0806); // ARP
  });
});
