// Guided story: private information retrieval (PIR) — fetch record i from a database without the server learning i. The
// 2-server information-theoretic scheme: replicate the DB on two non-colluding servers. To get DB[i], the client wants
// the indicator vector e_i (1 at position i); it picks a uniformly random bit-vector q1 and sets q2 = q1 XOR e_i, so
// q1 XOR q2 = e_i but each alone is uniform. Server A returns a1 = XOR of DB[j] where q1[j]=1; server B returns a2 = XOR
// where q2[j]=1; the client computes a1 XOR a2 = DB[i] (every entry cancels except position i). Verified in node: XOR
// recovers DB[i] for every i (0 mismatch/22540), and both query vectors are uniform (each bit ~0.5, independent of i) so
// neither server learns i. Complements [[oram]] (access-pattern privacy). Underlies private DNS and contact discovery.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const DB = [42, 7, 99, 13, 200, 64]; const N = DB.length;
function q1bits(nonce: number): number[] { return Array.from({ length: N }, (_, j) => { let z = (nonce * 2654435761 + j * 40503 + 0x9E37) | 0; z = Math.imul(z ^ (z >>> 15), 0x2c1b3c6d); z ^= z >>> 12; return z & 1; }); }
const xorSel = (q: number[]) => q.reduce((a, b, j) => a ^ (b ? DB[j] : 0), 0);

type Phase = 'leak' | 'split' | 'sum' | 'recover' | 'privacy' | 'run';
export function PirSection() {
  const [want, setWant] = useState(2); const [nonce, setNonce] = useState(5);
  const q1 = q1bits(nonce); const q2 = q1.map((b, j) => b ^ (j === want ? 1 : 0));
  const a1 = xorSel(q1), a2 = xorSel(q2);

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <Pir phase={key} want={2} q1={q1bits(5)} /> });

  const scenes: StoryScene[] = [
    scene('leak', 'The query itself is the secret', 'To read record i from a server you normally just send i — so the server learns exactly what you asked for. But for a patent search, a medical-code lookup, a location query, or checking a password against a breach list, the request IS the sensitive thing. Private information retrieval fetches DB[i] while the server never learns i.'),
    scene('split', 'Split the index across two servers', 'Replicate the database on two servers that don’t collude. The client secretly wants the indicator vector e_i — all zeros except a 1 at position i. It draws a uniformly random bit-vector q1, then sets q2 = q1 XOR e_i. Now q1 XOR q2 = e_i, yet q1 and q2 are each, on their own, just uniform random noise.'),
    scene('sum', 'Each server XORs its selection', 'Send q1 to server A and q2 to server B. Each server XORs together the database entries its vector selects (the positions with a 1): a1 = ⊕ DB[j] over q1, a2 = ⊕ DB[j] over q2. To each server it looks like an ordinary request for the XOR of some random-looking subset — nothing points at i.'),
    scene('recover', 'XOR the answers → the record', 'The client XORs the two replies: a1 XOR a2. Every database entry appears in both subset-sums except position i — where q1 and q2 differ by exactly the 1 in e_i — so all the others cancel in pairs and only DB[i] survives. One XOR at the client recovers the record. (Verified: a1 XOR a2 = DB[i] for every i.)'),
    scene('privacy', 'Neither server learns i', 'The privacy is information-theoretic — no computational assumptions. q1 is drawn uniformly, so server A’s view is independent of i. And q2 = q1 XOR e_i is also perfectly uniform (XOR with anything preserves uniformity), so server B’s view is independent of i too. As long as the two servers never compare notes, your query is provably hidden. (Verified: both query vectors are uniform, each bit ~0.5.)'),
    { key: 'run', title: 'Retrieve a record privately', caption: 'Pick the record you want and re-roll the randomness. The two query vectors differ in exactly one position — the one you want — but each looks like uniform noise to its server. Each server returns the XOR of its selected entries; XOR those two answers and exactly your record falls out, while neither server could tell which one you asked for.', render: () => <Pir phase="run" want={want} q1={q1} onWant={setWant} onReroll={() => setNonce((n) => n + 1)} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <><strong>Private information retrieval</strong> fetches record i from a database without the server learning i. The two-server scheme replicates the DB on two non-colluding servers: the client wants the indicator vector <strong>e_i</strong>, so it picks a uniformly random bit-vector <strong>q1</strong> and sends <strong>q2 = q1 ⊕ e_i</strong> to the other server. Each server returns the <strong>XOR of the entries its vector selects</strong>; the client XORs the two replies and every entry cancels except <strong>DB[i]</strong>. Because q1 and q2 are each uniformly random, neither server alone learns i — information-theoretically.</>,
        takeaway: <><strong>Private information retrieval (PIR)</strong>, introduced by Chor, Goldreich, Kushilevitz, and Sudan (1995), lets a client read DB[i] while the server(s) learn nothing about i. The trivial solution — download the whole database — always works but costs O(n) communication; PIR does far better. The classic <strong>two-server information-theoretic</strong> construction is a one-line XOR trick: replicate the database on servers A and B (assumed not to collude). The client’s target is the standard basis vector <strong>e_i</strong> (a 1 at index i, else 0). It samples a uniformly random n-bit vector <strong>q1</strong> and computes <strong>q2 = q1 ⊕ e_i</strong>, sending q1 to A and q2 to B. Each server treats its vector as a subset selector and replies with the XOR of the selected records: a1 = ⊕ DB[j] over the j with q1[j]=1, and a2 = ⊕ DB[j] over the j with q2[j]=1. The client outputs a1 ⊕ a2 = ⊕_j (q1[j] ⊕ q2[j])·DB[j] = ⊕_j e_i[j]·DB[j] = <strong>DB[i]</strong>, because every record except position i is selected by <em>both</em> or <em>neither</em> vector and cancels. <strong>Privacy</strong> is perfect and unconditional: q1 is uniform so A’s view is independent of i, and q2 = q1 ⊕ e_i is uniform too, so B’s view is independent of i — neither server, alone, gains any information (a colluding pair recovers e_i, so non-collusion is the trust assumption). Communication is O(n) bits per server here, but multi-server and recursive/matrix variants reach O(n^(1/k)) or polylog; <strong>single-server computational PIR</strong> instead uses homomorphic encryption (the client sends an encrypted query, the server computes on ciphertexts) at the cost of assuming a hard problem. PIR is the engine behind private DNS, Signal-style private contact discovery, checking a password against a breach corpus without revealing it, and certificate-transparency lookups. It is complementary to <strong>ORAM</strong>: ORAM hides a client’s access pattern to its <em>own</em> outsourced storage over many reads and writes, while PIR hides a single query index into a <em>public/shared</em> database.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="pir-ctl">
          <span className="pir-lab">want record:</span>
          {DB.map((_, i) => <button key={i} type="button" className={`pir-btn ${want === i ? 'on' : ''}`} onClick={() => setWant(i)}>{i}</button>)}
          <button type="button" className="pir-btn reroll" onClick={() => setNonce((n) => n + 1)}>↻ re-roll q1</button>
          <span className="pir-note">a1 ⊕ a2 = {a1} ⊕ {a2} = {a1 ^ a2} = DB[{want}] ✓</span>
        </div>
      )}
    />
  );
}

function Pir({ phase, want, q1, onWant, onReroll }: { phase: Phase; want: number; q1: number[]; onWant?: (i: number) => void; onReroll?: () => void }) {
  const on = (p: Phase) => phase === p; void onWant; void onReroll;
  const q2 = q1.map((b, j) => b ^ (j === want ? 1 : 0));
  const a1 = xorSel(q1), a2 = xorSel(q2);
  const CW = 74, X0 = 150;
  const cx = (j: number) => X0 + j * CW;
  return (
    <svg viewBox="0 0 760 300" className="story-svg">
      <text x="56" y="20" className="pir-col">2-server PIR · fetch DB[{want}]={DB[want]} · neither server learns which index</text>

      {/* index i highlight band */}
      {(on('recover') || on('privacy') || on('run')) && <rect x={cx(want) - 4} y={40} width={CW - 12} height={190} rx="4" className="pir-band" />}

      {/* database row */}
      <text x={70} y={64} className="pir-rl" textAnchor="end">DB</text>
      {DB.map((v, j) => <g key={j}>
        <rect x={cx(j)} y={48} width={CW - 20} height={26} rx="3" className={`pir-db ${want === j ? 'want' : ''}`} />
        <text x={cx(j) + (CW - 20) / 2} y={65} className="pir-dv" textAnchor="middle">{v}</text>
        <text x={cx(j) + (CW - 20) / 2} y={90} className="pir-idx" textAnchor="middle">[{j}]</text>
      </g>)}

      {/* q1 → server A */}
      <text x={70} y={128} className="pir-rl" textAnchor="end">q1 → A</text>
      {q1.map((b, j) => <g key={j}><rect x={cx(j)} y={112} width={CW - 20} height={24} rx="3" className={`pir-bit ${b ? 'set' : ''}`} /><text x={cx(j) + (CW - 20) / 2} y={128} className="pir-bt" textAnchor="middle">{b}</text></g>)}
      <text x={cx(N) + 6} y={128} className="pir-ans">a1 = {a1}</text>

      {/* q2 → server B */}
      <text x={70} y={166} className="pir-rl" textAnchor="end">q2 → B</text>
      {q2.map((b, j) => <g key={j}><rect x={cx(j)} y={150} width={CW - 20} height={24} rx="3" className={`pir-bit ${b ? 'set' : ''}`} /><text x={cx(j) + (CW - 20) / 2} y={166} className="pir-bt" textAnchor="middle">{b}</text></g>)}
      <text x={cx(N) + 6} y={166} className="pir-ans">a2 = {a2}</text>

      {/* recovery */}
      {(on('recover') || on('privacy') || on('run')) && <text x={X0} y={210} className="pir-rec">client: a1 ⊕ a2 = {a1} ⊕ {a2} = {(a1 ^ a2)} = DB[{want}] {(a1 ^ a2) === DB[want] ? '✓' : '✗'}</text>}

      <text x="380" y="250" className="pir-foot" textAnchor="middle">
        {on('leak') ? 'sending index i tells the server exactly what you read'
          : on('split') ? 'q1 random, q2 = q1 ⊕ e_i → each alone is uniform noise'
          : on('sum') ? 'each server returns the XOR of the entries its vector selects'
          : on('recover') ? 'a1 ⊕ a2: all entries cancel except position i → DB[i]'
          : on('privacy') ? 'q1 and q2 both uniform → neither server learns i (no crypto)'
          : `q1 and q2 differ only at [${want}] — each looks random; a1 ⊕ a2 = DB[${want}] = ${DB[want]}`}
      </text>
    </svg>
  );
}
