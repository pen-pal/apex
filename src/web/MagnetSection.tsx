// Magnet links & the infohash — trackerless torrents, made hands-on: the infohash IS the SHA-1 of the file's
// bencoded info dict, so it is a CONTENT ADDRESS. Tamper a byte and watch (1) that piece's hash change, (2) the
// infohash — your whole magnet link — change with it, and (3) a peer serving the tampered piece get rejected,
// because it no longer matches the hash the original link committed to. Real SHA-1, real bencode (see magnet.ts).
import { useMemo, useState } from 'react';
import { pieceHashes, infohashOf, pieceVerifies } from './magnet';
import { toHex } from './hashing';

const NAME = 'apex-demo.iso';
const PL = 4; // tiny pieces so one tampered byte lands in one visible piece
const ORIGINAL = 'apex-really-cool-file';
const enc = (s: string) => new TextEncoder().encode(s);
// One tampered byte = the next printable ASCII char, so the change is visible AND really alters the bytes we hash.
const bump = (code: number) => ((code - 32 + 1) % 95) + 32;

export function MagnetSection() {
  const [tampered, setTampered] = useState<Set<number>>(new Set());
  const base = useMemo(() => enc(ORIGINAL), []);
  const original = base;

  // Effective bytes a (possibly malicious) peer serves: the original with tampered bytes bumped.
  const effective = useMemo(() => {
    const b = new Uint8Array(original);
    tampered.forEach((i) => { b[i] = bump(b[i]); });
    return b;
  }, [original, tampered]);

  const nPieces = Math.ceil(original.length / PL);
  const origHashes = useMemo(() => pieceHashes(original, PL).map(toHex), [original]);
  const effHashes = useMemo(() => pieceHashes(effective, PL).map(toHex), [effective]);
  const myInfohash = useMemo(() => infohashOf(NAME, PL, original), [original]); // what your magnet link points to
  const tamperedInfohash = useMemo(() => infohashOf(NAME, PL, effective), [effective]);
  const anyTamper = tampered.size > 0;

  const toggle = (i: number) => setTampered((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });
  const dirtyPiece = (p: number) => [...tampered].some((i) => Math.floor(i / PL) === p);

  return (
    <div className="mag">
      <p className="mag-intro">
        A <code>.torrent</code> file has to be hosted somewhere and usually names a <strong>tracker</strong> — both
        seizable. A <strong>magnet link</strong> needs neither: it carries only the <strong>infohash</strong>, the
        SHA-1 of the file's info dictionary. That makes it a <strong>content address</strong> — it names the exact
        bytes. Click a byte below to tamper with the file and watch the address move.
      </p>

      {/* PRODUCE: the file, split into pieces. Click a byte to tamper it. */}
      <div className="mag-file">
        <div className="mag-file-lbl">the file — click a byte to flip it</div>
        <div className="mag-bytes">
          {Array.from(original).map((_, i) => {
            const isT = tampered.has(i);
            const ch = String.fromCharCode(effective[i]);
            const pieceEdge = i % PL === 0 && i > 0;
            return (
              <button
                type="button"
                key={i}
                className={`mag-byte ${isT ? 'tampered' : ''} ${pieceEdge ? 'edge' : ''}`}
                onClick={() => toggle(i)}
                title={`byte ${i} · piece ${Math.floor(i / PL)}`}
              >{ch === ' ' ? '␣' : ch}</button>
            );
          })}
        </div>
        <div className="mag-pieces-row">
          {Array.from({ length: nPieces }, (_, p) => (
            <div key={p} className={`mag-piece ${dirtyPiece(p) ? 'dirty' : ''}`} style={{ flexBasis: `${PL * 1.6}em` }}>
              <span className="mag-piece-k">piece {p}</span>
              <code className="mag-piece-h">{effHashes[p].slice(0, 8)}…</code>
              {dirtyPiece(p) && <span className="mag-piece-x">changed</span>}
            </div>
          ))}
        </div>
      </div>

      {/* The address that falls out of the content. */}
      <div className={`mag-uri ${anyTamper ? 'moved' : ''}`}>
        <span className="mag-uri-k">magnet:?xt=urn:btih:</span>
        <span className="mag-hash">{tamperedInfohash}</span>
        <span className="mag-uri-k">&amp;dn={NAME}</span>
      </div>
      <div className="mag-verdict">
        {anyTamper ? (
          <><strong>The infohash moved.</strong> Your link points at <code>{myInfohash.slice(0, 12)}…</code>; this
          tampered copy is <code>{tamperedInfohash.slice(0, 12)}…</code> — a different address entirely. The DHT would
          resolve a <em>different</em> swarm, so the poisoned file can't impersonate the one you asked for.</>
        ) : (
          <><strong>Untampered.</strong> The infohash is the SHA-1 of this exact content. Change one bit anywhere and
          this whole address changes with it.</>
        )}
      </div>

      {/* BREAK: a peer serves you the (possibly tampered) pieces; each is checked against the ORIGINAL committed hash. */}
      <div className="mag-verify">
        <div className="mag-verify-lbl">a peer serves the pieces · each verified against the hash your link committed to</div>
        <div className="mag-verify-row">
          {Array.from({ length: nPieces }, (_, p) => {
            const piece = effective.slice(p * PL, p * PL + PL);
            const ok = pieceVerifies(piece, origHashes[p]);
            return (
              <div key={p} className={`mag-vcell ${ok ? 'ok' : 'bad'}`}>
                <span className="mag-vp">piece {p}</span>
                <span className="mag-vmark">{ok ? '✓ verified' : '✗ rejected'}</span>
              </div>
            );
          })}
        </div>
        {anyTamper && (
          <button type="button" className="mag-reset" onClick={() => setTampered(new Set())}>↺ restore the file</button>
        )}
      </div>

      <p className="mag-foot">
        This is <strong>content addressing</strong>: you ask for data by <em>what it is</em> (its hash), not <em>where
        it lives</em> — the same idea behind Git commits and IPFS. It makes torrents tamper-evident (a poisoned piece
        fails its hash) and censorship-resistant (seize a tracker or an index site and the infohash still resolves
        through the <strong>Kademlia DHT</strong>). Discovery is <code>get_peers(infohash)</code>; the metadata itself
        is fetched from peers and re-checked against the infohash (BEP-9), then the file downloads piece-by-piece
        against the committed hashes (BEP-3). Nothing is trusted; everything is verified.
      </p>
    </div>
  );
}
