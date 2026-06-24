import { describe, it, expect } from 'vitest';
import { derivePtk, mic, handshake } from '../src/web/wpa';

const PMK = 'pmk-from-the-wifi-password';
const AP = 'aa:bb:cc:00:00:01';
const STA = 'dd:ee:ff:00:00:02';
const AN = 'anonce-1111';
const SN = 'snonce-2222';

describe('PTK derivation', () => {
  it('both ends derive the SAME PTK without it crossing the air', () => {
    const h = handshake(PMK, AP, STA, AN, SN);
    expect(h.apPtk).toBe(h.staPtk);
    expect(h.match).toBe(true);
    // the PMK never appears in any transmitted message
    expect(JSON.stringify(h.messages)).not.toContain(PMK);
    // …nor does the derived PTK
    expect(JSON.stringify(h.messages)).not.toContain(h.apPtk);
  });

  it('is symmetric: swapping which side is AP vs station gives the same key', () => {
    expect(derivePtk(PMK, AP, STA, AN, SN)).toBe(derivePtk(PMK, STA, AP, SN, AN));
  });

  it('a fresh nonce yields a fresh PTK (per-session keys)', () => {
    const k1 = derivePtk(PMK, AP, STA, AN, SN);
    const k2 = derivePtk(PMK, AP, STA, AN, 'snonce-9999'); // new SNonce
    expect(k1).not.toBe(k2);
  });

  it('a different PMK (wrong password) yields a different PTK', () => {
    expect(derivePtk(PMK, AP, STA, AN, SN)).not.toBe(derivePtk('wrong-pmk', AP, STA, AN, SN));
  });
});

describe('MIC proves possession of the PTK', () => {
  it('the MIC verifies and any tampering changes it', () => {
    const ptk = derivePtk(PMK, AP, STA, AN, SN);
    const m = mic(ptk, 'message-2-body');
    expect(mic(ptk, 'message-2-body')).toBe(m);          // reproducible
    expect(mic(ptk, 'message-2-bodyX')).not.toBe(m);     // body tampered
    expect(mic(derivePtk('wrong-pmk', AP, STA, AN, SN), 'message-2-body')).not.toBe(m); // wrong key
  });
});

describe('the handshake sequence', () => {
  it('the station can derive the PTK from message 2 onward, the AP from message 3', () => {
    const h = handshake(PMK, AP, STA, AN, SN);
    expect(h.messages.map((m) => m.from)).toEqual(['AP', 'STA', 'AP', 'STA']);
    expect(h.messages[0].staHasPtk).toBe(false); // before it has SNonce
    expect(h.messages[1].staHasPtk).toBe(true);  // station derives after sending SNonce
    expect(h.messages[2].apHasPtk).toBe(true);   // AP derives after receiving SNonce
  });
});
