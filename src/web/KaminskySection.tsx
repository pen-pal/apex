// DNS cache poisoning (the 2008 Kaminsky attack), deep-taught on the GuidedStory engine (offensive arc, phase 2). An
// off-path attacker floods forged replies guessing the 16-bit query ID; Kaminsky's random-subdomain trick removed the
// TTL lockout so every guess is a fresh race, and glue records poison the whole zone. The only fix is entropy. Narrated
// scenes walk the race; the interactive is the REAL entropy/time-to-poison calculator from the tested kaminsky.ts.
// Sandboxed/CONCEPTUAL. Defenses-forward (source-port randomization, 0x20, DNSSEC).
import { useState } from 'react';
import { entropyBits, expectedAttempts, timeToPoison } from './kaminsky';
import { GuidedStory, type StoryScene } from './GuidedStory';

const NAME = 'www.bank.com';
const humanTime = (s: number): string => {
  if (!isFinite(s)) return 'never';
  if (s < 1) return `${(s * 1000).toFixed(0)} ms`;
  if (s < 90) return `${s.toFixed(1)} s`;
  if (s < 5400) return `${(s / 60).toFixed(1)} min`;
  if (s < 172800) return `${(s / 3600).toFixed(1)} h`;
  return `${(s / 86400).toFixed(1)} days`;
};

type Def = { portRandom: boolean; zero: boolean; dnssec: boolean };
const bitsOf = (d: Def) => entropyBits({ portRandom: d.portRandom, case0x20Letters: d.zero ? 10 : 0, dnssec: d.dnssec });
type Phase = 'cache' | 'forge' | 'lockout' | 'kaminsky' | 'defenses' | 'run';

export function KaminskySection() {
  const [d, setD] = useState<Def>({ portRandom: false, zero: false, dnssec: false });
  const [rate, setRate] = useState(100000);
  const NONE: Def = { portRandom: false, zero: false, dnssec: false };

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string, def: Def): StoryScene =>
    ({ key, title, caption, render: () => <Kam phase={key} def={def} rate={100000} /> });

  const scenes: StoryScene[] = [
    scene('cache', 'The resolver trusts the first reply', 'When your resolver doesn’t have an answer it asks an authoritative server and caches whatever comes back — accepting the first UDP reply that matches the query’s 16-bit ID, source port, and question. Match those and the resolver believes you.', NONE),
    scene('forge', 'Off-path forgery: guess the ID', 'An attacker who can’t see your query can still flood the resolver with forged replies, each guessing the 16-bit ID. Only 65,536 values. If a forgery with the right ID arrives before the real answer, the resolver caches the attacker’s IP for the bank — and everyone using that resolver is redirected.', NONE),
    scene('lockout', 'The old limit: cache lockout', 'Historically this was slow. Guess wrong and the real answer arrives and gets cached, so you had to wait out its TTL — often hours — before racing the same name again. Brute-forcing 16 bits one slow shot at a time was impractical.', NONE),
    scene('kaminsky', 'Kaminsky’s trick: random names', 'In 2008 Kaminsky removed the wait. Query random, never-cached names — a1.bank.com, a2.bank.com, … — so every attempt triggers a fresh lookup with no TTL lockout, an unlimited stream of races. And put the poison in the reply’s authority/glue records (bank.com → attacker’s nameserver), so one win hijacks the entire zone. Time-to-poison fell from days to seconds.', NONE),
    scene('defenses', 'The only fix is entropy', 'Every defense multiplies the fields the attacker must guess. Source-port randomization adds ~16 bits (RFC 5452); 0x20 case-mixing adds a bit per letter in the name; DNSSEC signs the answer so a forgery is simply rejected. Stack them and the expected packets exceed anything an attacker can send before the real reply lands.', { portRandom: true, zero: false, dnssec: false }),
    { key: 'run', title: 'Do the entropy math', caption: 'Toggle the defenses and set the attacker’s packet rate. The entropy, per-packet odds, and time-to-poison are the real numbers: 16 bits falls in well under a second, source-port randomization alone pushes it to hours, and DNSSEC makes a forgery unforgeable no matter how lucky the guess.', render: () => <Kam phase="run" def={d} rate={rate} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>In the DNS rung you watched a resolver look up a name and cache the answer; here you forge that answer. A DNS resolver that doesn’t have an answer asks an upstream server and caches whatever comes back — accepting the first UDP reply that matches the query’s 16-bit ID. An off-path attacker who can’t see the query can still flood forged replies, guessing that ID. Only 65,536 values; if a forgery with the right ID lands before the real answer, the resolver caches the attacker’s IP — for the whole domain, and for everyone behind that resolver.</>,
        takeaway: <>The old defense was accidental: fail the race and the real answer gets cached, so you had to wait out its TTL before retrying — too slow to brute a 16-bit ID. Kaminsky’s 2008 trick removed that wait: query random, uncached subdomains (<code>a1.bank.com</code>, <code>a2…</code>) so every attempt is a fresh race with no lockout, and put the poison in the reply’s authority/glue records so one win hijacks the entire zone. Time-to-poison dropped from days to seconds. The real fix is entropy: source-port randomization adds ~16 bits (RFC 5452), 0x20 case-randomization adds a bit per letter in the name, and DNSSEC signs the answer so a forgery simply fails verification — no amount of guessing helps. It’s the same lesson as hash-flooding: when an attacker can retry cheaply, safety is unpredictability they can’t precompute. (Kaminsky 2008; RFC 5452.)</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="kam-ctl">
          <label className={`kam-def ${d.portRandom ? 'on' : ''}`}><input type="checkbox" checked={d.portRandom} onChange={(e) => setD({ ...d, portRandom: e.target.checked })} /> source-port <span>+16b</span></label>
          <label className={`kam-def ${d.zero ? 'on' : ''}`}><input type="checkbox" checked={d.zero} onChange={(e) => setD({ ...d, zero: e.target.checked })} /> 0x20 case <span>+10b</span></label>
          <label className={`kam-def ${d.dnssec ? 'on' : ''}`}><input type="checkbox" checked={d.dnssec} onChange={(e) => setD({ ...d, dnssec: e.target.checked })} /> DNSSEC <span>signed</span></label>
          <label className="kam-rate">rate<input type="range" min={1000} max={1000000} step={1000} value={rate} onChange={(e) => setRate(+e.target.value)} /><b>{(rate / 1000).toLocaleString()}k/s</b></label>
        </div>
      )}
    />
  );
}

function Kam({ phase, def, rate }: { phase: Phase; def: Def; rate: number }) {
  const bits = bitsOf(def);
  const time = timeToPoison(bits, rate);
  const feasible = isFinite(time) && time < 3600;
  const poisoned = phase === 'kaminsky' || phase === 'forge' || (phase === 'run' && feasible && !def.dnssec);
  const cacheIP = poisoned ? '6.6.6.6  (attacker)' : '93.184.16.34  (real)';
  const flood = phase === 'forge' || phase === 'kaminsky' || phase === 'run';
  return (
    <svg viewBox="0 0 900 480" className="story-svg">
      <rect x="40" y="70" width="150" height="70" rx="8" className="kam-s-box atk" />
      <text x="115" y="100" className="kam-s-boxlbl" textAnchor="middle">attacker</text>
      <text x="115" y="122" className="kam-s-sub" textAnchor="middle">off-path</text>
      <rect x="375" y="70" width="150" height="70" rx="8" className="kam-s-box res" />
      <text x="450" y="100" className="kam-s-boxlbl" textAnchor="middle">resolver</text>
      <text x="450" y="122" className="kam-s-sub" textAnchor="middle">query ID 0x7a3f</text>
      <rect x="710" y="70" width="150" height="70" rx="8" className="kam-s-box auth" />
      <text x="785" y="100" className="kam-s-boxlbl" textAnchor="middle">authoritative</text>
      <text x="785" y="122" className="kam-s-sub" textAnchor="middle">the real {NAME}</text>

      {flood && [0, 1, 2].map((i) => <line key={i} x1="200" y1={90 + i * 14} x2="368" y2={100 + i * 6} className="kam-s-forge" markerEnd="url(#kam-arr-r)" />)}
      {flood && <text x="284" y="66" className="kam-s-flbl" textAnchor="middle">forged replies, guessing ID ↦</text>}
      <line x1="705" y1="118" x2="530" y2="112" className="kam-s-real" markerEnd="url(#kam-arr-l)" />
      <text x="620" y="150" className="kam-s-rlbl" textAnchor="middle">real reply, ID 0x7a3f</text>

      {phase === 'kaminsky' && <text x="450" y="178" className="kam-s-rand" textAnchor="middle">querying a1.bank.com, a2.bank.com, … → no TTL lockout, unlimited races</text>}
      {phase === 'lockout' && <text x="450" y="178" className="kam-s-lock" textAnchor="middle">⏱ guessed wrong → real answer cached → wait out the TTL (hours) before retrying</text>}

      <rect x="335" y="198" width="230" height="52" rx="8" className={`kam-s-cache ${poisoned ? 'bad' : 'ok'}`} />
      <text x="450" y="218" className="kam-s-cachelbl" textAnchor="middle">resolver cache: {NAME} →</text>
      <text x="450" y="240" className={`kam-s-ip ${poisoned ? 'bad' : 'ok'}`} textAnchor="middle">{cacheIP}</text>

      <text x="450" y="302" className="kam-s-mathlbl" textAnchor="middle">what the attacker must guess</text>
      <text x="180" y="338" className="kam-s-stat" textAnchor="middle">entropy</text>
      <text x="180" y="362" className="kam-s-val" textAnchor="middle">{bits === Infinity ? '∞' : `${bits} bits`}</text>
      <text x="450" y="338" className="kam-s-stat" textAnchor="middle">expected packets</text>
      <text x="450" y="362" className="kam-s-val" textAnchor="middle">{bits === Infinity ? '∞' : expectedAttempts(bits) > 1e9 ? expectedAttempts(bits).toExponential(1) : expectedAttempts(bits).toLocaleString()}</text>
      <text x="720" y="338" className="kam-s-stat" textAnchor="middle">time to poison</text>
      <text x="720" y="362" className={`kam-s-val ${def.dnssec || !feasible ? 'safe' : 'danger'}`} textAnchor="middle">{humanTime(time)}</text>

      <text x="450" y="452" className="kam-s-foot" textAnchor="middle">
        {phase === 'cache' ? 'the first matching UDP reply wins — the resolver can’t tell forger from server'
          : phase === 'forge' ? '16 bits = 65,536 guesses; at 100k pkt/s the odds fall in under a second'
          : phase === 'lockout' ? 'the TTL wait is what made 16-bit brute force impractical — until Kaminsky'
          : phase === 'kaminsky' ? 'random names + glue records → seconds to hijack the whole zone'
          : phase === 'defenses' ? 'each defense multiplies the search space; DNSSEC removes the guess entirely'
          : def.dnssec ? 'DNSSEC: the answer is signed, so a forged reply is rejected outright'
          : feasible ? '⚠ practically poisonable at this entropy and packet rate' : 'entropy makes it impractical'}
      </text>
      <defs>
        <marker id="kam-arr-r" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" className="kam-s-ah-r" /></marker>
        <marker id="kam-arr-l" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" className="kam-s-ah-l" /></marker>
      </defs>
    </svg>
  );
}
