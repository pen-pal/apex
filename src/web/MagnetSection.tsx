// Magnet links & the infohash — trackerless torrents. A magnet link is nothing but an infohash (a content address);
// from it a client finds peers via the DHT and fetches everything else from them. Auto-plays the flow, stage by
// stage, on a loop. Model + parsing in magnet.ts.
import { useEffect, useState } from 'react';
import { parseMagnet } from './magnet';

const SAMPLE = 'magnet:?xt=urn:btih:c8f2e9a1b3d47f0e6a2c5b8d1f4e7a09c3b6d2e5&dn=apex-demo.iso&tr=udp://tracker.example:6969';

const STAGES = [
  { icon: '🧲', title: 'Magnet link', desc: 'A magnet link is just an infohash — no .torrent file to host, no tracker URL required.' },
  { icon: '🔑', title: 'Infohash', desc: 'The infohash is the SHA-1 of the file’s “info” dictionary (its piece list + sizes) — a content address that names the exact bytes. Change one bit of the content and the infohash changes.' },
  { icon: '🕸️', title: 'DHT lookup', desc: 'Your client asks the distributed hash table (Kademlia) who has this infohash — get_peers(infohash). No central tracker is involved; the lookup itself is peer-to-peer.' },
  { icon: '👥', title: 'Peers', desc: 'The DHT returns a set of peers in the swarm currently holding pieces of this infohash.' },
  { icon: '⬇️', title: 'Fetch & verify', desc: 'The client downloads the metadata from those peers (BEP-9), checks it hashes back to the infohash, then downloads the file itself — every piece verified against the hashes inside. Nothing was trusted; everything was content-addressed.' },
];

export function MagnetSection() {
  const m = parseMagnet(SAMPLE)!;
  const [stage, setStage] = useState(0);
  const [playing, setPlaying] = useState(true);
  useEffect(() => {
    if (!playing) return;
    const last = stage >= STAGES.length - 1;
    const t = setTimeout(() => setStage((s) => (s >= STAGES.length - 1 ? 0 : s + 1)), last ? 2200 : 1500);
    return () => clearTimeout(t);
  }, [playing, stage]);

  return (
    <div className="mag">
      <p className="mag-intro">
        A <code>.torrent</code> file has to be hosted somewhere and usually names a <strong>tracker</strong> — both
        things an authority can seize. A <strong>magnet link</strong> needs neither: it carries only the
        <strong> infohash</strong>, a 160-bit content address. From that one number a client finds peers and fetches
        everything else. There’s no file and no server to take down — which is exactly why magnet links outlived the
        torrent sites that indexed them.
      </p>

      <div className="mag-uri">
        <span className="mag-uri-k">magnet:?xt=urn:btih:</span>
        <span className="mag-hash">{m.infohash}</span>
        <span className="mag-uri-k">&amp;dn={m.name}</span>
      </div>

      <div className="mag-flowbar">
        <div className="mag-flow">
          {STAGES.map((st, i) => (
            <div key={st.title} className="mag-cell">
              <div className={`mag-stage ${i === stage ? 'on' : ''} ${i < stage ? 'done' : ''}`}>
                <div className="mag-ico">{st.icon}</div>
                <div className="mag-st-title">{st.title}</div>
              </div>
              {i < STAGES.length - 1 && <div className={`mag-arrow ${i < stage ? 'lit' : ''}`}>→</div>}
            </div>
          ))}
        </div>
        <button type="button" className={`mag-play ${playing ? 'on' : ''}`} onClick={() => setPlaying((p) => !p)}>{playing ? '❚❚' : '▶'}</button>
      </div>

      <div className="mag-caption"><strong>{STAGES[stage].title}.</strong> {STAGES[stage].desc}</div>

      <p className="mag-foot">
        This is <strong>content addressing</strong>: you ask for data by <em>what it is</em> (its hash), not <em>where it
        lives</em> — the same idea behind Git commits and IPFS. It makes torrents tamper-evident (a poisoned piece fails
        its hash) and censorship-resistant (seize a tracker or an index site and the infohash still resolves through the
        DHT). It rides on the <strong>Kademlia DHT</strong> for peer discovery and hands off to the <strong>BitTorrent</strong>
        swarm for the transfer. (BEP-9 / BEP-3.)
      </p>
    </div>
  );
}
