// Unified, provider-agnostic analytics for Apex. Apex is a static SPA (GitHub Pages + Vercel) that uses no
// cookies or localStorage, so every provider here is COOKIELESS and loaded as a plain <script> beacon — no proxy,
// no consent banner. Because the app never changes the URL when you switch sections, per-section popularity is
// tracked by firing a VIRTUAL PAGEVIEW on each section change (GoatCounter and Umami support this via their JS
// API; Vercel gets a custom event). Cloudflare's free Web Analytics beacon has no manual-event API — it records
// real navigations only — so it captures visits/referrers/geo but not per-section (that would need hash-based
// section URLs, an optional follow-up).
//
// The IDs below are PUBLIC embed tokens — they ship in the page source no matter what, so committing them is
// fine (they are NOT secrets). Leave a field '' to disable that provider; nothing is loaded or sent while it is
// empty. Fill these in after creating each free account:
//   • Cloudflare Web Analytics → dash.cloudflare.com → Analytics & Logs → Web Analytics → add site → copy the
//       token from the <script> snippet (the "token" field).
//   • GoatCounter → <yourcode>.goatcounter.com → the count URL, e.g. https://apex.goatcounter.com/count
//   • Umami Cloud → cloud.umami.is → your website → Settings → "Website ID" (a UUID).

import { track as vercelTrack } from '@vercel/analytics';

const CONFIG = {
  cloudflareToken: '',                              // e.g. '0123456789abcdef0123456789abcdef'
  goatcounter: 'https://apex.goatcounter.com/count', // GoatCounter count endpoint
  umamiWebsiteId: '',                               // e.g. 'a1b2c3d4-....'
  umamiSrc: 'https://cloud.umami.is/script.js',
};

function inject(src: string, attrs: Record<string, string>, opts: { async?: boolean; defer?: boolean } = {}): void {
  const s = document.createElement('script');
  s.src = src;
  if (opts.async) s.async = true;
  if (opts.defer) s.defer = true;
  for (const [k, v] of Object.entries(attrs)) s.setAttribute(k, v);
  document.head.appendChild(s);
}

let started = false;

/** Load whichever provider beacons are configured. Idempotent; a no-op for any provider left empty. */
export function initAnalytics(): void {
  if (started || typeof document === 'undefined') return;
  started = true;
  if (CONFIG.cloudflareToken)
    inject('https://static.cloudflareinsights.com/beacon.min.js',
      { 'data-cf-beacon': JSON.stringify({ token: CONFIG.cloudflareToken, spa: true }) }, { defer: true });
  if (CONFIG.umamiWebsiteId)
    inject(CONFIG.umamiSrc, { 'data-website-id': CONFIG.umamiWebsiteId }, { defer: true });
  if (CONFIG.goatcounter)
    inject('//gc.zgo.at/count.js', { 'data-goatcounter': CONFIG.goatcounter }, { async: true });
}

/** Record a virtual pageview for the opened section across the configured providers. Safe before scripts load. */
export function trackSection(id: string): void {
  if (typeof window === 'undefined') return;
  const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL || '/'; // '/apex/' on Pages, '/' on Vercel
  const path = `${base}${id}`;
  const w = window as unknown as {
    goatcounter?: { count?: (o: { path: string; title: string; event: boolean }) => void };
    umami?: { track?: (fn: (props: Record<string, unknown>) => Record<string, unknown>) => void };
  };
  try { w.goatcounter?.count?.({ path, title: id, event: false }); } catch { /* not loaded yet */ }
  try { if (typeof w.umami?.track === 'function') w.umami.track((props) => ({ ...props, url: path })); } catch { /* not loaded yet */ }
  try { vercelTrack('section', { id }); } catch { /* vercel analytics absent off-Vercel */ }
}
