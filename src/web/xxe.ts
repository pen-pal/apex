// XXE — XML External Entity injection. XML has a feature almost nobody wanted enabled: an inline DTD can define
// ENTITIES (named text macros), and those entities can pull their value from an EXTERNAL source via a SYSTEM
// identifier — a URL or file path. So a document can say <!ENTITY x SYSTEM "file:///etc/passwd"> and then use
// &x; in its body, and a naively-configured XML parser will dutifully read that file and splice its contents
// into the parsed document. Point a vulnerable endpoint (a SOAP/SAML/SVG/DOCX/config uploader — anything that
// parses XML you send) at this and you get server-side file disclosure (read /etc/passwd, source code, secrets),
// SSRF (make the server fetch http://169.254.169.254/ cloud metadata or internal services), and, using only
// INTERNAL entities that reference each other, a "billion laughs" denial of service where a few lines expand to
// gigabytes. The root cause is the same as ARP spoofing and DNS rebinding: a helpful, unauthenticated feature
// trusted by default. The fix is refreshingly total — DTDs are almost never needed, so disabling DOCTYPE
// processing in the parser shuts down every XXE variant at once. This models the attack variants and which
// parser setting stops each. Reference: OWASP XXE; CWE-611.

export type Attack = 'file' | 'ssrf' | 'billion-laughs';

export interface Config {
  allowDtd: boolean;            // process inline DTDs / DOCTYPE at all (the master switch)
  allowExternalEntities: boolean; // resolve SYSTEM/PUBLIC external entities (file/http)
  expansionLimit: number;       // max entity-expansion factor before the parser bails
}

export interface Step { actor: 'attacker' | 'parser' | 'target'; detail: string; blocked?: boolean }
export type Outcome = 'file-read' | 'ssrf' | 'dos' | 'blocked';
export interface Result { steps: Step[]; outcome: Outcome; blockedBy: string | null; expandedBytes?: number }

const PAYLOAD: Record<Attack, string> = {
  file: '<!DOCTYPE r [<!ENTITY x SYSTEM "file:///etc/passwd">]>\n<data>&x;</data>',
  ssrf: '<!DOCTYPE r [<!ENTITY x SYSTEM "http://169.254.169.254/latest/meta-data/">]>\n<data>&x;</data>',
  'billion-laughs': '<!DOCTYPE r [\n <!ENTITY a "lol">\n <!ENTITY b "&a;&a;…&a;">  (×10)\n <!ENTITY c "&b;&b;…&b;">  (×10)\n … 9 levels …\n]>\n<data>&i;</data>',
};

/** Entity-expansion sizes for billion laughs: leaf bytes × fanout per level. */
export function billionLaughsSizes(levels: number, fanout: number, leafBytes: number): number[] {
  const out: number[] = [];
  for (let i = 0; i <= levels; i++) out.push(leafBytes * Math.pow(fanout, i));
  return out;
}

export const payloadText = (a: Attack): string => PAYLOAD[a];

export function parse(attack: Attack, cfg: Config): Result {
  const steps: Step[] = [
    { actor: 'attacker', detail: `Uploads XML with a crafted DOCTYPE (${attack === 'billion-laughs' ? 'nested internal entities' : 'an external SYSTEM entity'})` },
    { actor: 'parser', detail: 'Server parses the untrusted XML' },
  ];

  if (!cfg.allowDtd) {
    steps.push({ actor: 'parser', detail: 'DOCTYPE / inline-DTD processing is disabled → the entity definitions are ignored entirely', blocked: true });
    return { steps, outcome: 'blocked', blockedBy: 'Disable DTD processing (DOCTYPE)' };
  }

  if (attack === 'billion-laughs') {
    // uses only INTERNAL entities referencing each other — the external-entity switch does NOT stop it
    const expandedBytes = billionLaughsSizes(9, 10, 3).at(-1)!; // 3 × 10⁹ ≈ 3 GB
    steps.push({ actor: 'parser', detail: 'Expands the nested entities: each of 9 levels multiplies the last by 10×' });
    if (expandedBytes > cfg.expansionLimit) {
      steps.push({ actor: 'parser', detail: `Entity-expansion limit hit (${cfg.expansionLimit.toLocaleString()} bytes) → parse aborted`, blocked: true });
      return { steps, outcome: 'blocked', blockedBy: 'Entity-expansion limit', expandedBytes };
    }
    steps.push({ actor: 'target', detail: `A few lines expand to ${(expandedBytes / 1e9).toFixed(1)} GB — memory exhausted, the server falls over (DoS)` });
    return { steps, outcome: 'dos', blockedBy: null, expandedBytes };
  }

  // file / ssrf use an external entity
  if (!cfg.allowExternalEntities) {
    steps.push({ actor: 'parser', detail: 'External entity resolution is disabled → the SYSTEM reference is not fetched', blocked: true });
    return { steps, outcome: 'blocked', blockedBy: 'Disable external entity resolution' };
  }
  if (attack === 'file') {
    steps.push({ actor: 'parser', detail: 'Resolves file:///etc/passwd and splices its contents into the document' });
    steps.push({ actor: 'target', detail: 'The response echoes back the file — server-side file disclosure' });
    return { steps, outcome: 'file-read', blockedBy: null };
  }
  steps.push({ actor: 'parser', detail: 'Fetches http://169.254.169.254/… from the server itself' });
  steps.push({ actor: 'target', detail: 'Cloud metadata (IAM credentials) returned to the attacker — SSRF' });
  return { steps, outcome: 'ssrf', blockedBy: null };
}
