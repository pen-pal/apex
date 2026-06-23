import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { registerCoreProtocols } from '../src/protocols';
import { buildFrame } from '../src/core/builder';
import { dissect } from '../src/core/engine';

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
