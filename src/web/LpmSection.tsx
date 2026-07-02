// Guided story #6: how a router forwards a packet — longest-prefix match, on the GuidedStory engine. Routing
// protocols (the routing/OSPF/BGP sections) LEARN routes; this is the data plane: given one packet, which port?
// Scenes: the packet arrives, the forwarding table, several prefixes match at once, the LONGEST (most specific) wins,
// the prefixes as a nested trie, then a live box — type a destination and watch the match. Real prefix arithmetic.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

type Row = { prefix: string; len: number; base: number; port: string; note?: string };
const TABLE: Row[] = [
  { prefix: '0.0.0.0', len: 0, base: 0, port: 'A', note: 'default — everything else' },
  { prefix: '10.0.0.0', len: 8, base: 0x0a000000, port: 'B' },
  { prefix: '10.1.0.0', len: 16, base: 0x0a010000, port: 'C' },
  { prefix: '10.1.2.0', len: 24, base: 0x0a010200, port: 'D' },
];
const ip2int = (s: string) => { const p = s.split('.').map(Number); return p.length === 4 && p.every((x) => x >= 0 && x <= 255) ? ((p[0] << 24) | (p[1] << 16) | (p[2] << 8) | p[3]) >>> 0 : NaN; };
const matches = (d: number, r: Row) => r.len === 0 || (d >>> (32 - r.len)) === (r.base >>> (32 - r.len));
const lookup = (d: number) => { let best = -1, port = '—'; for (const r of TABLE) if (!isNaN(d) && matches(d, r) && r.len >= best) { best = r.len; port = r.port; } return { best, port }; };

type Phase = 'arrive' | 'table' | 'match' | 'longest' | 'trie' | 'run';

export function LpmSection() {
  const [dst, setDst] = useState('10.1.2.99');
  const d = ip2int(dst);
  const res = lookup(d);

  const narrated = (key: Phase, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: (a) => <Fib phase={key} dst="10.1.2.99" active={a} /> });

  const scenes: StoryScene[] = [
    narrated('arrive', 'A packet arrives', 'A packet shows up with a destination address — say 10.1.2.99 — and the router has a handful of output ports. Its one job, billions of times a second: pick the right port. It never asks anyone; the answer is already in its forwarding table.'),
    narrated('table', 'The forwarding table', 'Each entry is a prefix (an address plus how many leading bits count) mapped to an output port. /24 means "the first 24 bits must match"; /0 matches everything — the default route.'),
    narrated('match', 'Several entries match', 'For 10.1.2.99, three entries match at once: the /0 default, 10.0.0.0/8, and 10.1.0.0/16 — and 10.1.2.0/24 as well. So which port does the packet take?'),
    narrated('longest', 'Longest prefix wins', 'The most specific match — the longest prefix — wins. 10.1.2.0/24 pins down 24 bits, more than /16 or /8, so it is the most precise route. The packet goes out port D. A more specific route always overrides a broader one.'),
    narrated('trie', 'Why a trie makes it fast', 'Prefixes are stored as a binary trie keyed by address bits. The router walks the destination’s bits down the tree and remembers the deepest prefix it passed. No scanning the whole table — the match falls out of the walk.'),
    { key: 'run', title: 'Try any destination', caption: 'Type a destination address. Watch which prefixes match and which port the longest one sends it to — including addresses that match only the default route.', render: (a) => <Fib phase="run" dst={dst} active={a} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>A router receives a packet, reads its destination address, and in a fraction of a microsecond must choose which link to send it out — billions of times a second, without asking anyone. The answer is already sitting in its forwarding table: a list of address prefixes, each mapped to an output port. The complication is that one address usually matches several prefixes at once, so the router needs a rule to break the tie.</>,
        takeaway: <>The rule is longest-prefix match: the most specific prefix wins — the one that pins down the most leading bits — because a /24 route for one small block should override the /8 route for the whole region and the /0 default that catches everything else. Routers keep the prefixes in a trie and walk the destination’s bits down it, remembering the deepest match, so the decision falls out of a single pass with no scanning. Learning <em>which</em> routes exist (BGP, OSPF) is a separate, slow control-plane job; this is the fast data plane that actually forwards each packet.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <>
          <span className="lpm-live-lbl">destination:</span>
          <input className="lpm-input" value={dst} spellCheck={false} onChange={(e) => setDst(e.target.value)} />
          <span className="lpm-live-note">{isNaN(d) ? 'invalid address' : res.best < 0 ? 'no match' : <>longest match /{res.best} → <b>port {res.port}</b></>}</span>
        </>
      )}
    />
  );
}

function Fib({ phase, dst, active }: { phase: Phase; dst: string; active: boolean }) {
  const on = (p: Phase) => phase === p;
  const d = ip2int(dst);
  const res = lookup(d);
  const showMatch = on('match') || on('longest') || on('run');
  const showWin = on('longest') || on('run');
  return (
    <svg viewBox="0 0 900 480" className="story-svg">
      {/* packet */}
      <rect x="40" y="40" width="230" height="46" rx="8" className="lpm-pkt" />
      <text x="155" y="60" className="lpm-pkt-lbl" textAnchor="middle">packet → dest</text>
      <text x="155" y="78" className="lpm-pkt-ip" textAnchor="middle">{dst}</text>

      {on('trie') ? (
        <>
          {/* nested-prefix trie as a walk down */}
          {[0, 8, 16, 24].map((L, i) => {
            const r = TABLE[i]; const win = showWin;
            return (
              <g key={L}>
                {i > 0 && <line x1="200" y1={130 + (i - 1) * 70 + 22} x2="200" y2={130 + i * 70} className="lpm-triedge" />}
                <circle cx="200" cy={130 + i * 70} r="20" className={`lpm-trienode ${i === 3 && win ? 'win' : ''}`} />
                <text x="200" y={135 + i * 70} className="lpm-trielbl" textAnchor="middle">/{L}</text>
                <text x="240" y={135 + i * 70} className="lpm-triedesc">{r.prefix}/{L} → port {r.port}{i === 3 ? '  ← deepest match' : ''}</text>
              </g>
            );
          })}
          <text x="450" y="450" className="lpm-foot" textAnchor="middle">walk the bits down; the deepest prefix on the path is the answer</text>
        </>
      ) : (
        <>
          {/* forwarding table */}
          <text x="120" y="130" className="lpm-th">prefix</text>
          <text x="360" y="130" className="lpm-th">bits</text>
          <text x="470" y="130" className="lpm-th">port</text>
          {TABLE.map((r, i) => {
            const m = showMatch && !isNaN(d) && matches(d, r);
            const win = showWin && res.best === r.len && m;
            return (
              <g key={i}>
                <rect x="60" y={145 + i * 52} width="500" height="42" rx="6" className={`lpm-row ${win ? 'win' : m ? 'match' : ''}`} />
                <text x="80" y={171 + i * 52} className="lpm-cell">{r.prefix}/{r.len}{r.len === 0 ? ' · default' : ''}</text>
                <text x="372" y={171 + i * 52} className="lpm-cell dim">/{r.len}</text>
                <text x="490" y={171 + i * 52} className={`lpm-cell ${win ? 'winport' : ''}`}>port {r.port}</text>
                {win && <text x="620" y={171 + i * 52} className="lpm-arrow">◄ longest</text>}
              </g>
            );
          })}
          {/* ports on the right */}
          {['A', 'B', 'C', 'D'].map((p, i) => (
            <g key={p}>
              <rect x="770" y={145 + i * 52} width="60" height="42" rx="6" className={`lpm-port ${showWin && res.port === p ? 'lit' : ''}`} />
              <text x="800" y={171 + i * 52} className="lpm-port-lbl" textAnchor="middle">{p}</text>
            </g>
          ))}
          {showWin && !isNaN(d) && res.best >= 0 && active && <line className="lpm-flow" x1="640" y1={166 + (TABLE.findIndex((r) => r.len === res.best)) * 52} x2="770" y2={166 + ['A', 'B', 'C', 'D'].indexOf(res.port) * 52} pathLength={100} />}
          <text x="450" y="455" className="lpm-foot" textAnchor="middle">
            {on('arrive') ? 'the destination address is all the router needs'
              : on('table') ? 'longer prefix = more specific = higher priority'
              : on('match') ? 'a /0 default plus every broader prefix can all match at once'
              : on('longest') ? 'the longest (most specific) prefix wins — port D'
              : (isNaN(d) ? 'enter a valid a.b.c.d address' : res.best < 0 ? 'no route' : `longest match is /${res.best} → port ${res.port}`)}
          </text>
        </>
      )}
    </svg>
  );
}
