// DNS cache poisoning & the Kaminsky attack — how, in 2008, Dan Kaminsky showed you could take over a whole
// domain in a recursive resolver's cache in SECONDS. A resolver asks an authoritative server "what's the IP
// for www.bank.com?" and accepts the FIRST valid-looking UDP reply. An off-path attacker can't see the query,
// so they must GUESS what makes a reply look valid: the 16-bit query ID (and, back then, a fixed source
// port). 16 bits is only 65,536 possibilities — forgeable. The old wisdom was "you get one shot, then it's
// cached for hours (TTL), so it's slow." Kaminsky's trick killed that: query for RANDOM names
// (aaa1.bank.com, aaa2.bank.com…) that are never cached, so every guess is a fresh race, and forge a reply
// whose ADDITIONAL section poisons the nameserver (NS/glue) for the entire zone. Unlimited attempts → minutes
// to win. The fix wasn't a new protocol but ENTROPY: randomize the source port (+16 bits, RFC 5452) and the
// query name's letter case (0x20 encoding), and ultimately DNSSEC signatures. Reference: Kaminsky (2008);
// RFC 5452.

export interface Defenses { portRandom: boolean; case0x20Letters: number; dnssec: boolean }

/** Bits of entropy an off-path attacker must guess to forge an accepted reply. */
export function entropyBits(d: Defenses): number {
  if (d.dnssec) return Infinity;                 // signed answers can't be forged at all
  return 16 + (d.portRandom ? 16 : 0) + Math.max(0, d.case0x20Letters); // query ID + source port + 0x20 case bits
}

/** Probability a single forged packet is accepted. */
export const perAttemptOdds = (bits: number): number => (bits === Infinity ? 0 : Math.pow(2, -bits));

/** Expected number of forged packets to win (geometric mean = 1/p = 2^bits). */
export const expectedAttempts = (bits: number): number => (bits === Infinity ? Infinity : Math.pow(2, bits));

/** Expected wall-clock time to poison, given how many forged packets/sec the attacker can send while racing
 *  (Kaminsky's random-name trick means every packet is a live attempt — no TTL lockout). */
export function timeToPoison(bits: number, packetsPerSec: number): number {
  if (bits === Infinity || packetsPerSec <= 0) return Infinity;
  return expectedAttempts(bits) / packetsPerSec;
}
