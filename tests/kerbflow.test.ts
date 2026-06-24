import { describe, it, expect } from 'vitest';
import { flow, canRead } from '../src/web/kerberos';

const steps = flow();

describe('Kerberos exchange structure', () => {
  it('is three request/reply exchanges: AS, TGS, AP', () => {
    expect(steps.map((s) => s.msg)).toEqual(['AS-REQ', 'AS-REP', 'TGS-REQ', 'TGS-REP', 'AP-REQ', 'AP-REP']);
    expect(steps.filter((s) => s.exchange === 'AS')).toHaveLength(2);
    expect(steps.filter((s) => s.exchange === 'TGS')).toHaveLength(2);
    expect(steps.filter((s) => s.exchange === 'AP')).toHaveLength(2);
  });
});

describe('tickets are opaque to the client', () => {
  it('the TGT (AS-REP) is sealed with the TGS key — the client cannot read it', () => {
    const tgt = steps[1].blobs.find((b) => b.label === 'TGT')!;
    expect(tgt.encWith).toBe('Ktgs');
    expect(canRead(tgt, 'client')).toBe(false);
    expect(canRead(tgt, 'tgs')).toBe(true);
  });

  it('the service ticket (TGS-REP) is sealed with the service key, opaque to the client', () => {
    const st = steps[3].blobs.find((b) => b.label === 'service ticket')!;
    expect(st.encWith).toBe('Ksvc');
    expect(canRead(st, 'client')).toBe(false);
    expect(canRead(st, 'service')).toBe(true);
  });

  it('session keys are delivered sealed under a key only the recipient holds', () => {
    expect(steps[1].blobs.find((b) => b.label === 'for the client')!.encWith).toBe('Kc'); // AS-REP → client
    expect(steps[3].blobs.find((b) => b.label === 'for the client')!.encWith).toBe('Kc_tgs'); // TGS-REP → client
  });
});

describe('the password and SSO invariants', () => {
  it('the client long-term key Kc is never carried as plaintext contents anywhere', () => {
    const allContents = steps.flatMap((s) => s.blobs.flatMap((b) => b.contents));
    expect(allContents.some((c) => /password|\bKc\b/.test(c))).toBe(false);
  });

  it('the second exchange (TGS) needs no password — the TGT carries the proof', () => {
    const tgsReq = steps[2];
    expect(tgsReq.blobs.some((b) => b.encWith === 'Kc')).toBe(false); // nothing sealed with the password key
    expect(tgsReq.blobs.some((b) => b.label.includes('TGT'))).toBe(true);
  });
});
