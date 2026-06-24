// IP anycast — one address, many locations. Several servers in different places all
// advertise the SAME IP prefix into BGP; the routing system then delivers each client's
// packets to whichever instance is topologically nearest (fewest-cost path). No client
// configuration, automatic failover (withdraw a site and its traffic re-routes to the
// next nearest), and natural load spreading by geography. It's how root DNS, public
// resolvers (1.1.1.1, 8.8.8.8), and CDNs/DDoS scrubbers work. Pure routing model, tested.

export interface Site { id: number; name: string; up: boolean }
export interface Client { id: number; name: string; costs: number[] } // path cost to each site (by index)

/** The nearest UP site for a client (lowest path cost; ties broken by lower id). */
export function nearest(client: Client, sites: Site[]): number | null {
  let best: number | null = null, bestCost = Infinity;
  for (const s of sites) {
    if (!s.up) continue;
    const c = client.costs[s.id];
    if (c < bestCost) { bestCost = c; best = s.id; }
  }
  return best;
}

export interface Distribution {
  assignment: Record<number, number | null>; // clientId → siteId (or null if all down)
  load: Record<number, number>;               // siteId → client count
  cost: Record<number, number>;               // clientId → path cost reached
}

/** Route every client to its nearest up site and tally per-site load. */
export function distribute(clients: Client[], sites: Site[]): Distribution {
  const assignment: Record<number, number | null> = {};
  const load: Record<number, number> = {};
  const cost: Record<number, number> = {};
  for (const s of sites) load[s.id] = 0;
  for (const c of clients) {
    const site = nearest(c, sites);
    assignment[c.id] = site;
    cost[c.id] = site === null ? Infinity : c.costs[site];
    if (site !== null) load[site]++;
  }
  return { assignment, load, cost };
}
