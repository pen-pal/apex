// ARP spoofing (ARP cache poisoning) — the oldest man-in-the-middle trick on a local network, and it works
// because ARP has zero authentication. To send an IP packet to another machine on the same LAN, your computer
// must learn that machine's MAC address, so it broadcasts "who has 192.168.1.1?" and caches whatever reply
// comes back. The catch: a host will believe ANY ARP reply — even one it never asked for (a "gratuitous" ARP)
// — and overwrite its cache. So an attacker on the LAN simply announces, unsolicited and repeatedly, "192.168.1.1
// (the gateway) is at MY MAC address." The victim's ARP cache gets poisoned, and now every packet the victim
// sends toward the internet goes to the attacker instead. The attacker forwards it on to the real gateway
// (staying invisible) while reading and optionally modifying everything in between — the classic MITM. It needs
// no exploit, just the ability to send frames on the segment. Defenses attack it at three layers: pin the
// gateway's MAC with a STATIC ARP entry so dynamic replies can't overwrite it; have the SWITCH enforce
// DHCP-snooping bindings and drop forged ARP (Dynamic ARP Inspection); and use TLS end-to-end so that even a
// successful MITM only sees ciphertext and can't tamper without a certificate error. This models the poisoning
// and which defense stops it. Reference: RFC 826 (ARP); the classic LAN MITM.

export interface Config {
  staticArp: boolean; // victim pins the gateway's MAC (dynamic replies can't overwrite it)
  dai: boolean;       // switch enforces DHCP-snooping bindings and drops forged ARP replies
  tls: boolean;       // traffic is end-to-end encrypted
}

export interface Step { actor: 'victim' | 'attacker' | 'gateway' | 'switch'; detail: string; blocked?: boolean }
export interface Result {
  steps: Step[];
  poisoned: boolean;    // did the victim's ARP cache get overwritten?
  mitm: boolean;        // is the attacker in the traffic path?
  contentExposed: boolean; // can the attacker read/modify the traffic content?
  blockedBy: string | null;
  gatewayMacInCache: 'gateway' | 'attacker';
}

export function simulate(cfg: Config): Result {
  const steps: Step[] = [
    { actor: 'victim', detail: 'Victim needs the gateway’s MAC: broadcasts “who has 192.168.1.1?”' },
    { actor: 'gateway', detail: 'Gateway replies “192.168.1.1 is at GW:MAC”; victim caches it' },
    { actor: 'attacker', detail: 'Attacker sends an unsolicited ARP reply: “192.168.1.1 is at ATTACKER:MAC”' },
  ];

  if (cfg.staticArp) {
    steps.push({ actor: 'victim', detail: 'The gateway entry is STATIC — the victim ignores the dynamic reply', blocked: true });
    return { steps, poisoned: false, mitm: false, contentExposed: false, blockedBy: 'Static ARP entry for the gateway', gatewayMacInCache: 'gateway' };
  }
  if (cfg.dai) {
    steps.push({ actor: 'switch', detail: 'Dynamic ARP Inspection: the switch sees the reply violates the DHCP-snooping binding and drops it', blocked: true });
    return { steps, poisoned: false, mitm: false, contentExposed: false, blockedBy: 'Dynamic ARP Inspection (DHCP snooping)', gatewayMacInCache: 'gateway' };
  }

  steps.push({ actor: 'victim', detail: 'Victim’s ARP cache is overwritten: 192.168.1.1 → ATTACKER:MAC' });
  steps.push({ actor: 'victim', detail: 'Victim now sends all gateway-bound traffic to the attacker’s MAC' });
  steps.push({ actor: 'attacker', detail: 'Attacker forwards it to the real gateway — invisibly in the middle (MITM)' });

  if (cfg.tls) {
    steps.push({ actor: 'attacker', detail: 'But the traffic is TLS-encrypted: the attacker sees only ciphertext; tampering triggers a certificate error. (Metadata — who you talk to — still leaks.)' });
    return { steps, poisoned: true, mitm: true, contentExposed: false, blockedBy: null, gatewayMacInCache: 'attacker' };
  }
  steps.push({ actor: 'attacker', detail: 'Plaintext: the attacker reads and can modify everything (credentials, pages, downloads)' });
  return { steps, poisoned: true, mitm: true, contentExposed: true, blockedBy: null, gatewayMacInCache: 'attacker' };
}
