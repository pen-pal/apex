import { describe, it, expect } from 'vitest';
import { tls13Flow, firstEncryptedIndex, levelAt } from '../src/web/tls13';

describe('TLS 1.3 handshake model (RFC 8446 §2)', () => {
  const flow = tls13Flow();

  it('orders the messages as a 1-RTT handshake', () => {
    expect(flow.map((m) => m.name)).toEqual([
      'ClientHello', 'ServerHello', 'ChangeCipherSpec', 'EncryptedExtensions',
      'Certificate', 'CertificateVerify', 'Finished', 'Finished', 'Application Data',
    ]);
  });

  it('keeps only ClientHello and ServerHello in the clear', () => {
    const plaintext = flow.filter((m) => m.enc === 'plaintext').map((m) => m.name);
    // ChangeCipherSpec is a legacy compatibility record, also cleartext
    expect(plaintext).toEqual(['ClientHello', 'ServerHello', 'ChangeCipherSpec']);
  });

  it('encrypts from EncryptedExtensions onward under handshake keys', () => {
    const idx = firstEncryptedIndex(flow);
    expect(flow[idx].name).toBe('EncryptedExtensions');
    expect(flow[idx].enc).toBe('handshake');
    // certificate is encrypted in TLS 1.3 (unlike 1.2)
    expect(flow.find((m) => m.name === 'Certificate')!.enc).toBe('handshake');
  });

  it('has both Finished messages (server then client)', () => {
    const fin = flow.filter((m) => m.name === 'Finished');
    expect(fin).toHaveLength(2);
    expect(fin.map((m) => m.from)).toEqual(['server', 'client']);
  });

  it('derives handshake keys after ServerHello and app keys after client Finished', () => {
    expect(flow.find((m) => m.id === 'server-hello')!.establishes).toMatch(/handshake traffic keys/);
    expect(flow.find((m) => m.id === 'client-finished')!.establishes).toMatch(/application traffic keys/);
  });

  it('ends in opaque application data (never invented plaintext)', () => {
    const last = flow[flow.length - 1];
    expect(last.record).toBe('application_data');
    expect(last.enc).toBe('application');
    expect(last.purpose).toMatch(/opaque/);
    expect(levelAt(flow, flow.length - 1)).toBe('application');
  });
});
