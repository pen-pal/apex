// Onion routing (Tor), modelled at the level of its actual security guarantee. Your traffic is wrapped in one
// encryption layer per relay in a 3-hop circuit (guard → middle → exit). Each relay removes EXACTLY ONE layer,
// learning only the hop it received from and the hop to forward to — never both who you are and where you're going.
// So no single relay links sender to destination; de-anonymising you needs the guard AND the exit to collude (or a
// global traffic-correlation adversary). The layering is illustrated conceptually; what is modelled + TESTED here is
// the who-knows-what unlinkability property, which is the whole point of onion routing.

export type Relay = { id: string; name: string; country: string };
export type Hop = {
  relay: Relay;
  index: number;
  prevHop: string;   // what this relay sees the cell coming FROM
  nextHop: string;   // what this relay forwards the cell TO
  layersLeft: number; // encryption layers still wrapped when this relay is done peeling
  seesOrigin: boolean; // does this relay know the real sender?
  seesDest: boolean;   // does this relay know the final destination?
  seesContent: boolean; // can this relay read the payload? (only the exit, and only if the site is plain HTTP)
};

const ORIGIN = 'you';

// Walk a circuit you → r0(guard) → r1(middle) → r2(exit) → dest and report what each relay learns as it peels its layer.
export function circuitHops(circuit: Relay[], dest: string): Hop[] {
  const n = circuit.length;
  return circuit.map((relay, i) => ({
    relay,
    index: i,
    prevHop: i === 0 ? ORIGIN : circuit[i - 1].name,
    nextHop: i === n - 1 ? dest : circuit[i + 1].name,
    layersLeft: n - 1 - i,
    seesOrigin: i === 0,          // only the guard talks directly to you
    seesDest: i === n - 1,        // only the exit talks to the destination
    seesContent: i === n - 1,     // only the exit sees the (still TLS-encrypted unless plain HTTP) payload
  }));
}

// The core guarantee: with >=2 relays, NO single relay sees both the origin and the destination.
export function anySingleRelayLinksYou(hops: Hop[]): boolean {
  return hops.some((h) => h.seesOrigin && h.seesDest);
}

// A correlation/collusion attack succeeds only if the endpoints of the circuit (guard + exit) are both adversarial.
export function deanonymisedBy(hops: Hop[], compromised: Set<string>): boolean {
  const guard = hops.find((h) => h.seesOrigin);
  const exit = hops.find((h) => h.seesDest);
  return !!guard && !!exit && compromised.has(guard.relay.id) && compromised.has(exit.relay.id);
}

export const DEFAULT_CIRCUIT: Relay[] = [
  { id: 'g', name: 'Guard', country: '🇩🇪 DE' },
  { id: 'm', name: 'Middle', country: '🇳🇱 NL' },
  { id: 'e', name: 'Exit', country: '🇸🇪 SE' },
];
