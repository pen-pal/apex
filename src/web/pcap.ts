// Minimal classic libpcap (.pcap) reader. Parses the 24-byte global header and
// each 16-byte record header + packet data, handling both byte orders and the
// µs/ns timestamp variants. Pure and testable; pcapng (block-based) is not
// supported. Maps the link-layer type to the protocol id to start dissection at.
export interface PcapPacket {
  index: number;
  tsSec: number;
  tsUsec: number;
  origLen: number; // length on the wire (may exceed captured bytes if snapped)
  bytes: number[]; // the captured link-layer frame
}

export interface Pcap {
  linkType: number;
  startId: string; // protocol id to dissect each packet from
  packets: PcapPacket[];
}

const LINKTYPE_START: Record<number, string> = {
  1: 'ethernet', // LINKTYPE_ETHERNET
  101: 'ipv4', // LINKTYPE_RAW (commonly raw IPv4)
};

const MAX_PACKETS = 20000;

export function parsePcap(buf: ArrayBuffer): Pcap {
  if (buf.byteLength < 24) throw new Error('Too small to be a .pcap file.');
  const dv = new DataView(buf);
  const magic = dv.getUint32(0, false);

  let le: boolean;
  if (magic === 0xa1b2c3d4 || magic === 0xa1b23c4d) le = false; // big-endian (µs / ns)
  else if (magic === 0xd4c3b2a1 || magic === 0x4d3cb2a1) le = true; // little-endian (µs / ns)
  else throw new Error('Not a classic .pcap file (bad magic number). pcapng is not supported yet.');

  const linkType = dv.getUint32(20, le);
  const startId = LINKTYPE_START[linkType] ?? 'ethernet';

  const packets: PcapPacket[] = [];
  let off = 24;
  while (off + 16 <= buf.byteLength && packets.length < MAX_PACKETS) {
    const tsSec = dv.getUint32(off, le);
    const tsUsec = dv.getUint32(off + 4, le);
    const inclLen = dv.getUint32(off + 8, le);
    const origLen = dv.getUint32(off + 12, le);
    off += 16;
    if (inclLen === 0 || off + inclLen > buf.byteLength) break; // truncated / malformed
    const bytes: number[] = new Array(inclLen);
    for (let i = 0; i < inclLen; i++) bytes[i] = dv.getUint8(off + i);
    off += inclLen;
    packets.push({ index: packets.length, tsSec, tsUsec, origLen, bytes });
  }
  if (packets.length === 0) throw new Error('No packets found in the file.');
  return { linkType, startId, packets };
}

const readBytes = (dv: DataView, off: number, n: number): number[] => {
  const out: number[] = new Array(n);
  for (let i = 0; i < n; i++) out[i] = dv.getUint8(off + i);
  return out;
};

const PCAPNG_MAGIC = 0x0a0d0d0a; // Section Header Block type
const BYTE_ORDER_MAGIC = 0x1a2b3c4d;

/** Minimal pcapng (block-based) reader: Section Header, Interface Description, and (Enhanced/Simple) Packet blocks. */
export function parsePcapng(buf: ArrayBuffer): Pcap {
  if (buf.byteLength < 28) throw new Error('Too small to be a pcapng file.');
  const dv = new DataView(buf);
  if (dv.getUint32(0, false) !== PCAPNG_MAGIC) throw new Error('Not a pcapng file.');
  // The byte-order magic in the Section Header Block (offset 8) tells us the endianness.
  const le = dv.getUint32(8, false) !== BYTE_ORDER_MAGIC;
  if (dv.getUint32(8, le) !== BYTE_ORDER_MAGIC) throw new Error('pcapng byte-order magic not found.');

  const linkTypes: number[] = []; // one per Interface Description Block
  const packets: PcapPacket[] = [];
  let off = 0;
  while (off + 12 <= buf.byteLength && packets.length < MAX_PACKETS) {
    const type = dv.getUint32(off, le);
    const blockLen = dv.getUint32(off + 4, le);
    if (blockLen < 12 || blockLen % 4 !== 0 || off + blockLen > buf.byteLength) break;

    if (type === 0x00000001) {
      // Interface Description Block: LinkType (2), Reserved (2), SnapLen (4)
      linkTypes.push(dv.getUint16(off + 8, le));
    } else if (type === 0x00000006) {
      // Enhanced Packet Block: iface (4), ts_hi (4), ts_lo (4), cap_len (4), orig_len (4), data…
      const capLen = dv.getUint32(off + 20, le);
      const origLen = dv.getUint32(off + 24, le);
      const tsHi = dv.getUint32(off + 12, le);
      const tsLo = dv.getUint32(off + 16, le);
      if (28 + capLen <= blockLen) {
        const ts = tsHi * 2 ** 32 + tsLo; // default µs resolution
        packets.push({ index: packets.length, tsSec: Math.floor(ts / 1e6), tsUsec: ts % 1e6, origLen, bytes: readBytes(dv, off + 28, capLen) });
      }
    } else if (type === 0x00000003) {
      // Simple Packet Block: orig_len (4), data… (captured length implied by the block length)
      const origLen = dv.getUint32(off + 8, le);
      const capLen = blockLen - 16;
      if (capLen > 0) packets.push({ index: packets.length, tsSec: 0, tsUsec: 0, origLen, bytes: readBytes(dv, off + 12, capLen) });
    }
    off += blockLen;
  }
  if (packets.length === 0) throw new Error('No packets found in the pcapng file.');
  const linkType = linkTypes[0] ?? 1;
  return { linkType, startId: LINKTYPE_START[linkType] ?? 'ethernet', packets };
}

/** Detect classic .pcap vs .pcapng by magic and parse accordingly. */
export function parseCapture(buf: ArrayBuffer): Pcap {
  if (buf.byteLength >= 4 && new DataView(buf).getUint32(0, false) === PCAPNG_MAGIC) return parsePcapng(buf);
  return parsePcap(buf);
}
