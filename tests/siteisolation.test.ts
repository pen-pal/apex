import { describe, it, expect } from 'vitest';
import { isolation, loadSubresource, type Subresource } from '../src/web/siteisolation';

describe('crossOriginIsolated truth table (HTML cross-origin-isolation)', () => {
  it('needs BOTH COOP=same-origin and a strong COEP', () => {
    expect(isolation('same-origin', 'require-corp').crossOriginIsolated).toBe(true);
    expect(isolation('same-origin', 'credentialless').crossOriginIsolated).toBe(true);
    expect(isolation('same-origin', 'unsafe-none').crossOriginIsolated).toBe(false); // COEP missing
    expect(isolation('same-origin-allow-popups', 'require-corp').crossOriginIsolated).toBe(false); // COOP too weak
    expect(isolation('unsafe-none', 'require-corp').crossOriginIsolated).toBe(false); // COOP missing
  });

  it('gates SharedArrayBuffer and high-res timers behind isolation', () => {
    const iso = isolation('same-origin', 'require-corp');
    expect(iso.sharedArrayBuffer).toBe(true);
    expect(iso.highResTimers).toBe(true);
    const notIso = isolation('unsafe-none', 'unsafe-none');
    expect(notIso.sharedArrayBuffer).toBe(false);
    expect(notIso.highResTimers).toBe(false);
  });

  it('COOP=same-origin alone still earns an own context group', () => {
    expect(isolation('same-origin', 'unsafe-none').ownContextGroup).toBe(true);
    expect(isolation('same-origin-allow-popups', 'unsafe-none').ownContextGroup).toBe(false);
  });
});

describe('subresource embedding under COEP (Fetch CORP check)', () => {
  const xCdnPlain: Subresource = { label: 'cdn.example/lib.js', crossOrigin: true, corp: 'none', cors: false };
  const xCdnCorp: Subresource = { label: 'cdn.example/opted.js', crossOrigin: true, corp: 'cross-origin', cors: false };
  const xApiCors: Subresource = { label: 'api.example/data', crossOrigin: true, corp: 'none', cors: true };
  const selfImg: Subresource = { label: '/logo.png', crossOrigin: false, corp: 'none', cors: false };

  it('same-origin resources always embed', () => {
    expect(loadSubresource('require-corp', selfImg).loads).toBe(true);
  });

  it('require-corp BLOCKS a cross-origin resource that did not opt in', () => {
    expect(loadSubresource('require-corp', xCdnPlain).loads).toBe(false);
  });

  it('require-corp ALLOWS a resource that sent CORP: cross-origin or used CORS', () => {
    expect(loadSubresource('require-corp', xCdnCorp).loads).toBe(true);
    expect(loadSubresource('require-corp', xApiCors).loads).toBe(true);
  });

  it('unsafe-none embeds anything (no isolation, no protection)', () => {
    expect(loadSubresource('unsafe-none', xCdnPlain).loads).toBe(true);
  });

  it('credentialless loads a non-opted-in cross-origin resource but strips its cookies', () => {
    const r = loadSubresource('credentialless', xCdnPlain);
    expect(r.loads).toBe(true);
    expect(r.credentialsStripped).toBe(true);
    expect(loadSubresource('credentialless', xCdnCorp).credentialsStripped).toBe(false); // opted in → keeps creds
  });
});
