// Browser site isolation (COOP / COEP / CORP) — the header handshake a page performs to get its own
// OS process and unlock powerful APIs, post-Spectre. Three headers cooperate:
//   • COOP (Cross-Origin-Opener-Policy): "same-origin" severs the window.opener link to cross-origin
//     pages, so this document lands in its OWN browsing-context group (a precondition for a dedicated
//     process and for not leaking references across origins).
//   • COEP (Cross-Origin-Embedder-Policy): "require-corp" says every cross-origin subresource must
//     OPT IN to being embedded (via CORP or CORS), so nothing foreign is pulled into the address
//     space without consent. "credentialless" is the softer variant: load it, but strip credentials.
//   • CORP (Cross-Origin-Resource-Policy): the response-side opt-in a subresource sends.
// When COOP=same-origin AND COEP∈{require-corp, credentialless}, the page becomes crossOriginIsolated,
// which re-enables SharedArrayBuffer and high-resolution timers (disabled for everyone after Spectre).
// We model the DECISIONS (which is honestly checkable) — not any speculative side channel. Tested
// against the HTML cross-origin-isolation rules and the Fetch CORP check.

export type COOP = 'unsafe-none' | 'same-origin-allow-popups' | 'same-origin';
export type COEP = 'unsafe-none' | 'require-corp' | 'credentialless';
export type CORP = 'none' | 'same-origin' | 'same-site' | 'cross-origin';

export interface Isolation {
  crossOriginIsolated: boolean;
  ownContextGroup: boolean; // COOP same-origin → severed from cross-origin openers
  sharedArrayBuffer: boolean; // gated behind crossOriginIsolated
  highResTimers: boolean; // unthrottled performance.now() / 5µs resolution
  explain: string;
}

export function isolation(coop: COOP, coep: COEP): Isolation {
  const ownContextGroup = coop === 'same-origin';
  const crossOriginIsolated = ownContextGroup && (coep === 'require-corp' || coep === 'credentialless');
  return {
    crossOriginIsolated,
    ownContextGroup,
    sharedArrayBuffer: crossOriginIsolated,
    highResTimers: crossOriginIsolated,
    explain: crossOriginIsolated
      ? 'COOP=same-origin gives the page its own context group; COEP guarantees every embedded resource opted in — so the page is crossOriginIsolated and the powerful APIs are unlocked.'
      : !ownContextGroup
        ? 'Without COOP=same-origin the page can still share a browsing-context group with cross-origin openers, so it is not isolated.'
        : 'COOP is set but COEP is unsafe-none, so embedded cross-origin resources are not guaranteed to have opted in — not isolated.',
  };
}

export interface Subresource { label: string; crossOrigin: boolean; corp: CORP; cors: boolean }
export interface LoadResult { label: string; loads: boolean; credentialsStripped: boolean; reason: string }

/** Whether a subresource is allowed to embed under the document's COEP (Fetch CORP check). */
export function loadSubresource(coep: COEP, s: Subresource): LoadResult {
  if (!s.crossOrigin) return { label: s.label, loads: true, credentialsStripped: false, reason: 'same-origin — always embeddable' };
  if (coep === 'unsafe-none') return { label: s.label, loads: true, credentialsStripped: false, reason: 'COEP unsafe-none — no embedding restriction' };
  const optedIn = s.cors || s.corp === 'cross-origin';
  if (coep === 'require-corp')
    return optedIn
      ? { label: s.label, loads: true, credentialsStripped: false, reason: s.cors ? 'allowed via CORS' : 'allowed via CORP: cross-origin' }
      : { label: s.label, loads: false, credentialsStripped: false, reason: `BLOCKED — require-corp needs CORP: cross-origin or CORS, but this sent CORP: ${s.corp}` };
  // credentialless: cross-origin no-cors loads, but without credentials; CORS/CORP load normally
  return optedIn
    ? { label: s.label, loads: true, credentialsStripped: false, reason: 'allowed (opted in via CORS/CORP)' }
    : { label: s.label, loads: true, credentialsStripped: true, reason: 'loaded credentialless — request sent WITHOUT cookies' };
}
