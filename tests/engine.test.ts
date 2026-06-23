import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { registerCoreProtocols } from '../src/protocols';
import { buildFrame } from '../src/core/builder';
import { dissect } from '../src/core/engine';
import type { ProtocolSpec } from '../src/core/types';

describe('build -> dissect round trip', () => {
  const reg = new ProtocolRegistry();
  registerCoreProtocols(reg);

  it('dissects a built frame through the full stack and recovers the payload', () => {
    const message = 'Hi';
    const payload = [...new TextEncoder().encode(message)];
    const frame = buildFrame(payload, reg);

    const eth = dissect(frame.bytes, 'ethernet', reg);
    expect(eth.header.spec.id).toBe('ethernet');
    expect(eth.child!.header.spec.id).toBe('ipv4');
    expect(eth.child!.child!.header.spec.id).toBe('tcp');

    const tcp = eth.child!.child!;
    expect(tcp.header.get('dstPort')).toBe(8080);
    expect(new TextDecoder().decode(Uint8Array.from(tcp.payload))).toBe(message);

    // the FCS lives as trailing bytes, never inside the recovered data
    expect(eth.child!.trailer.length).toBe(4);
  });
});

describe('generic trailerBytes hook', () => {
  // A minimal "outer" spec: 2-byte header, then a payload that contains an
  // end-anchored trailer of N bytes (think MACsec ICV / FCoE EOF). The child
  // spec is a 1-byte header that simply consumes whatever payload it is given.
  const child: ProtocolSpec = {
    id: 'child',
    name: 'Child',
    layer: 4,
    summary: 'consumes its payload',
    fields: [{ name: 'tag', label: 'Tag', bits: 8 }],
  };

  function outerSpec(extra: Partial<ProtocolSpec> = {}): ProtocolSpec {
    return {
      id: 'outer',
      name: 'Outer',
      layer: 2,
      summary: 'reserves a trailer',
      fields: [{ name: 'h0', label: 'H0', bits: 8 }, { name: 'h1', label: 'H1', bits: 8 }],
      next: () => 'child',
      ...extra,
    };
  }

  function makeReg(outer: ProtocolSpec): ProtocolRegistry {
    const reg = new ProtocolRegistry();
    reg.register(outer);
    reg.register(child);
    return reg;
  }

  it('carves the last N bytes into the trailer and out of the payload', () => {
    const outer = outerSpec({ trailerBytes: () => 4 });
    const reg = makeReg(outer);
    // 2 header + 6 payload + 4 trailer = 12 bytes
    const bytes = [0x00, 0x01, 10, 11, 12, 13, 14, 15, 0xaa, 0xbb, 0xcc, 0xdd];
    const node = dissect(bytes, 'outer', reg);

    expect(node.header.byteLength).toBe(2);
    expect(node.payload).toEqual([10, 11, 12, 13, 14, 15]);
    expect(node.trailer).toEqual([0xaa, 0xbb, 0xcc, 0xdd]);
  });

  it('child dissection never sees the reserved trailer bytes', () => {
    const outer = outerSpec({ trailerBytes: () => 4 });
    const reg = makeReg(outer);
    const bytes = [0x00, 0x01, 0x42, 99, 99, 99, 0xaa, 0xbb, 0xcc, 0xdd];
    const node = dissect(bytes, 'outer', reg);

    expect(node.child).not.toBeNull();
    // child's raw === parent's payload (4 trailer bytes excluded)
    expect(node.child!.raw).toEqual([0x42, 99, 99, 99]);
    expect(node.child!.raw).not.toContain(0xaa);
    expect(node.child!.header.get('tag')).toBe(0x42);
  });

  it('reserves from the END of the PDU, composing with pduBytes (outer padding stays separate)', () => {
    // pduLen = 8 (header + payload + ICV); 3 extra bytes beyond pduLen are outer padding.
    const outer = outerSpec({ pduBytes: () => 8, trailerBytes: () => 2 });
    const reg = makeReg(outer);
    const bytes = [0x00, 0x01, 5, 6, 7, 8, 0xe0, 0xe1, 0x90, 0x91, 0x92];
    const node = dissect(bytes, 'outer', reg);

    // payload is bytes [2, 6): header end .. (pduLen - trailerBytes)
    expect(node.payload).toEqual([5, 6, 7, 8]);
    // trailer = the 2 reserved ICV bytes ending at pduLen + the 3 outer-padding bytes
    expect(node.trailer).toEqual([0xe0, 0xe1, 0x90, 0x91, 0x92]);
  });

  it('clamps an oversized trailerBytes so it never eats the header or goes negative', () => {
    // Only 2 payload bytes available, but trailerBytes asks for 100.
    const outer = outerSpec({ trailerBytes: () => 100 });
    const reg = makeReg(outer);
    const bytes = [0x00, 0x01, 0x77, 0x88];
    const node = dissect(bytes, 'outer', reg);

    expect(node.header.byteLength).toBe(2);
    // entire payload region (2 bytes) becomes trailer; payload empty; no negative slice
    expect(node.payload).toEqual([]);
    expect(node.trailer).toEqual([0x77, 0x88]);
    expect(node.child).toBeNull(); // empty payload -> no child dissection
  });

  it('is a no-op when trailerBytes is absent (existing behavior unchanged)', () => {
    const outer = outerSpec();
    const reg = makeReg(outer);
    const bytes = [0x00, 0x01, 0x42, 1, 2, 3];
    const node = dissect(bytes, 'outer', reg);

    expect(node.payload).toEqual([0x42, 1, 2, 3]);
    expect(node.trailer).toEqual([]);
    expect(node.child!.raw).toEqual([0x42, 1, 2, 3]);
  });
});
