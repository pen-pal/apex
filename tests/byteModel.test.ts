import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { registerCoreProtocols } from '../src/protocols';
import { buildFrame } from '../src/core/builder';
import { dissect } from '../src/core/engine';
import { buildByteModel } from '../src/web/byteModel';

function build(message: string) {
  const registry = new ProtocolRegistry();
  registerCoreProtocols(registry);
  const payload = [...new TextEncoder().encode(message)];
  const frame = buildFrame(payload, registry);
  const tree = dissect(frame.bytes, 'ethernet', registry);
  return { model: buildByteModel(tree), frame, tree };
}

describe('buildByteModel', () => {
  it('attributes every byte of the frame exactly once, in order', () => {
    const { model, frame } = build('Hi');
    expect(model.cells.length).toBe(frame.bytes.length);
    model.cells.forEach((c, i) => {
      expect(c.index).toBe(i);
      expect(c.value).toBe(frame.bytes[i]);
    });
  });

  it('every header byte is owned by at least one field; payload/trailer have none', () => {
    const { model } = build('Hello');
    for (const c of model.cells) {
      if (c.region === 'header') expect(c.slices.length).toBeGreaterThan(0);
      else expect(c.slices.length).toBe(0);
    }
  });

  it('lays out the stack: Ethernet(14) -> IPv4(20) -> TCP(20) -> payload -> FCS(4)', () => {
    const { model } = build('Hi');
    // Ethernet header: bytes 0..13
    expect(model.cells.slice(0, 14).every((c) => c.layerId === 'ethernet' && c.region === 'header')).toBe(true);
    // IPv4 header: bytes 14..33
    expect(model.cells.slice(14, 34).every((c) => c.layerId === 'ipv4' && c.region === 'header')).toBe(true);
    // TCP header: bytes 34..53
    expect(model.cells.slice(34, 54).every((c) => c.layerId === 'tcp' && c.region === 'header')).toBe(true);
    // payload 'Hi' = 2 bytes, owned by TCP as a leaf
    expect(model.cells.slice(54, 56).every((c) => c.layerId === 'tcp' && c.region === 'payload')).toBe(true);
    expect(String.fromCharCode(...model.cells.slice(54, 56).map((c) => c.value))).toBe('Hi');
    // FCS trailer: last 4 bytes. Ethernet II has no length field to bound its
    // own PDU, so the engine surfaces the FCS as the trailing bytes past IPv4's
    // totalLength boundary. The byte view reflects this faithfully.
    const fcs = model.cells.slice(-4);
    expect(fcs.every((c) => c.region === 'trailer')).toBe(true);
    expect(fcs.every((c) => c.layerId === 'ipv4')).toBe(true);
  });

  it('splits a packed byte into multiple field slices (IPv4 version + IHL share byte 14)', () => {
    const { model } = build('Hi');
    const byte0 = model.cells[14]; // first IPv4 byte = 0x45
    expect(byte0.value).toBe(0x45);
    expect(byte0.slices.length).toBe(2);
    const [version, ihl] = byte0.slices;
    expect(version.field.field.name).toBe('version');
    expect(version.hiBit).toBe(0);
    expect(version.loBit).toBe(3);
    expect(ihl.field.field.name).toBe('ihl');
    expect(ihl.hiBit).toBe(4);
    expect(ihl.loBit).toBe(7);
  });

  it('exposes layers in stack order for the legend', () => {
    const { model } = build('Hi');
    expect(model.layers.map((l) => l.id)).toEqual(['ethernet', 'ipv4', 'tcp']);
    expect(model.layers[0].fields[0].fieldKey).toBe('0:dstMac');
  });
});
