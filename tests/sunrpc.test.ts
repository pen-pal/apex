import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { sunrpc } from '../src/protocols/sunrpc';
import { dissect } from '../src/core/engine';

// A hand-verified ONC/Sun RPC CALL message: a portmapper (program 100000,
// version 2) GETPORT request asking "which port is NFS (100003) version 3 on,
// over UDP?". This is exactly what a client emits to UDP port 111 before
// mounting an NFS share. Byte values cross-checked against the XDR structs in
// RFC 5531 §9 and the portmapper procedure numbers (GETPORT = 3).
//
// Full XDR breakdown (every "unsigned int" is 4 big-endian octets):
//   12 34 56 78      xid          = 0x12345678   (client transaction id)
//   00 00 00 00      mtype        = 0            (CALL)
//   00 00 00 02      rpcvers      = 2            (RPC v2, required)
//   00 01 86 a0      prog         = 100000       (portmapper)
//   00 00 00 02      vers         = 2            (portmapper version 2)
//   00 00 00 03      proc         = 3            (GETPORT)
//   --- end of the 24-byte fixed prefix Apex models ---
//   00 00 00 00      cred.flavor  = 0            (AUTH_NONE)
//   00 00 00 00      cred.length  = 0            (empty opaque body)
//   00 00 00 00      verf.flavor  = 0            (AUTH_NONE)
//   00 00 00 00      verf.length  = 0            (empty opaque body)
//   --- GETPORT arguments (the mapping being looked up) ---
//   00 01 86 a3      arg prog     = 100003       (NFS)
//   00 00 00 03      arg vers     = 3            (NFSv3)
//   00 00 00 11      arg prot     = 17           (IPPROTO_UDP)
//   00 00 00 00      arg port     = 0            (ignored in a request)
const getportCall = [
  // --- modeled 24-byte CALL prefix ---
  0x12, 0x34, 0x56, 0x78, // xid
  0x00, 0x00, 0x00, 0x00, // mtype = CALL
  0x00, 0x00, 0x00, 0x02, // rpcvers = 2
  0x00, 0x01, 0x86, 0xa0, // prog = 100000 (portmapper)
  0x00, 0x00, 0x00, 0x02, // vers = 2
  0x00, 0x00, 0x00, 0x03, // proc = 3 (GETPORT)
  // --- payload: credentials (opaque_auth) ---
  0x00, 0x00, 0x00, 0x00, // cred flavor AUTH_NONE
  0x00, 0x00, 0x00, 0x00, // cred body length 0
  // --- payload: verifier (opaque_auth) ---
  0x00, 0x00, 0x00, 0x00, // verf flavor AUTH_NONE
  0x00, 0x00, 0x00, 0x00, // verf body length 0
  // --- payload: GETPORT arguments ---
  0x00, 0x01, 0x86, 0xa3, // prog = 100003 (NFS)
  0x00, 0x00, 0x00, 0x03, // vers = 3
  0x00, 0x00, 0x00, 0x11, // prot = 17 (UDP)
  0x00, 0x00, 0x00, 0x00, // port = 0
];

describe('Sun RPC (ONC RPC) CALL dissection', () => {
  const reg = new ProtocolRegistry();
  reg.register(sunrpc);

  it('parses the fixed 24-byte CALL prefix per RFC 5531 §9', () => {
    const node = dissect(getportCall, 'sunrpc', reg);
    const h = node.header;

    // Six 32-bit words = 24 bytes.
    expect(h.byteLength).toBe(24);

    expect(h.get('xid')).toBe(0x12345678);
    expect(h.get('messageType')).toBe(0); // CALL
    expect(h.get('rpcVersion')).toBe(2); // RFC 5531: MUST be 2
    expect(h.get('program')).toBe(100000); // portmapper
    expect(h.get('programVersion')).toBe(2);
    expect(h.get('procedure')).toBe(3); // GETPORT
  });

  it('formats coded fields via their enum/decode', () => {
    const node = dissect(getportCall, 'sunrpc', reg);
    const f = (name: string) => node.header.fields.find((x) => x.field.name === name)!;
    expect(f('xid').display).toBe('0x12345678');
    expect(f('messageType').display).toBe('0 (CALL)');
    expect(f('rpcVersion').meaning).toBe('2 (ONC RPC v2 — required)');
    expect(f('program').meaning).toBe('100000 (portmapper / rpcbind)');
  });

  it('leaves the credentials, verifier, and arguments as the XDR payload, and stops', () => {
    const node = dissect(getportCall, 'sunrpc', reg);
    // 24-byte prefix consumed; the rest is the XDR payload.
    expect(node.payload.length).toBe(getportCall.length - 24);
    // The payload begins with the credentials opaque_auth: flavor AUTH_NONE (0)
    // then a zero-length body — i.e. eight zero bytes (cred + verf flavors/lengths).
    expect(node.payload.slice(0, 4)).toEqual([0x00, 0x00, 0x00, 0x00]); // cred flavor
    // The GETPORT arguments begin 16 bytes in (after cred + verf, each 8 bytes):
    // prog = 100003 = 0x000186a3.
    expect(node.payload.slice(16, 20)).toEqual([0x00, 0x01, 0x86, 0xa3]);
    // We do not dissect the program-specific XDR arguments as a child layer.
    expect(node.child).toBeNull();
  });
});
