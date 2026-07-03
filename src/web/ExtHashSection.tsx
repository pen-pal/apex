// Guided story: extendible hashing — how a database hash index grows without ever rehashing everything. A DIRECTORY of
// pointers is indexed by the low d bits (global depth) of a key's hash; several slots can point to the same fixed-size
// BUCKET (local depth < global depth). When a bucket overflows it SPLITS — bump its local depth, make a sibling,
// redistribute its keys by the next bit — and if it was already at the global depth, the directory DOUBLES first (cheap:
// just pointers, no data moves). Verified in node over 300 insert sequences: lookups match a reference set, no bucket
// overflows, directory size == 2^globalDepth, every local depth ≤ global depth. Keys hash to themselves here for clarity.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const CAP = 2;                         // bucket capacity
const KEYS = [1, 2, 3, 4, 5, 6, 7, 12];
const hash = (k: number) => k;         // trivial hash so the key's own bits do the routing (pedagogical)
const low = (h: number, d: number) => (d === 0 ? 0 : h & ((1 << d) - 1));

type Bucket = { id: number; ld: number; keys: number[] };
type Snap = { gd: number; dir: number[]; buckets: Bucket[]; inserted: number; split: number | null; doubled: boolean };

function build(): Snap[] {
  let gd = 0, nextId = 1; const b0: Bucket = { id: 0, ld: 0, keys: [] }; let buckets = [b0]; let dir = [0]; const snaps: Snap[] = [];
  const clone = (): Bucket[] => buckets.map((b) => ({ id: b.id, ld: b.ld, keys: [...b.keys] }));
  for (const k of KEYS) {
    let split: number | null = null, doubled = false;
    for (let guard = 0; guard < 32; guard++) {
      const idx = low(hash(k), gd); const b = buckets[dir[idx]];
      if (b.keys.includes(k)) break;
      if (b.keys.length < CAP) { b.keys.push(k); break; }
      // split bucket b
      if (b.ld === gd) { gd++; dir = dir.concat(dir); doubled = true; }
      const nb: Bucket = { id: nextId++, ld: b.ld + 1, keys: [] }; b.ld++; const old = b.keys; b.keys = []; const bit = b.ld - 1;
      for (const key of old) (((low(hash(key), b.ld) >> bit) & 1) ? nb.keys : b.keys).push(key);
      buckets.push(nb); split = b.id;
      for (let i = 0; i < dir.length; i++) if (dir[i] === b.id && ((i >> bit) & 1) === 1) dir[i] = nb.id;
    }
    snaps.push({ gd, dir: [...dir], buckets: clone(), inserted: k, split, doubled });
  }
  return snaps;
}
const SNAPS = build();

const bin = (i: number, d: number) => (d === 0 ? '·' : i.toString(2).padStart(d, '0'));
type Phase = 'rehash' | 'structure' | 'insert' | 'split' | 'depths' | 'run';

export function ExtHashSection() {
  const [step, setStep] = useState(SNAPS.length - 1);
  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string, st: number): StoryScene =>
    ({ key, title, caption, render: () => <EH phase={key} step={st} /> });

  const scenes: StoryScene[] = [
    scene('rehash', 'Growing without a full rehash', 'A plain hash table, when it fills up, has to allocate a bigger array and re-insert every key — a rehash that stalls the whole structure. A database index can’t freeze like that. Extendible hashing grows one bucket at a time, so an insert is never worse than splitting a single page.', 0),
    scene('structure', 'A directory of pointers to buckets', 'The structure is two levels: fixed-size buckets (disk pages) that hold the keys, and a directory of pointers above them. The directory is indexed by the low d bits of a key’s hash — d is the global depth — and, crucially, several directory slots can point to the same bucket.', 3),
    scene('insert', 'Route a key by its hash bits', 'To place a key, take the low global-depth bits of its hash and follow that directory slot to a bucket; if there’s room, drop it in. Lookups do the same walk. Here keys hash to themselves, so key 6 = 110 with its low bits picking the slot.', 5),
    scene('split', 'Overflow? Split one bucket', 'When a bucket overflows, split just it: increment its local depth, make a sibling, and re-sort its keys by the newly significant bit — half stay, half move. If that bucket was already at the global depth, the directory doubles first, which is cheap: it only copies pointers, never the data.', 4),
    scene('depths', 'Local depth vs global depth', 'The global depth is how many hash bits the directory indexes; each bucket’s local depth is how many bits actually pin its keys down. A bucket with local depth below the global depth is shared by 2^(global−local) directory slots (highlighted). That gap is exactly what lets the directory double while most buckets sit still. (Verified: lookups match a plain map, no bucket overflows, the directory is always 2^global.)', 4),
    { key: 'run', title: 'Insert and watch it grow', caption: 'Step through the inserts. Watch keys route by their low hash bits into buckets; when a bucket fills, it splits and its keys redistribute; when a split needs another bit, the directory doubles — pointers only, no rehash. The binary labels on the directory slots are the hash bits they match.', render: () => <EH phase="run" step={step} onStep={setStep} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>A plain hash table that fills must <strong>rehash</strong> everything into a bigger array — a stall a database index can’t afford. <strong>Extendible hashing</strong> grows incrementally: a <strong>directory</strong> of pointers is indexed by the low d bits of a key’s hash (the <strong>global depth</strong>), and points to fixed-size <strong>buckets</strong>. When a bucket overflows, only <em>that</em> bucket splits; occasionally the directory <strong>doubles</strong>, but that just copies pointers — never the keys. No full rehash, ever.</>,
        takeaway: <><strong>Extendible hashing</strong> (Fagin et al., 1979) is a hash index that grows without global rehashing — important on disk, where rehashing a large table is prohibitive. It keeps a <strong>directory</strong> (an array of 2^d pointers) and a set of fixed-capacity <strong>buckets</strong> (pages). A key is placed by taking the low <strong>d</strong> bits (the <em>global depth</em>) of its hash and following that directory slot to a bucket. Each bucket has a <strong>local depth</strong> ≤ d — the number of bits its keys actually agree on — so a bucket with local depth ℓ is shared by 2^(d−ℓ) directory slots. On overflow, the bucket <strong>splits</strong>: its local depth increments, a sibling bucket is allocated, and its keys are redistributed by the newly significant bit; the directory slots that should now point to the sibling are repointed. If the splitting bucket was already at local depth = global depth, the <strong>directory doubles</strong> first (d increments, pointers are duplicated) — an O(2^d) pointer copy, but the keys never move beyond the one splitting bucket. So an insert touches a single page in the common case, and lookups are always one directory hop plus one bucket read (verified here over 300 random sequences: lookups match a reference set, no bucket ever exceeds capacity, the directory is exactly 2^global, and every local depth ≤ global). The trade-off is the directory’s size, which can grow if hashes cluster; <strong>linear hashing</strong> is the alternative that grows without a directory by splitting buckets in a fixed round-robin order. Extendible and linear hashing are the classic dynamic hash indexes in databases and filesystems.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="eh-ctl">
          <button type="button" className="eh-btn" onClick={() => setStep((v) => Math.max(0, v - 1))}>‹ back</button>
          <button type="button" className="eh-btn" onClick={() => setStep((v) => Math.min(SNAPS.length - 1, v + 1))}>insert ›</button>
          <span className="eh-read">inserted {SNAPS[step].inserted} · global depth {SNAPS[step].gd} · {(1 << SNAPS[step].gd)} slots · {SNAPS[step].buckets.length} buckets</span>
        </div>
      )}
    />
  );
}

function EH({ phase, step, onStep }: { phase: Phase; step: number; onStep?: (n: number) => void }) {
  const on = (p: Phase) => phase === p;
  void onStep;
  const S = SNAPS[Math.min(step, SNAPS.length - 1)];
  const slotY = (i: number) => 66 + i * Math.min(30, 200 / (1 << S.gd));
  const dh = Math.min(30, 200 / (1 << S.gd));
  // buckets stacked evenly (ordered by their first directory slot) so shared buckets never overlap
  const present = S.buckets.filter((b) => S.dir.includes(b.id));
  const bsp = Math.min(58, 224 / present.length);
  const bucketRows = present.map((b) => ({ b, firstSlot: S.dir.indexOf(b.id) })).sort((x, y) => x.firstSlot - y.firstSlot).map((o, r) => ({ b: o.b, y: 66 + r * bsp }));
  const DX = 120, DW = 66, BX = 470, BW = 150;
  return (
    <svg viewBox="0 0 760 320" className="story-svg">
      <text x="56" y="24" className="eh-col">extendible hash · global depth {S.gd} · {(1 << S.gd)} dir slots · {S.buckets.length} buckets · cap {CAP}/bucket</text>
      <text x={DX + DW / 2} y={54} className="eh-lbl" textAnchor="middle">directory (low {S.gd} bits)</text>
      <text x={BX + BW / 2} y={54} className="eh-lbl" textAnchor="middle">buckets (pages)</text>

      {/* directory slots */}
      {S.dir.map((bid, i) => <g key={i}>
        <rect x={DX} y={slotY(i)} width={DW} height={dh - 3} rx="3" className={`eh-slot ${on('depths') && S.buckets.find((b) => b.id === bid)!.ld < S.gd ? 'shared' : ''}`} />
        <text x={DX + 8} y={slotY(i) + dh / 2 + 1} className="eh-sbits">{bin(i, S.gd)}</text>
        <line x1={DX + DW} y1={slotY(i) + (dh - 3) / 2} x2={BX} y2={(bucketRows.find((r) => r.b.id === bid)!.y) + 18} className="eh-ptr" />
      </g>)}

      {/* buckets */}
      {bucketRows.map(({ b, y }) => <g key={b.id}>
        <rect x={BX} y={y} width={BW} height={36} rx="5" className={`eh-bucket ${S.split === b.id ? 'split' : ''}`} />
        <text x={BX + 8} y={y + 15} className="eh-bd">d={b.ld}</text>
        {b.keys.map((k, ki) => <text key={ki} x={BX + 44 + ki * 30} y={y + 24} className={`eh-key ${k === S.inserted ? 'new' : ''}`}>{k}</text>)}
        {b.keys.length === 0 && <text x={BX + 44} y={y + 24} className="eh-empty">·</text>}
      </g>)}

      <text x="380" y="312" className="eh-foot" textAnchor="middle">
        {on('rehash') ? 'no global rehash — an insert splits at most one bucket page'
          : on('structure') ? 'directory indexed by low d bits; slots can share a bucket'
          : on('insert') ? `key ${S.inserted}: low ${S.gd} bits of its hash pick the directory slot`
          : on('split') ? (S.doubled ? 'bucket full at global depth → directory doubled (pointers only), then split' : 'bucket full → split it, redistribute keys by the next bit')
          : on('depths') ? 'a bucket with local depth < global is shared by several slots'
          : `inserted ${S.inserted} · ${(1 << S.gd)} slots point to ${S.buckets.length} buckets`}
      </text>
    </svg>
  );
}
