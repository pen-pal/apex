// Service Worker caching strategies. A Service Worker is a script the browser runs between the page and the network; it
// intercepts every fetch and decides how to answer. That decision is a policy with a real tradeoff between freshness,
// speed, and offline availability. This models the five common strategies given whether the network is up and whether a
// cached copy exists: what gets served, whether it's fresh, whether it's fast (cache) or slow (network), and whether it
// kicks off a background revalidation to refresh the cache for next time.

export type Strategy = 'cache-first' | 'network-first' | 'stale-while-revalidate' | 'network-only' | 'cache-only';
export interface Env { online: boolean; cached: boolean }
export interface Outcome { served: 'cache' | 'network' | 'error'; fresh: boolean; fast: boolean; revalidates: boolean; note: string }

const fromCache = (revalidates: boolean, note: string): Outcome => ({ served: 'cache', fresh: false, fast: true, revalidates, note });
const fromNetwork = (note: string): Outcome => ({ served: 'network', fresh: true, fast: false, revalidates: false, note });
const error = (note: string): Outcome => ({ served: 'error', fresh: false, fast: false, revalidates: false, note });

export function handle(strategy: Strategy, env: Env): Outcome {
  switch (strategy) {
    case 'cache-first':
      if (env.cached) return fromCache(false, 'Served from cache immediately — fast, and works offline, but may be stale until the cache is updated.');
      if (env.online) return fromNetwork('Cache miss, so fetched from the network and cached for next time.');
      return error('Cache miss and offline — nothing to serve.');
    case 'network-first':
      if (env.online) return fromNetwork('Fetched fresh from the network (and cached); the slower but always-current path.');
      if (env.cached) return fromCache(false, 'Offline, so fell back to the cached copy — possibly stale, but the app still works.');
      return error('Offline with no cached copy — the request fails.');
    case 'stale-while-revalidate':
      if (env.cached) return fromCache(env.online, env.online ? 'Served the cached copy instantly AND fetched a fresh one in the background to update the cache for next time — fast now, fresh soon.' : 'Served the cached copy instantly; offline, so no background refresh this time.');
      if (env.online) return fromNetwork('No cached copy yet, so fetched from the network and cached it.');
      return error('No cached copy and offline — nothing to serve.');
    case 'network-only':
      return env.online ? fromNetwork('Always goes to the network — never cached, so always fresh but dead offline.') : error('network-only offline — the request fails; there is no cache to fall back to.');
    case 'cache-only':
      return env.cached ? fromCache(false, 'Served from the precached cache; never touches the network (a fixed app shell).') : error('cache-only with nothing cached — the request fails.');
  }
}
