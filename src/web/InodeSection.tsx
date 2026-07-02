// The inode & indirect blocks, made visible. Pick a logical block of a file and watch which pointer path the
// filesystem follows to reach it — a direct pointer (1 read), or through one, two, or three levels of indirect
// blocks (2–4 reads). The pointer tree lights up along the path, and the stats show how a fixed-size inode with
// a dozen direct pointers still addresses terabytes. Real model from inode.ts.
import { useMemo, useState } from 'react';
import { resolve, capacities, pointersPerBlock, maxFileSize, type Zone } from './inode';

const ND = 12, B = 4096, P = 4;
const PPB = pointersPerBlock(B, P);
const CAPS = capacities(ND, PPB);
const fmt = (n: number) => n >= 1e12 ? (n / 1e12).toFixed(1) + ' TB' : n >= 1e9 ? (n / 1e9).toFixed(1) + ' GB' : n >= 1e6 ? (n / 1e6).toFixed(1) + ' MB' : n >= 1e3 ? (n / 1e3).toFixed(0) + ' KB' : n + '';
const PRESETS: { label: string; block: number }[] = [
  { label: 'byte 0 (direct)', block: 0 }, { label: '80 KB (single)', block: 20 },
  { label: '8 MB (double)', block: 2100 }, { label: '5 GB (triple)', block: 1_300_000 },
];

const ZONES: { z: Zone; label: string; reads: number }[] = [
  { z: 'direct', label: '12 direct pointers', reads: 1 }, { z: 'single', label: 'single-indirect', reads: 2 },
  { z: 'double', label: 'double-indirect', reads: 3 }, { z: 'triple', label: 'triple-indirect', reads: 4 },
];

export function InodeSection() {
  const [block, setBlock] = useState(20);
  const r = useMemo(() => resolve(block, ND, PPB), [block]);
  const fileBytes = (block + 1) * B;

  return (
    <div className="ino">
      <p className="ino-intro">
        A file is an <strong>inode</strong>: a fixed-size record with a few pointers to data blocks. The first
        <b> {ND}</b> are <strong>direct</strong> (one read to the data); when those run out, a
        <strong> single-indirect</strong> pointer points at a block full of {PPB} more pointers (one extra read),
        then <strong>double-</strong> and <strong>triple-indirect</strong> add {PPB}² and {PPB}³ blocks. Small
        files stay one-hop; the same tiny inode still reaches terabytes. Pick a block:
      </p>

      <div className="ino-presets">
        {PRESETS.map((p) => <button key={p.label} type="button" className={`ino-preset ${block === p.block ? 'on' : ''}`} onClick={() => setBlock(p.block)}>{p.label}</button>)}
      </div>
      <label className="ino-slider">logical block <b>{block.toLocaleString()}</b> <span className="ino-off">(≈ byte {fmt(fileBytes)} into the file)</span>
        <input type="range" min={0} max={1_400_000} value={block} onChange={(e) => setBlock(+e.target.value)} /></label>

      <div className="ino-diagram">
        <div className="ino-node">inode</div>
        <div className="ino-ptrs">
          {ZONES.map(({ z, label, reads }) => (
            <div key={z} className={`ino-zone ${r.zone === z ? 'active' : ''}`}>
              <span className="ino-zname">{label}</span>
              <div className="ino-chain">
                {Array.from({ length: reads }, (_, step) => (
                  <span key={step} className="ino-hopwrap">
                    <span className={`ino-box ${step === reads - 1 ? 'data' : 'idx'} ${r.zone === z ? 'lit' : ''}`}>{step === reads - 1 ? 'data' : 'ptrs'}</span>
                    {step < reads - 1 && <span className="ino-arrow">→</span>}
                  </span>
                ))}
                <span className={`ino-reads ${r.zone === z ? 'lit' : ''}`}>{reads} read{reads > 1 ? 's' : ''}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={`ino-verdict ${r.zone === 'beyond' ? 'bad' : ''}`}>
        {r.zone === 'beyond'
          ? <>⚠ block <b>{block.toLocaleString()}</b> is past the maximum addressable block — the file can't grow this large with these parameters.</>
          : <>block <b>{block.toLocaleString()}</b> is reached via the <b>{r.zone}</b> zone in <b>{r.reads}</b> disk read{r.reads > 1 ? 's' : ''} (position {r.withinZone.toLocaleString()} within the zone).</>}
      </div>

      <div className="ino-stats">
        <div className="ino-stat"><span>block size</span><b>{B / 1024} KB</b></div>
        <div className="ino-stat"><span>pointers / block</span><b>{PPB}</b></div>
        <div className="ino-stat"><span>triple-indirect adds</span><b>{fmt(CAPS.triple * B)}</b></div>
        <div className="ino-stat ok"><span>max file size</span><b>{fmt(maxFileSize(ND, PPB, B))}</b></div>
      </div>

      <p className="ino-foot">
        It is an asymmetric design: the common case (millions of small files) is optimal, since the inode is small
        and reading a config or source file is a single block fetch, while the rare case, a huge file, is merely
        <em>possible</em>, not fast. Depth costs I/O: a random read deep in a large file takes up to 4 disk seeks
        just to <em>find</em> the data block, which is why big-file workloads care about indirect-block overhead.
        Two things fall out. Sparse files are free: a hole (a region never written) is just null block pointers, so
        a "1 TB" file with one byte at the end occupies almost nothing, because the filesystem allocates lazily.
        And hard links live here: a directory entry is only a (name → inode number) mapping, so several names can
        share one inode (link count), and the data frees only when the last link goes. That indirect-block weakness,
        fragmenting large files and costing extra reads, is exactly why ext4, XFS, btrfs, and ZFS switched big files
        to <strong>extents</strong>: record "N contiguous blocks starting at X" instead of per-block pointers, far
        more compact for the large sequential files the indirect scheme handled worst. (ext2 inode; McKusick's FFS,
        1984.)
      </p>
    </div>
  );
}
