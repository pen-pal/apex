// Onion routing (Tor), the anonymity workhorse behind hidden services, censorship circumvention, and the whole
// "no one relay knows both ends" idea. Wrap your request in one encryption layer per relay, send it through a 3-hop
// circuit, and each relay peels exactly one layer — learning only the previous and next hop. No single relay links
// you to the destination; only a guard+exit collusion (or a global traffic-correlation adversary) can. Auto-plays via
// the GuidedStory engine; the final scene is interactive — compromise relays and watch when you're actually exposed.
// Model + the who-knows-what guarantee are real + tested (tor.ts).
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';
import { circuitHops, deanonymisedBy, DEFAULT_CIRCUIT } from './tor';

const NODES = [
  { id: 'you', label: 'you', icon: '🧅', x: 70 },
  { id: 'g', label: 'Guard · DE', icon: '🖥️', x: 265 },
  { id: 'm', label: 'Middle · NL', icon: '🖥️', x: 450 },
  { id: 'e', label: 'Exit · SE', icon: '🖥️', x: 635 },
  { id: 'dest', label: 'site', icon: '🌐', x: 830 },
];
const LAYER = ['g', 'm', 'e']; // outer→inner encryption layers, one per relay
const HUE: Record<string, number> = { g: 210, m: 280, e: 35 };
const NY = 120;

type Phase = 'clear' | 'onion' | 'circuit' | 'peel' | 'run';

export function TorSection() {
  const [comp, setComp] = useState<Set<string>>(new Set());
  const hops = circuitHops(DEFAULT_CIRCUIT, 'the site');
  const toggle = (id: string) => setComp((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const busted = deanonymisedBy(hops, comp);

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: (a) => <Tor phase={key} active={a} comp={comp} /> });

  const scenes: StoryScene[] = [
    scene('clear', 'Without Tor, everyone sees both ends', 'You connect straight to a site. Your ISP (and anyone on the path) sees your IP talking to the site’s IP; the site sees your IP. Your identity and your destination travel together in the clear — trivially linkable.'),
    scene('onion', 'Wrap it in layers — one per relay', 'Tor picks three relays and wraps your request in three layers of encryption, like an onion: the innermost layer is for the exit, then the middle, then the guard on the outside. Each layer can only be opened by that one relay’s key.'),
    scene('circuit', 'Send it through the circuit', 'You hand the whole onion to the first relay — the guard. It’s the only relay that talks to you directly, so it’s the only one that ever learns your IP. It can’t read inside: the layers underneath aren’t addressed to it.'),
    scene('peel', 'Each relay peels one layer', 'The guard removes its layer and sees just one instruction: “forward to the middle.” The middle peels its layer: “forward to the exit.” The exit peels the last: “fetch this site.” Every relay learns only the previous and next hop — never the whole path.'),
    { key: 'run', title: 'Who can see what — attack it', caption: 'The guarantee: no single relay links you to the site — the guard knows you but not the site, the exit knows the site but not you, the middle knows neither. Click relays to “compromise” them and watch: you’re only de-anonymised if the GUARD and the EXIT both belong to the attacker (endpoint correlation).', render: (a) => <Tor phase="run" active={a} comp={comp} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>Onion routing hides <em>who is talking to whom</em>. Your request is wrapped in one layer of encryption per relay in a three-hop circuit; each relay peels exactly one layer and learns only the hop it came from and the hop to send to. The <strong>guard</strong> knows your IP but not where you’re going; the <strong>exit</strong> knows the destination but not who you are; the <strong>middle</strong> knows neither. No single relay can link you to the site — that separation is the whole idea.</>,
        takeaway: <>Anonymity here is <em>unlinkability</em>, not encryption of content: the exit still speaks plain to the site (so use HTTPS end-to-end, or an onion service where the site is inside Tor too). The scheme breaks only when the <strong>endpoints collude</strong> — if the same adversary runs your guard <em>and</em> your exit they can correlate timing and volume to link you; this is why Tor pins a long-lived <strong>guard</strong> (to lower the odds your entry is ever malicious) and why a <strong>global passive adversary</strong> watching all links is the acknowledged limit. Hidden/onion services extend the idea so both sides are anonymous and the “server” has no public IP at all — the backbone of censorship-resistant publishing. (Tor: Dingledine, Mathewson, Syverson, 2004.)</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <>
          <span className="tor-live-lbl">click a relay to compromise it:</span>
          {DEFAULT_CIRCUIT.map((r) => (
            <button key={r.id} type="button" className={`tor-comp ${comp.has(r.id) ? 'on' : ''}`} onClick={() => toggle(r.id)}>{comp.has(r.id) ? '☠ ' : ''}{r.name}</button>
          ))}
          <span className={`tor-verdict ${busted ? 'bad' : 'ok'}`}>{busted ? '☠ de-anonymised — guard + exit collude' : comp.size ? '🔒 still anonymous — endpoints not both owned' : '🔒 anonymous'}</span>
        </>
      )}
    />
  );
}

function Tor({ phase, comp }: { phase: Phase; active: boolean; comp: Set<string> }) {
  const on = (p: Phase) => phase === p;
  const relaysShown = !on('clear');
  const hops = circuitHops(DEFAULT_CIRCUIT, 'the site');
  const busted = deanonymisedBy(hops, comp);
  // how many layers are still on the onion at each relay's position (peel scene): guard→3, after guard→2, etc.
  const nodeX = (id: string) => NODES.find((n) => n.id === id)!.x;

  return (
    <svg viewBox="0 0 900 460" className="story-svg">
      {/* the wire */}
      <line x1="70" y1={NY} x2="830" y2={NY} className="tor-wire" />

      {/* nodes */}
      {NODES.map((n) => {
        const isRelay = n.id === 'g' || n.id === 'm' || n.id === 'e';
        const dim = isRelay && !relaysShown;
        const busted2 = isRelay && comp.has(n.id);
        return (
          <g key={n.id} opacity={dim ? 0.18 : 1}>
            <circle cx={n.x} cy={NY} r="26" className={`tor-node ${n.id === 'you' ? 'you' : n.id === 'dest' ? 'dest' : 'relay'} ${busted2 ? 'busted' : ''}`} />
            <text x={n.x} y={NY + 7} className="tor-ico" textAnchor="middle">{busted2 ? '☠' : n.icon}</text>
            <text x={n.x} y={NY + 46} className="tor-nlbl" textAnchor="middle">{n.label}</text>
          </g>
        );
      })}

      {/* clear scene: direct link + watchers */}
      {on('clear') && <>
        <line x1="96" y1={NY} x2="804" y2={NY} className="tor-directflow" pathLength={100} />
        <text x="450" y={NY - 16} className="tor-cell-lbl danger" textAnchor="middle">your IP → the site (in the clear)</text>
        <text x="450" y="250" className="tor-eye" textAnchor="middle">👁 ISP / anyone on the path</text>
        <text x="450" y="276" className="tor-see danger" textAnchor="middle">sees YOU ↔ the SITE — identity + destination linked</text>
      </>}

      {/* the onion (nested layers) — onion & circuit scenes */}
      {(on('onion') || on('circuit')) && <g>
        <text x="450" y="222" className="tor-cell-lbl" textAnchor="middle">the onion — 3 nested encryption layers, one per relay</text>
        {LAYER.map((l, i) => {
          const w = 150 - i * 40, h = 128 - i * 34;
          return <g key={l}>
            <rect x={450 - w / 2} y={304 - h / 2} width={w} height={h} rx="9" className="tor-layer"
              fill={`hsl(${HUE[l]} 60% 55% / .2)`} stroke={`hsl(${HUE[l]} 60% 58%)`} strokeWidth="1.5" />
            <text x={450 - w / 2 + 8} y={304 - h / 2 + 15} className="tor-layer-lbl" fill={`hsl(${HUE[l]} 55% 62%)`}>{l === 'g' ? 'guard' : l === 'm' ? 'mid' : 'exit'}</text>
          </g>;
        })}
        <text x="450" y="309" className="tor-core" textAnchor="middle">GET</text>
        {on('circuit') && <text x="450" y="392" className="tor-see" textAnchor="middle">handed to the guard — only it learns your IP, and it can’t read inside</text>}
      </g>}

      {/* peel scene: a shrinking onion between hops */}
      {on('peel') && <g>
        {['g', 'm', 'e'].map((rid, i) => {
          const x = nodeX(rid);
          const left = 3 - i; // layers remaining as it arrives
          return <g key={rid}>
            {Array.from({ length: left }, (_, k) => (
              <rect key={k} x={x - (13 - k * 4)} y={NY - 62 - (13 - k * 4)} width={(26 - k * 8)} height={(26 - k * 8)} rx="3"
                className="tor-layer" fill={`hsl(${HUE[LAYER[i + k]]} 60% 55% / .3)`} stroke={`hsl(${HUE[LAYER[i + k]]} 60% 58%)`} />
            ))}
            <text x={x} y={NY - 78} className="tor-peel-lbl" textAnchor="middle">{i === 0 ? '“→ middle”' : i === 1 ? '“→ exit”' : '“→ site”'}</text>
          </g>;
        })}
        <text x="450" y="300" className="tor-see" textAnchor="middle">each relay peels one layer → learns only prev + next hop, never the whole path</text>
      </g>}

      {/* run scene: what each relay knows */}
      {on('run') && <g>
        {hops.map((h) => {
          const x = nodeX(h.relay.id);
          return <g key={h.relay.id}>
            <text x={x} y={NY - 52} className="tor-knows" textAnchor="middle">{h.prevHop} → {h.nextHop}</text>
            <text x={x} y={218} className={`tor-sees ${h.seesOrigin ? 'you' : ''}`} textAnchor="middle">{h.seesOrigin ? 'knows YOU' : 'not you'}</text>
            <text x={x} y={236} className={`tor-sees ${h.seesDest ? 'dest' : ''}`} textAnchor="middle">{h.seesDest ? 'knows SITE' : 'not the site'}</text>
          </g>;
        })}
        <text x="450" y={busted ? 300 : 300} className={`tor-verdict-svg ${busted ? 'bad' : 'ok'}`} textAnchor="middle">
          {busted ? '☠ guard + exit both compromised → timing correlation links you to the site' : 'no single relay links you to the site — anonymity holds'}
        </text>
      </g>}

      <text x="450" y="446" className="tor-foot" textAnchor="middle">
        {on('clear') ? 'a direct connection ties your identity to your destination'
          : on('onion') ? 'one encryption layer per relay — only that relay’s key opens it'
            : on('circuit') ? 'the guard is the only relay that ever sees your real IP'
              : on('peel') ? 'prev-hop + next-hop only: the path is never known to any one relay'
                : busted ? 'endpoint correlation is the real threat — not breaking the crypto' : 'compromise the guard AND the exit to break it'}
      </text>
    </svg>
  );
}
