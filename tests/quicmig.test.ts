import { describe, it, expect } from 'vitest';
import { demuxKey, migrate, type Endpoint } from '../src/web/quicmig';

const WIFI: Endpoint = { ip: '192.168.1.20', port: 51000 };
const CELL: Endpoint = { ip: '10.55.3.7', port: 49000 };
const SERVER: Endpoint = { ip: '93.184.216.34', port: 443 };
const CID = 'a1b2c3';

describe('demux key — how the receiver finds the connection', () => {
  it('TCP keys on the full 4-tuple', () => {
    expect(demuxKey('tcp', WIFI, SERVER, CID)).toBe('192.168.1.20:51000->93.184.216.34:443');
  });
  it('QUIC keys on the connection ID, independent of address', () => {
    expect(demuxKey('quic', WIFI, SERVER, CID)).toBe('cid:a1b2c3');
    expect(demuxKey('quic', CELL, SERVER, CID)).toBe('cid:a1b2c3'); // same key from a different network
  });
});

describe('migration across a network change', () => {
  it('TCP: the 4-tuple changes → connection lost → full reconnect', () => {
    const r = migrate('tcp', WIFI, CELL, SERVER, CID);
    expect(r.matched).toBe(false);
    expect(r.survives).toBe(false);
    expect(r.recovery.reconnect).toBe(true);
    expect(r.oldKey).not.toBe(r.newKey);
    expect(r.recovery.rtts).toBe(2); // TCP + TLS handshakes
  });

  it('QUIC: the connection ID is unchanged → connection survives, no handshake', () => {
    const r = migrate('quic', WIFI, CELL, SERVER, CID);
    expect(r.matched).toBe(true);
    expect(r.survives).toBe(true);
    expect(r.recovery.reconnect).toBe(false);
    expect(r.oldKey).toBe(r.newKey);
    expect(r.recovery.steps.some((s) => /PATH_CHALLENGE/.test(s))).toBe(true);
    expect(r.recovery.steps.some((s) => /PATH_RESPONSE/.test(s))).toBe(true);
  });

  it('both reset congestion control for the new (unknown) path', () => {
    expect(migrate('tcp', WIFI, CELL, SERVER, CID).recovery.resetCwnd).toBe(true);
    expect(migrate('quic', WIFI, CELL, SERVER, CID).recovery.resetCwnd).toBe(true);
  });

  it('no actual move (same endpoint) is a no-op survival for both', () => {
    expect(migrate('tcp', WIFI, WIFI, SERVER, CID).survives).toBe(true);
    expect(migrate('quic', WIFI, WIFI, SERVER, CID).survives).toBe(true);
  });

  it('QUIC migration is cheaper than a TCP reconnect', () => {
    expect(migrate('quic', WIFI, CELL, SERVER, CID).recovery.rtts)
      .toBeLessThan(migrate('tcp', WIFI, CELL, SERVER, CID).recovery.rtts);
  });
});
