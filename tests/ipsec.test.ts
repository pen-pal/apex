import { describe, it, expect } from 'vitest';
import { encapsulate, demux, type Endpoints, type SADB } from '../src/web/ipsec';

const ep: Endpoints = { origSrc: '10.1.1.5', origDst: '10.2.2.9', gwSrc: '203.0.113.1', gwDst: '198.51.100.1' };

describe('ESP transport mode (host-to-host)', () => {
  const p = encapsulate('transport', 0x1234, 7, ep);
  it('leaves the original IP header in the clear, encrypts only the payload', () => {
    expect(p.observerSees).toEqual({ src: '10.1.1.5', dst: '10.2.2.9' }); // real endpoints visible
    expect(p.originalHidden).toBe(false);
    expect(p.nextHeader).toBe('TCP (6)');
  });
  it('has no new outer IP header (the original stays outermost)', () => {
    expect(p.layers[0].label).toBe('IP header (original)');
    expect(p.layers.some((l) => l.label.includes('NEW outer'))).toBe(false);
  });
});

describe('ESP tunnel mode (gateway-to-gateway VPN)', () => {
  const p = encapsulate('tunnel', 0x1234, 7, ep);
  it('hides the entire original packet behind a new gateway IP header', () => {
    expect(p.observerSees).toEqual({ src: '203.0.113.1', dst: '198.51.100.1' }); // only gateways visible
    expect(p.originalHidden).toBe(true);
    expect(p.nextHeader).toBe('IPv4 (4)'); // the encrypted payload is a whole IP packet
  });
  it('the real source/destination live inside the ENCRYPTED layer', () => {
    const enc = p.layers.find((l) => l.encrypted)!;
    expect(enc.detail).toContain('10.1.1.5');
    expect(enc.detail).toContain('10.2.2.9');
  });
  it('costs more overhead than transport (the extra outer IP header)', () => {
    expect(encapsulate('tunnel', 1, 1, ep).overheadBytes).toBeGreaterThan(encapsulate('transport', 1, 1, ep).overheadBytes);
  });
});

describe('honest crypto + SPI demux', () => {
  it('never fabricates plaintext — the protected region is opaque ciphertext', () => {
    for (const mode of ['transport', 'tunnel'] as const) {
      const enc = encapsulate(mode, 1, 1, ep).layers.find((l) => l.encrypted)!;
      expect(enc.detail).toContain('ciphertext'); // shown as opaque, not invented bytes
    }
  });
  it('the ESP header carries the SPI and sequence number unencrypted (needed to find the SA)', () => {
    const esp = encapsulate('tunnel', 0xabcd, 42, ep).layers.find((l) => l.label === 'ESP header')!;
    expect(esp.encrypted).toBe(false);
    expect(esp.detail).toContain('abcd');
    expect(esp.detail).toContain('42');
  });
  it('the receiver demuxes to the right SA by SPI', () => {
    const sadb: SADB = { 0x1234: { spi: 0x1234, peer: '198.51.100.1', cipher: 'AES-GCM-128' } };
    expect(demux(sadb, 0x1234)?.cipher).toBe('AES-GCM-128');
    expect(demux(sadb, 0x9999)).toBeNull(); // unknown SPI → no SA → drop
  });
});
