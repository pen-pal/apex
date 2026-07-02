// ARP spoofing / LAN man-in-the-middle, deep-taught on the GuidedStory engine (offensive arc, phase 2). ARP has no
// authentication, so a host caches any reply to "who has this IP?" — even an unsolicited one. An attacker announces
// "the gateway is at MY MAC," the victim's cache flips, and traffic flows through the attacker. Narrated scenes walk
// the mechanism; the interactive is the REAL model from the tested arpspoof.ts (simulate) with the three defenses.
// Sandboxed/CONCEPTUAL. Defenses-forward (static ARP, Dynamic ARP Inspection, TLS content-safety).
import { useState } from 'react';
import { simulate, type Config } from './arpspoof';
import { GuidedStory, type StoryScene } from './GuidedStory';

const GW_MAC = 'aa:bb:cc:00:11:22', ATK_MAC = 'de:ad:be:ef:00:01';
type Phase = 'resolve' | 'gratuitous' | 'flip' | 'mitm' | 'defenses' | 'run';
const OFF: Config = { staticArp: false, dai: false, tls: false };

export function ArpSpoofSection() {
  const [cfg, setCfg] = useState<Config>({ staticArp: false, dai: false, tls: false });
  const toggle = (k: keyof Config) => setCfg((c) => ({ ...c, [k]: !c[k] }));

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string, c: Config): StoryScene =>
    ({ key, title, caption, render: () => <Arp phase={key} cfg={c} /> });

  const scenes: StoryScene[] = [
    scene('resolve', 'ARP maps IP to MAC — on trust', 'To send a packet to another machine on the same LAN, your computer needs its MAC address. It broadcasts “who has 192.168.1.1?” and caches whoever replies “I do, at this MAC.” There is no authentication: any host can answer, and can even volunteer an answer nobody asked for.', OFF),
    scene('gratuitous', 'The gratuitous ARP lie', 'The attacker exploits exactly that. It repeatedly sends the victim an unsolicited ARP reply: “192.168.1.1 — the gateway — is at MY MAC.” Nobody asked; ARP doesn’t care. The victim simply overwrites its cache with the most recent reply it heard.', OFF),
    scene('flip', 'The victim’s cache flips', 'Now the victim’s ARP cache maps the gateway’s IP to the attacker’s MAC. As far as the victim’s network stack is concerned, the attacker <em>is</em> the gateway — every packet bound for the internet will be addressed to the attacker’s network card.', OFF),
    scene('mitm', 'Traffic flows through the attacker', 'The attacker forwards each packet on to the real gateway, so nothing breaks and the victim notices nothing — but it now sits in the middle of every connection, free to read, modify, or drop. That is a man-in-the-middle, built from one unauthenticated protocol on a shared wire.', OFF),
    scene('defenses', 'Stopping it', 'Static ARP pins the gateway’s MAC so forged replies are ignored. Dynamic ARP Inspection has the switch check every ARP against its DHCP-snooping table and drop the lies. TLS can’t stop the interception, but makes it useless — the attacker sees only authenticated ciphertext (though it still learns who you talk to).', { staticArp: true, dai: false, tls: false }),
    { key: 'run', title: 'Run it against the defenses', caption: 'Toggle the three defenses and watch the real outcome: with none, the cache flips and the attacker reads plaintext (full compromise). Static ARP or DAI block the poisoning outright. TLS alone leaves the MITM in place but encrypts the content. This runs the actual model from the tested module.', render: () => <Arp phase="run" cfg={cfg} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>To send a packet to another machine on the same LAN, your computer needs its MAC address, so it broadcasts “who has 192.168.1.1?” and caches whoever answers “I do, at this MAC.” ARP has no authentication at all — any host can answer, and can even volunteer an answer nobody asked for (a <em>gratuitous</em> ARP). So an attacker on your network just announces “the gateway is at MY MAC,” your machine believes it, and everything you send toward the internet goes to the attacker instead.</>,
        takeaway: <>The attacker becomes a man-in-the-middle: it forwards your traffic on to the real gateway so nothing breaks and you notice nothing, while reading, modifying, or dropping it in the middle. This works because ARP is stateless and trusting — it caches the last reply it saw, solicited or not. Defenses: <strong>static ARP</strong> entries pin the gateway’s MAC so forged replies are ignored; <strong>Dynamic ARP Inspection</strong> has the switch validate every ARP against its DHCP-snooping table and drop the lies; and <strong>TLS</strong> doesn’t stop the interception but makes it useless — the attacker sees only authenticated ciphertext, so it can’t read or tamper (though it still learns who you talk to). It is the same theme as DNS poisoning: an unauthenticated “trust the last thing you heard” protocol on a shared medium.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="asp-ctl">
          <button type="button" className={`asp-def ${cfg.staticArp ? 'on' : ''}`} onClick={() => toggle('staticArp')}><span className="asp-check">{cfg.staticArp ? '✓' : ''}</span> static ARP</button>
          <button type="button" className={`asp-def ${cfg.dai ? 'on' : ''}`} onClick={() => toggle('dai')}><span className="asp-check">{cfg.dai ? '✓' : ''}</span> DAI</button>
          <button type="button" className={`asp-def ${cfg.tls ? 'on' : ''}`} onClick={() => toggle('tls')}><span className="asp-check">{cfg.tls ? '✓' : ''}</span> TLS</button>
        </div>
      )}
    />
  );
}

function Arp({ phase, cfg }: { phase: Phase; cfg: Config }) {
  const r = simulate(cfg);
  const live = phase === 'run' || phase === 'defenses';
  const poisoned = phase === 'flip' || phase === 'mitm' || (live && r.gatewayMacInCache === 'attacker');
  const showLie = phase === 'gratuitous' || phase === 'flip' || (live && poisoned);
  const mitm = phase === 'mitm' || (live && poisoned);
  const direct = phase === 'resolve' || (live && !poisoned);
  const verdict = !live
    ? null
    : r.blockedBy ? { cls: 'ok', text: `✓ BLOCKED — ${r.blockedBy}; the cache is never poisoned` }
      : r.contentExposed ? { cls: 'bad', text: '⚠ FULL COMPROMISE — attacker is in the path and reads/modifies plaintext' }
        : { cls: 'mid', text: '◐ MITM established — cache poisoned, but TLS keeps the content encrypted (metadata still leaks)' };

  return (
    <svg viewBox="0 0 900 480" className="story-svg">
      {/* hosts */}
      <rect x="60" y="96" width="160" height="66" rx="8" className="asp-s-host v" />
      <text x="140" y="124" className="asp-s-hlbl" textAnchor="middle">victim</text>
      <text x="140" y="146" className="asp-s-hsub" textAnchor="middle">192.168.1.10</text>
      <rect x="680" y="96" width="160" height="66" rx="8" className="asp-s-host g" />
      <text x="760" y="124" className="asp-s-hlbl" textAnchor="middle">gateway</text>
      <text x="760" y="146" className="asp-s-hsub" textAnchor="middle">192.168.1.1</text>
      <rect x="370" y="300" width="160" height="66" rx="8" className="asp-s-host a" />
      <text x="450" y="328" className="asp-s-hlbl" textAnchor="middle">attacker</text>
      <text x="450" y="350" className="asp-s-hsub" textAnchor="middle">{ATK_MAC}</text>

      {/* direct path */}
      {direct && <><line x1="222" y1="126" x2="678" y2="126" className="asp-s-flow ok" markerEnd="url(#asp-ar-ok)" /><text x="450" y="116" className="asp-s-flbl ok" textAnchor="middle">traffic → the internet</text></>}

      {/* gratuitous ARP lie */}
      {showLie && <><line x1="420" y1="300" x2="200" y2="160" className="asp-s-lie" markerEnd="url(#asp-ar-bad)" /><text x="270" y="250" className="asp-s-lietxt" textAnchor="middle">“192.168.1.1 is at {ATK_MAC}”</text></>}

      {/* MITM path victim → attacker → gateway */}
      {mitm && <>
        <line x1="150" y1="164" x2="400" y2="298" className="asp-s-flow bad" markerEnd="url(#asp-ar-bad)" />
        <line x1="500" y1="320" x2="700" y2="164" className="asp-s-flow bad" markerEnd="url(#asp-ar-bad)" />
        <text x="450" y="392" className="asp-s-flbl bad" textAnchor="middle">every packet passes through the attacker (MITM)</text>
      </>}

      {/* victim ARP cache */}
      <rect x="60" y="196" width="300" height="52" rx="8" className={`asp-s-cache ${poisoned ? 'bad' : 'ok'}`} />
      <text x="76" y="216" className="asp-s-clbl">victim ARP cache: 192.168.1.1 →</text>
      <text x="76" y="238" className={`asp-s-mac ${poisoned ? 'bad' : 'ok'}`}>{poisoned ? `${ATK_MAC}  (attacker!)` : `${GW_MAC}  (real gateway)`}</text>

      {/* verdict */}
      {verdict && <text x="450" y="436" className={`asp-s-verdict ${verdict.cls}`} textAnchor="middle">{verdict.text}</text>}

      <text x="450" y="462" className="asp-s-foot" textAnchor="middle">
        {phase === 'resolve' ? 'ARP caches the last reply it hears — solicited or not, no authentication'
          : phase === 'gratuitous' ? 'an unsolicited “gateway is at my MAC” — the victim overwrites its cache'
          : phase === 'flip' ? 'the gateway’s IP now points at the attacker’s network card'
          : phase === 'mitm' ? 'forwarded onward, so nothing breaks — the attacker just watches from the middle'
          : phase === 'defenses' ? 'static ARP / DAI stop the poisoning; TLS makes the interception useless'
          : r.blockedBy ? 'the forged ARP is rejected — the cache holds the real gateway MAC'
            : 'the cache is poisoned — traffic is flowing through the attacker'}
      </text>
      <defs>
        <marker id="asp-ar-ok" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" className="asp-s-ah-ok" /></marker>
        <marker id="asp-ar-bad" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" className="asp-s-ah-bad" /></marker>
      </defs>
    </svg>
  );
}
