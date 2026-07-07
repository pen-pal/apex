// BitTorrent — the peer-to-peer file-sharing protocol behind torrents. A file is split into fixed-size PIECES; a
// SWARM of peers each holds some; you download from MANY at once, choosing pieces RAREST-FIRST so no piece goes
// extinct, and you reciprocate uploads TIT-FOR-TAT (choke/unchoke). Auto-plays a live download: your file fills in
// piece by piece, each coloured by the peer it came from, endangered (single-source) pieces grabbed first. Real
// mechanics from bittorrent.ts (rarest-first / providers), BEP-3.
import { useEffect, useState } from 'react';
import { rarestFirst, providerOf, rarity, complete, type Peer } from './bittorrent';

const N = 20;
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, k) => a + k);
const bf = (...idx: number[]): boolean[] => Array.from({ length: N }, (_, i) => idx.includes(i));
const PEERS: Peer[] = [
  { id: 's', name: 'Seeder', has: Array.from({ length: N }, () => true), seed: true },
  { id: 'a', name: 'peer A', has: bf(...range(0, 9)), seed: false },
  { id: 'b', name: 'peer B', has: bf(...range(10, 17)), seed: false },
  { id: 'c', name: 'peer C', has: bf(3, 4, 5, 15, 16), seed: false },
];
const HUE: Record<string, number> = { s: 150, a: 210, b: 280, c: 35 };

export function BitTorrentSection() {
  const [mine, setMine] = useState<boolean[]>(Array(N).fill(false));
  const [src, setSrc] = useState<Record<number, string>>({});
  const [cur, setCur] = useState(-1);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!playing) return;
    if (complete(mine)) { const t = setTimeout(() => { setMine(Array(N).fill(false)); setSrc({}); setCur(-1); }, 1500); return () => clearTimeout(t); }
    const pick = rarestFirst(mine, PEERS);
    if (pick < 0) return;
    const prov = providerOf(PEERS, pick);
    const t = setTimeout(() => {
      setCur(pick);
      setMine((m) => m.map((v, i) => (i === pick ? true : v)));
      setSrc((s) => ({ ...s, [pick]: prov?.id ?? '' }));
    }, 460);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, mine]);

  const got = mine.filter(Boolean).length;
  const r = rarity(PEERS, N);
  const provCur = cur >= 0 ? providerOf(PEERS, cur)?.id ?? null : null;

  return (
    <div className="bt">
      <p className="bt-intro">
        A torrent has no central server. The file is split into fixed-size <strong>pieces</strong>, and a
        <strong> swarm</strong> of peers each holds some of them — a <strong>seeder</strong> has the whole file,
        <strong> leechers</strong> are still downloading. You pull pieces from <em>many</em> peers at once, and you pick
        the <strong>rarest piece first</strong> (the one fewest peers have) so a departing seed can’t take the last copy
        of a piece with it. In return you upload to the peers who upload to you — <strong>tit-for-tat</strong>.
      </p>

      <div className="bt-swarm">
        {PEERS.map((p) => (
          <div key={p.id} className={`bt-peer ${provCur === p.id ? 'active' : ''}`} style={{ borderColor: `hsl(${HUE[p.id]} 55% 55% / .5)` }}>
            <div className="bt-peer-h"><span>{p.name}</span><span className={`bt-badge ${p.seed ? 'seed' : 'leech'}`}>{p.seed ? 'seed' : 'leecher'}</span></div>
            <div className="bt-bits">{p.has.map((h, i) => <span key={i} className={`bt-bit ${h ? 'has' : ''}`} style={h ? { background: `hsl(${HUE[p.id]} 55% 55% / .7)` } : undefined} />)}</div>
          </div>
        ))}
      </div>

      <div className="bt-you">
        <div className="bt-you-h">
          <span>your download</span>
          <span className="bt-count">{got}/{N} pieces{provCur ? ` · from ${PEERS.find((p) => p.id === provCur)?.name}` : ''}</span>
          <button type="button" className={`bt-play ${playing ? 'on' : ''}`} onClick={() => setPlaying((p) => !p)}>{playing ? '❚❚ pause' : '▶ play'}</button>
        </div>
        <div className="bt-file">
          {mine.map((v, i) => (
            <span key={i} className={`bt-piece ${v ? 'got' : ''} ${i === cur ? 'cur' : ''}`}
              style={v ? { background: `hsl(${HUE[src[i]] ?? 0} 55% 52%)`, borderColor: `hsl(${HUE[src[i]] ?? 0} 55% 60%)` } : undefined}
              title={`piece ${i} · held by ${r[i]} peer${r[i] === 1 ? '' : 's'}`}>{v ? '' : r[i] === 1 ? '!' : ''}</span>
          ))}
        </div>
        <div className="bt-legend">
          {PEERS.map((p) => <span key={p.id} className="bt-leg"><span className="bt-leg-dot" style={{ background: `hsl(${HUE[p.id]} 55% 52%)` }} />{p.name}</span>)}
          <span className="bt-leg"><b>!</b> = only one peer has it (rarest → grabbed first)</span>
        </div>
      </div>

      <p className="bt-foot">
        <strong>Rarest-first</strong> keeps every piece alive and spreads copies evenly, so the swarm survives seeds leaving —
        watch the “!” pieces (only the seeder has them) get grabbed first. <strong>Choke/unchoke with tit-for-tat</strong> is
        the incentive layer: you only upload to the few peers giving you the best rate, plus one <em>optimistic unchoke</em> to
        find better partners — so pure freeloaders get choked. A <strong>tracker</strong> (or, trackerlessly, the <em>DHT</em>)
        just introduces peers; after that the swarm is fully peer-to-peer, which is exactly what makes it hard to shut down.
        (BitTorrent, Bram Cohen, BEP-3.)
      </p>
    </div>
  );
}
