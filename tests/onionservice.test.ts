import { describe, it, expect } from 'vitest';
import { rendezvousKnowledge, mutuallyAnonymous, selfAuthenticates, adversaryView, TOPOLOGY } from '../src/web/onionservice';

// Independent oracle: the Tor onion-service (v3) rendezvous design. No single relay sees both the client's and the
// service's IP; the rendezvous point sees neither (only two spliced circuits); the .onion address = the service's
// public key, so the descriptor is self-authenticating. Asserted against the design, not the code.

describe('onion service rendezvous (v3)', () => {
  const k = rendezvousKnowledge();

  it('no single relay sees both the client and the service IP', () => {
    expect(mutuallyAnonymous(k)).toBe(true);
  });
  it('the rendezvous point sees neither endpoint', () => {
    const rp = k.find((r) => r.role === 'rendezvous point')!;
    expect(rp.seesClientIp).toBe(false);
    expect(rp.seesServiceIp).toBe(false);
  });
  it('the introduction point sees neither IP (it only carries the signal)', () => {
    const ip = k.find((r) => r.role === 'introduction point')!;
    expect(ip.seesClientIp).toBe(false);
    expect(ip.seesServiceIp).toBe(false);
  });
  it("each side's guard sees only its own side", () => {
    const cg = k.find((r) => r.role === "client's guard")!;
    const sg = k.find((r) => r.role === "service's guard")!;
    expect([cg.seesClientIp, cg.seesServiceIp]).toEqual([true, false]);
    expect([sg.seesClientIp, sg.seesServiceIp]).toEqual([false, true]);
  });
  it('a relay seeing both ends would break mutual anonymity', () => {
    expect(mutuallyAnonymous([{ role: 'evil', seesClientIp: true, seesServiceIp: true }])).toBe(false);
  });
  it('the .onion address self-authenticates only as the pubkey with a matching signature', () => {
    expect(selfAuthenticates(true, true)).toBe(true);
    expect(selfAuthenticates(false, true)).toBe(false);
    expect(selfAuthenticates(true, false)).toBe(false);
  });
});

// Independent oracle: end-to-end correlation. A single compromised relay can never deanonymize (mutual anonymity);
// linking the two ends requires learning the client IP from one relay AND the service IP from another — in the Tor
// design that means controlling both guards. Interior relays (middles, rendezvous, intro) reveal no endpoint at all.
describe('deanonymization: what a relay-compromising adversary learns', () => {
  const byRole = (r: string) => TOPOLOGY.find((t) => t.role === r)!;

  it('no single compromised relay can deanonymize', () => {
    for (const relay of TOPOLOGY) {
      expect(adversaryView([relay]).canDeanonymize).toBe(false);
    }
  });
  it('controlling only interior relays (rendezvous + intro + both middles) reveals neither IP', () => {
    const interior = TOPOLOGY.filter((r) => !r.role.includes('guard'));
    const v = adversaryView(interior);
    expect(v.seesClientIp).toBe(false);
    expect(v.seesServiceIp).toBe(false);
    expect(v.canDeanonymize).toBe(false);
  });
  it("controlling BOTH guards sees both IPs and can correlate the two circuits", () => {
    const v = adversaryView([byRole("client's guard"), byRole("service's guard")]);
    expect(v.seesClientIp).toBe(true);
    expect(v.seesServiceIp).toBe(true);
    expect(v.canDeanonymize).toBe(true);
  });
  it('one guard alone is not enough — it sees its own side only', () => {
    expect(adversaryView([byRole("client's guard")]).canDeanonymize).toBe(false);
    expect(adversaryView([byRole("service's guard")]).canDeanonymize).toBe(false);
  });
});
