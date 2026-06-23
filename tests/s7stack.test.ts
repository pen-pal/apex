import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { tpkt } from '../src/protocols/tpkt';
import { cotp } from '../src/protocols/cotp';
import { s7comm } from '../src/protocols/s7comm';
import { tcp } from '../src/protocols/tcp';
import { ipv4 } from '../src/protocols/ipv4';
import { ethernet } from '../src/protocols/ethernet';

// REAL, HAND-VERIFIED Siemens S7 stack frame: the classic "Setup Communication"
// request a master sends to a PLC immediately after the COTP connection is open.
// These are exactly the bytes emitted by independent S7 tooling that talks to
// real Siemens PLCs (e.g. plcscan's s7.py: COTP DT = 02 f0 80; S7 header packed
// big-endian as !BBHHHH; Setup parameter = f0 00 00 01 00 01 01 e0 with PDU size
// 0x01e0 = 480). The field offsets/widths are anchored to RFC 1006 (TPKT), RFC
// 905 §13 (COTP TPDU codes + DT structure), and the Wireshark s7comm dissector
// (the public reference for the S7comm header layout) — NOT to this code.
//
//   03 00 00 19            TPKT: version 3, reserved 0, length 0x19 = 25 (whole PDU)
//   02 f0 80               COTP: LI=2, DT code 0xF0, EOT=1 + TPDU-NR=0  (0x80)
//   32 01                  S7comm: protocol id 0x32, ROSCTR 0x01 (Job)
//   00 00                  redundancy id 0x0000
//   00 00                  PDU reference 0x0000
//   00 08                  parameter length = 8
//   00 00                  data length = 0
//   f0 00 00 01 00 01 01 e0   Setup Communication parameter (function 0xF0,
//                             max parallel jobs 1/1, PDU size 0x01e0 = 480)
const s7Request = [
  0x03, 0x00, 0x00, 0x19,
  0x02, 0xf0, 0x80,
  0x32, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08, 0x00, 0x00,
  0xf0, 0x00, 0x00, 0x01, 0x00, 0x01, 0x01, 0xe0,
];

// The matching PLC response: ROSCTR 0x03 (Ack_Data), so the S7 header is 12 bytes
// (the extra 0x00 0x00 = error class/code = no error). Same Setup parameter echoed.
//   03 00 00 1b            TPKT length 0x1b = 27
//   02 f0 80               COTP DT
//   32 03                  protocol id 0x32, ROSCTR 0x03 (Ack_Data)
//   00 00 00 00            redundancy id, PDU reference
//   00 08 00 00            parameter length 8, data length 0
//   00 00                  error class 0, error code 0 (success)
//   f0 00 00 01 00 01 01 e0   Setup Communication parameter
const s7Response = [
  0x03, 0x00, 0x00, 0x1b,
  0x02, 0xf0, 0x80,
  0x32, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08, 0x00, 0x00, 0x00, 0x00,
  0xf0, 0x00, 0x00, 0x01, 0x00, 0x01, 0x01, 0xe0,
];

function reg() {
  const r = new ProtocolRegistry();
  for (const s of [ethernet, ipv4, tcp, tpkt, cotp, s7comm]) r.register(s);
  return r;
}

describe('TPKT (RFC 1006)', () => {
  it('parses the 4-byte header and bounds the PDU by its length', () => {
    const r = reg();
    const node = dissect(s7Request, 'tpkt', r);
    const h = node.header;
    expect(h.byteLength).toBe(4);
    expect(h.get('version')).toBe(3);
    expect(h.get('reserved')).toBe(0);
    expect(h.get('length')).toBe(25); // 0x0019, whole PDU incl. header
    // pduBytes = length: a coalesced stream's trailing bytes are clipped.
    expect(tpkt.pduBytes!(h)).toBe(25);
    // child is always COTP.
    expect(tpkt.next!(h, r)).toBe('cotp');
  });

  it('clips trailing stream bytes past the TPKT length as trailer', () => {
    const r = reg();
    const node = dissect([...s7Request, 0xaa, 0xbb], 'tpkt', r);
    expect(node.trailer).toEqual([0xaa, 0xbb]);
  });
});

describe('COTP (ISO 8073 / RFC 905)', () => {
  it('parses a class-0 DT data TPDU', () => {
    const r = reg();
    // Dissect from the COTP byte onward.
    const node = dissect(s7Request.slice(4), 'cotp', r);
    const h = node.header;
    expect(h.get('lengthIndicator')).toBe(2);
    expect(h.byteLength).toBe(3); // LI + 1
    expect(h.get('pduType')).toBe(0xf); // DT
    expect(h.fields.find((f) => f.field.name === 'pduType')!.meaning).toBe('DT (Data)');
    expect(h.get('eot')).toBe(1); // End of TSDU
    expect(h.get('tpduNumber')).toBe(0); // class 0
    // DT dispatches to S7comm.
    expect(cotp.next!(h, r)).toBe('s7comm');
  });

  it('does not dispatch to S7comm for a non-DT (Connection Request) TPDU', () => {
    const r = reg();
    // A minimal CR (Connection Request) TPDU code byte 0xE0; LI here 6 just to
    // exercise the type branch. high nibble 0xE = CR -> next() must be null.
    const cr = [0x06, 0xe0, 0x00, 0x00, 0x00, 0x01, 0x00];
    const node = dissect(cr, 'cotp', r);
    expect(node.header.get('pduType')).toBe(0xe);
    expect(node.header.fields.find((f) => f.field.name === 'pduType')!.meaning).toBe(
      'CR (Connection Request)',
    );
    expect(cotp.next!(node.header, r)).toBe(null);
  });
});

describe('S7comm (Siemens; Wireshark s7comm dissector layout)', () => {
  it('parses a 10-byte Job header (Setup Communication request)', () => {
    const r = reg();
    const node = dissect(s7Request.slice(7), 's7comm', r);
    const h = node.header;
    expect(h.get('protocolId')).toBe(0x32);
    expect(h.get('rosctr')).toBe(0x01); // Job
    expect(h.fields.find((f) => f.field.name === 'rosctr')!.meaning).toBe('Job');
    expect(h.get('redundancyId')).toBe(0x0000);
    expect(h.get('pduReference')).toBe(0x0000);
    expect(h.get('parameterLength')).toBe(8);
    expect(h.get('dataLength')).toBe(0);
    // Job header is 10 bytes (no error field).
    expect(h.byteLength).toBe(10);
    // PDU = header(10) + param(8) + data(0) = 18.
    expect(s7comm.pduBytes!(h)).toBe(18);
    // The 8-byte Setup parameter falls through as payload (function 0xF0, ...).
    expect(node.payload).toEqual([0xf0, 0x00, 0x00, 0x01, 0x00, 0x01, 0x01, 0xe0]);
    expect(s7comm.next!(h, r)).toBe(null);
  });

  it('parses a 12-byte Ack_Data header with error class/code', () => {
    const r = reg();
    const node = dissect(s7Response.slice(7), 's7comm', r);
    const h = node.header;
    expect(h.get('rosctr')).toBe(0x03); // Ack_Data
    expect(h.fields.find((f) => f.field.name === 'rosctr')!.meaning).toBe('Ack_Data');
    expect(h.get('parameterLength')).toBe(8);
    expect(h.get('dataLength')).toBe(0);
    expect(h.get('errorClass')).toBe(0x00);
    expect(h.get('errorCode')).toBe(0x00); // success
    // Ack_Data header is 12 bytes.
    expect(h.byteLength).toBe(12);
    expect(s7comm.pduBytes!(h)).toBe(20); // 12 + 8 + 0
    expect(node.payload).toEqual([0xf0, 0x00, 0x00, 0x01, 0x00, 0x01, 0x01, 0xe0]);
  });
});

describe('Full chain: TCP/102 -> TPKT -> COTP -> S7comm', () => {
  it('dissects the whole Siemens S7 stack end to end', () => {
    const r = reg();

    // Build a real Ethernet/IPv4/TCP frame to dstPort 102 carrying the S7 request.
    // TCP header: src 50000, dst 102, minimal 20-byte header (data offset 5).
    const tcpHdr = [
      0xc3, 0x50, // src port 50000
      0x00, 0x66, // dst port 102
      0x00, 0x00, 0x00, 0x01, // seq
      0x00, 0x00, 0x00, 0x00, // ack
      0x50, 0x18, // data offset 5 (20 bytes), flags PSH+ACK
      0x10, 0x00, // window
      0x00, 0x00, // checksum (not verified here)
      0x00, 0x00, // urgent ptr
    ];
    const tcpSeg = [...tcpHdr, ...s7Request];

    // IPv4 header (20 bytes), protocol 6 (TCP), total length = 20 + tcpSeg.
    const total = 20 + tcpSeg.length;
    const ipHdr = [
      0x45, 0x00,
      (total >> 8) & 0xff, total & 0xff,
      0x00, 0x01, 0x00, 0x00,
      0x40, 0x06, 0x00, 0x00, // ttl 64, protocol 6 (TCP), checksum 0 (not checked)
      0x0a, 0x00, 0x00, 0x01, // src 10.0.0.1
      0x0a, 0x00, 0x00, 0x02, // dst 10.0.0.2
    ];
    const ipPkt = [...ipHdr, ...tcpSeg];

    // Ethernet II, EtherType 0x0800 (IPv4).
    const eth = [
      0x00, 0x11, 0x22, 0x33, 0x44, 0x55,
      0x66, 0x77, 0x88, 0x99, 0xaa, 0xbb,
      0x08, 0x00,
    ];
    const frame = [...eth, ...ipPkt];

    const root = dissect(frame, 'ethernet', r);
    const ip = root.child!;
    const tcpNode = ip.child!;
    const tpktNode = tcpNode.child!;
    const cotpNode = tpktNode.child!;
    const s7Node = cotpNode.child!;

    expect(root.header.spec.id).toBe('ethernet');
    expect(ip.header.spec.id).toBe('ipv4');
    expect(tcpNode.header.spec.id).toBe('tcp');
    expect(tcpNode.header.get('dstPort')).toBe(102);

    // The TCP/102 dispatch reached TPKT.
    expect(tpktNode.header.spec.id).toBe('tpkt');
    expect(tpktNode.header.get('length')).toBe(25);

    // TPKT -> COTP DT.
    expect(cotpNode.header.spec.id).toBe('cotp');
    expect(cotpNode.header.get('pduType')).toBe(0xf);

    // COTP DT -> S7comm Job.
    expect(s7Node.header.spec.id).toBe('s7comm');
    expect(s7Node.header.get('protocolId')).toBe(0x32);
    expect(s7Node.header.get('rosctr')).toBe(0x01);
    expect(s7Node.payload).toEqual([0xf0, 0x00, 0x00, 0x01, 0x00, 0x01, 0x01, 0xe0]);
    expect(s7Node.child).toBe(null);
  });
});
