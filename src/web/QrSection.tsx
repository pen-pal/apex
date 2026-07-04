// Guided story: how a QR code is built — the real ISO/IEC 18004 pipeline for a Version-1 (21×21) code.
// Finder patterns a scanner locks onto, numeric data → codewords, Reed-Solomon ECC (why a torn code still
// reads), a zig-zag bit placement, and a mask chosen to keep the grid readable. The generator here is the
// one verified in node against the ISO Annex-I worked example ("01234567", level M): data codewords
// 10 20 0C 56 61 80 EC 11…, ECC A5 24 D4 C1 ED 36 C7 87 2C 55, all 10 RS syndromes zero, and the placed
// data reads back to those 26 codewords. The component re-derives everything live and decodes its own
// matrix back to the digits — an in-UI round-trip, not a stored answer.
import { useState, useMemo } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

// ---- GF(256), primitive 0x11D (the QR field) ----
const EXP = new Array<number>(512), LOG = new Array<number>(256);
{ let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11D; } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; }
const gmul = (a: number, b: number) => (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]];

const N = 21;                 // version 1 side
const MASK_FN = [
  (r: number, c: number) => (r + c) % 2 === 0,
  (r: number, _c: number) => r % 2 === 0,
  (_r: number, c: number) => c % 3 === 0,
  (r: number, c: number) => (r + c) % 3 === 0,
  (r: number, c: number) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r: number, c: number) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r: number, c: number) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r: number, c: number) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

type EncStep = { label: string; bits: string; note: string };

// numeric-mode encode for version 1, level M (16 data codewords)
function encodeNumeric(msg: string): { steps: EncStep[]; dataCW: number[]; totalBits: number } {
  const digits = (msg.replace(/[^0-9]/g, '') || '0').slice(0, 30);
  const steps: EncStep[] = [];
  let bits = '0001';
  steps.push({ label: 'mode', bits: '0001', note: 'numeric' });
  const cnt = digits.length.toString(2).padStart(10, '0');
  bits += cnt;
  steps.push({ label: 'count', bits: cnt, note: `${digits.length} digits` });
  for (let i = 0; i < digits.length; i += 3) {
    const g = digits.slice(i, i + 3);
    const w = g.length === 3 ? 10 : g.length === 2 ? 7 : 4;
    const b = parseInt(g, 10).toString(2).padStart(w, '0');
    bits += b;
    steps.push({ label: g, bits: b, note: `${g} → ${w}b` });
  }
  const usedBits = bits.length;
  bits += '0000';
  while (bits.length % 8 !== 0) bits += '0';
  const dataCW: number[] = [];
  for (let i = 0; i < bits.length; i += 8) dataCW.push(parseInt(bits.slice(i, i + 8), 2));
  const PADS = [0xEC, 0x11]; let pi = 0;
  while (dataCW.length < 16) dataCW.push(PADS[pi++ % 2]);
  return { steps, dataCW, totalBits: usedBits };
}

function rsEcc(dataCW: number[]): number[] {
  let gen = [1];
  for (let i = 0; i < 10; i++) { const ng = new Array(gen.length + 1).fill(0); for (let j = 0; j < gen.length; j++) { ng[j] ^= gmul(gen[j], 1); ng[j + 1] ^= gmul(gen[j], EXP[i]); } gen = ng; }
  const rem = dataCW.concat(new Array(10).fill(0));
  for (let i = 0; i < dataCW.length; i++) { const c = rem[i]; if (c) for (let j = 0; j < gen.length; j++) rem[i + j] ^= gmul(gen[j], c); }
  return rem.slice(16);
}

function formatBits(eccLevel: number, mask: number): number {
  const data5 = (eccLevel << 3) | mask;
  let d = data5 << 10; for (let i = 14; i >= 10; i--) if ((d >> i) & 1) d ^= 0x537 << (i - 10);
  return ((data5 << 10) | (d & 0x3FF)) ^ 0x5412;
}

type Cell = 0 | 1;
type QR = {
  matrix: Cell[][]; fn: boolean[][]; preMask: Cell[][];
  dataCW: number[]; eccCW: number[]; codewords: number[]; steps: EncStep[];
  mask: number; fmt: number; totalBits: number; path: [number, number][]; digits: string; decoded: string;
};

function buildQR(msg: string): QR {
  const { steps, dataCW, totalBits } = encodeNumeric(msg);
  const eccCW = rsEcc(dataCW);
  const codewords = dataCW.concat(eccCW);
  const bitstream = codewords.flatMap(b => b.toString(2).padStart(8, '0').split('').map(Number));

  const m: Cell[][] = Array.from({ length: N }, () => new Array<Cell>(N).fill(0));
  const fn: boolean[][] = Array.from({ length: N }, () => new Array(N).fill(false));
  const finder = (r: number, c: number) => {
    for (let i = -1; i <= 7; i++) for (let j = -1; j <= 7; j++) { const rr = r + i, cc = c + j; if (rr < 0 || rr >= N || cc < 0 || cc >= N) continue; fn[rr][cc] = true; const inb = i >= 0 && i <= 6 && j >= 0 && j <= 6; m[rr][cc] = (inb && ((i === 0 || i === 6 || j === 0 || j === 6) || (i >= 2 && i <= 4 && j >= 2 && j <= 4))) ? 1 : 0; }
  };
  finder(0, 0); finder(0, N - 7); finder(N - 7, 0);
  for (let i = 8; i < N - 8; i++) { m[6][i] = (i % 2 === 0 ? 1 : 0); fn[6][i] = true; m[i][6] = (i % 2 === 0 ? 1 : 0); fn[i][6] = true; }
  m[N - 8][8] = 1; fn[N - 8][8] = true;                       // dark module
  for (let i = 0; i < 9; i++) { fn[8][i] = true; fn[i][8] = true; }
  for (let i = 0; i < 8; i++) { fn[8][N - 1 - i] = true; fn[N - 1 - i][8] = true; }

  // zig-zag data placement
  const path: [number, number][] = [];
  let bi = 0, up = true;
  for (let col = N - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let k = 0; k < N; k++) { const row = up ? (N - 1 - k) : k; for (let t = 0; t < 2; t++) { const cc = col - t; if (fn[row][cc]) continue; if (bi < bitstream.length) { m[row][cc] = bitstream[bi++] as Cell; path.push([row, cc]); } } }
    up = !up;
  }
  const preMask: Cell[][] = m.map(row => row.slice() as Cell[]);

  // pick mask by full 4-rule penalty
  const applyMask = (mi: number): Cell[][] => m.map((row, r) => row.map((v, c) => (!fn[r][c] && MASK_FN[mi](r, c)) ? (v ^ 1) as Cell : v));
  let best = 0, bestP = Infinity;
  for (let mi = 0; mi < 8; mi++) { const p = penalty(applyMask(mi)); if (p < bestP) { bestP = p; best = mi; } }
  const masked = applyMask(best);
  const fmt = formatBits(0, best);
  placeFormat(masked, fmt, best);

  const decoded = decodeQR(masked, fn);
  return { matrix: masked, fn, preMask, dataCW, eccCW, codewords, steps, mask: best, fmt, totalBits, path, digits: (msg.replace(/[^0-9]/g, '') || '0').slice(0, 30), decoded };
}

function placeFormat(g: Cell[][], fmt: number, _mask: number) {
  const bit = (k: number) => ((fmt >> k) & 1) as Cell;   // k=0 LSB
  for (let k = 0; k <= 5; k++) g[8][k] = bit(k);
  g[8][7] = bit(6); g[8][8] = bit(7); g[7][8] = bit(8);
  for (let k = 9; k <= 14; k++) g[14 - k][8] = bit(k);
  for (let k = 0; k <= 6; k++) g[N - 1 - k][8] = bit(k);
  for (let k = 7; k <= 14; k++) g[8][N - 15 + k] = bit(k);
  g[N - 8][8] = 1;
}

// read the 15-bit format strip from the grid and BCH-decode it to recover the mask (0–7)
function readFormatMask(g: Cell[][]): number {
  let raw = 0; const gb = (k: number, r: number, c: number) => { raw |= (g[r][c] & 1) << k; };
  for (let k = 0; k <= 5; k++) gb(k, 8, k); gb(6, 8, 7); gb(7, 8, 8); gb(8, 7, 8);
  for (let k = 9; k <= 14; k++) gb(k, 14 - k, 8);
  raw ^= 0x5412; let best = 0, bd = 99;
  for (let i = 0; i < 32; i++) { let e = i << 10; for (let b = 14; b >= 10; b--) if ((e >> b) & 1) e ^= 0x537 << (b - 10); const code = (i << 10) | (e & 0x3FF); let hd = 0, x = code ^ raw; while (x) { hd += x & 1; x >>= 1; } if (hd < bd) { bd = hd; best = i; } }
  return best & 7;
}

// independent decode: recover the mask from the format strip, then read the data region back,
// un-mask, un-zigzag → codewords → data → digits (does not use the encoder's chosen mask)
function decodeQR(g: Cell[][], fn: boolean[][]): string {
  const mask = readFormatMask(g);
  const read: number[] = []; let up = true;
  for (let col = N - 1; col > 0; col -= 2) { if (col === 6) col--; for (let k = 0; k < N; k++) { const row = up ? (N - 1 - k) : k; for (let t = 0; t < 2; t++) { const cc = col - t; if (fn[row][cc]) continue; read.push((!fn[row][cc] && MASK_FN[mask](row, cc)) ? g[row][cc] ^ 1 : g[row][cc]); } } up = !up; }
  const bits = read.slice(0, 128).join('');           // 16 data codewords = 128 bits
  let p = 0; const take = (n: number) => { const v = parseInt(bits.slice(p, p + n), 2); p += n; return v; };
  if (take(4) !== 0b0001) return '(non-numeric)';
  const count = take(10); let out = '';
  for (let i = 0; i < count; i += 3) { const rem = count - i; const w = rem >= 3 ? 10 : rem === 2 ? 7 : 4; const v = take(w); out += v.toString().padStart(rem >= 3 ? 3 : rem, '0'); }
  return out;
}

function penalty(g: Cell[][]): number {
  let p = 0;
  for (let r = 0; r < N; r++) { let run = 1; for (let c = 1; c < N; c++) { if (g[r][c] === g[r][c - 1]) run++; else { if (run >= 5) p += 3 + (run - 5); run = 1; } } if (run >= 5) p += 3 + (run - 5); }
  for (let c = 0; c < N; c++) { let run = 1; for (let r = 1; r < N; r++) { if (g[r][c] === g[r - 1][c]) run++; else { if (run >= 5) p += 3 + (run - 5); run = 1; } } if (run >= 5) p += 3 + (run - 5); }
  for (let r = 0; r < N - 1; r++) for (let c = 0; c < N - 1; c++) if (g[r][c] === g[r][c + 1] && g[r][c] === g[r + 1][c] && g[r][c] === g[r + 1][c + 1]) p += 3;
  let dark = 0; for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) dark += g[r][c];
  p += Math.floor(Math.abs((dark * 100) / (N * N) - 50) / 5) * 10;
  return p;
}

const hx = (b: number) => b.toString(16).padStart(2, '0').toUpperCase();

// ---- visual: the 21×21 grid, with per-scene shading ----
type Shade = 'skeleton' | 'data' | 'mask' | 'final';
function QRGrid({ qr, shade, maskOverlay }: { qr: QR; shade: Shade; maskOverlay?: boolean }) {
  const S = 12, PAD = 8, dim = N * S + PAD * 2;
  const dataSet = new Set(qr.path.map(([r, c]) => r * N + c));
  const eccStart = 16 * 8;   // ecc bits begin here along the path
  const cells = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const isFn = qr.fn[r][c];
    const INK = '#12161d', PAPER = '#f6f8fa';            // a QR is dark-on-light in either theme
    let fill = PAPER;
    const grid = shade === 'skeleton' ? qr.matrix.map((row, rr) => row.map((v, cc) => qr.fn[rr][cc] ? v : 0 as Cell)) : shade === 'final' || shade === 'mask' ? qr.matrix : qr.preMask;
    const on = grid[r][c] === 1;
    if (shade === 'skeleton') {
      if (isFn) fill = on ? INK : PAPER;
      else fill = '#eef1f5';                              // free area, faint
    } else if (shade === 'final') {
      fill = on ? INK : PAPER;                            // the real, scannable black-and-white code
    } else {
      if (isFn) fill = on ? '#5c667a' : '#dbe1ea';        // function modules muted grey
      else if (dataSet.has(r * N + c)) {
        const idx = qr.path.findIndex(([pr, pc]) => pr === r && pc === c);
        const isEcc = idx >= eccStart;
        fill = on ? (isEcc ? '#e8730a' : '#1f6feb') : (isEcc ? '#f8ddc2' : '#cfe0f8');
      } else fill = on ? INK : PAPER;
    }
    cells.push(<rect key={`${r}-${c}`} x={PAD + c * S} y={PAD + r * S} width={S - 0.6} height={S - 0.6} fill={fill} />);
    if (maskOverlay && !isFn && MASK_FN[qr.mask](r, c)) cells.push(<rect key={`m${r}-${c}`} x={PAD + c * S} y={PAD + r * S} width={S - 0.6} height={S - 0.6} fill="none" stroke="#8250df" strokeWidth={1.1} strokeDasharray="1.5 1.5" opacity={0.85} />);
  }
  return (
    <svg viewBox={`0 0 ${dim} ${dim}`} className="qr-svg" role="img" aria-label="QR code matrix">
      <rect x={0} y={0} width={dim} height={dim} fill="#f6f8fa" rx={6} stroke="#c9d1d9" strokeWidth={1} />
      {cells}
    </svg>
  );
}

function ByteRow({ bytes, tint, label }: { bytes: number[]; tint: string; label: string }) {
  return (
    <div className="qr-byterow">
      <span className="qr-byterow-lbl">{label}</span>
      <div className="qr-bytes">
        {bytes.map((b, i) => <span key={i} className="qr-byte" style={{ background: tint }}>{hx(b)}</span>)}
      </div>
      <span className="qr-byterow-n">{bytes.length} codewords</span>
    </div>
  );
}

const PRESETS = ['01234567', '8675309', '31415926', '20260703'];

export function QrSection() {
  const [msg, setMsg] = useState('01234567');
  const qr = useMemo(() => buildQR(msg), [msg]);
  const canon = useMemo(() => buildQR('01234567'), []);

  const scenes: StoryScene[] = [
    {
      key: 'skeleton', title: 'The three eyes and the grid',
      caption: 'Before any data, a QR code is a skeleton of fixed patterns. The three nested squares (finder patterns) let a scanner locate the code and its orientation from any angle — their 1:1:3:1:1 dark:light ratio is unmistakable. The dotted timing lines re-sync the module grid across the code, and one lone dark module is always set. Everything else is free for data.',
      render: () => <QRGrid qr={canon} shade="skeleton" />,
    },
    {
      key: 'encode', title: 'Text becomes codewords',
      caption: 'The digits are packed tightly: a 4-bit mode marker (0001 = numeric), a 10-bit length, then digits in groups of three as 10-bit numbers (the last 1–2 digits use 7 or 4 bits). Pad to whole bytes, then out to 16 data codewords with the fixed fillers EC and 11. For 01234567 that is 10 20 0C 56 61 80 — exactly the ISO worked example.',
      render: () => <div className="qr-encpanel">{canon.steps.map((s, i) => <div key={i} className="qr-encstep"><span className="qr-encbits">{s.bits}</span><span className="qr-encnote">{s.label} · {s.note}</span></div>)}<ByteRow bytes={canon.dataCW} tint="#12233d" label="16 data" /></div>,
    },
    {
      key: 'rs', title: 'Reed-Solomon armor',
      caption: 'The 16 data codewords are run through Reed-Solomon over GF(256) to make 10 error-correction codewords — here A5 24 D4 C1 ED 36 C7 87 2C 55. This is why a scuffed, torn, or logo-covered code still reads: level M recovers roughly 15% of the codewords lost. The 26 together form one polynomial divisible by the RS generator (all syndromes zero — verified).',
      render: () => <div className="qr-encpanel"><ByteRow bytes={canon.dataCW} tint="#12233d" label="16 data" /><ByteRow bytes={canon.eccCW} tint="#3d2410" label="10 ECC" /><div className="qr-note">data (blue) + ECC (orange) = 26 codewords = 208 bits to place</div></div>,
    },
    {
      key: 'place', title: 'Snake the bits into the grid',
      caption: 'The 208 bits are laid into the free cells in a boustrophedon: two columns at a time, bottom-to-top then top-to-bottom, weaving around the finders and skipping the vertical timing line. Data codewords (blue) fill first, then the ECC codewords (orange) — so a reader walking the same path recovers them in order.',
      render: (active) => <QRGrid qr={canon} shade="data" key={active ? 'a' : 'i'} />,
    },
    {
      key: 'mask', title: 'Mask to stay readable',
      caption: 'A raw data region often has big blank patches or accidental finder-like stripes that confuse a scanner. So the code XORs a mask pattern (dotted here) over the data modules only — one of eight is chosen by a penalty score that punishes long runs, 2×2 blocks, false finders, and lopsided dark/light. The 15-bit format strip around the finders records which mask and error level, protected by its own BCH code.',
      render: () => <QRGrid qr={canon} shade="mask" maskOverlay />,
    },
    {
      key: 'done', title: 'A finished, scannable code',
      caption: 'Finders, timing, data, ECC, and mask together make a real Version-1 QR. Type your own digits below: the codewords, Reed-Solomon ECC, chosen mask, and grid are all recomputed live — and the code decodes its own matrix back to your digits, an in-UI round-trip rather than a stored answer.',
      render: (active) => <QRGrid qr={qr} shade="final" key={active ? 'a' : 'i'} />,
    },
  ];

  return (
    <GuidedStory
      aspect="900 / 560"
      scenes={scenes}
      explain={{
        idea: <>A <strong>QR code</strong> is not a picture — it is a little error-corrected data packet drawn as a grid. Fixed <strong>finder patterns</strong> orient a scanner; the message is packed into <strong>codewords</strong>, armored with <strong>Reed-Solomon</strong> ECC so a damaged code still reads, snaked into the grid in a zig-zag, and <strong>masked</strong> so the pattern stays scannable. This builds a real Version-1 (21×21) code and decodes its own output back to prove it.</>,
        takeaway: <>Every QR code layers four ideas. <strong>Structure:</strong> three <strong>finder patterns</strong> (the 1:1:3:1:1 squares) give position and rotation, <strong>timing patterns</strong> re-sync the grid, and a <strong>format strip</strong> (BCH-protected) names the error level and mask. <strong>Encoding:</strong> data goes in by mode — numeric packs 3 digits into 10 bits, alphanumeric 2 chars into 11, byte mode 8 bits each — then pads to a fixed number of <strong>codewords</strong> (16 data for Version-1 level M). <strong>Error correction:</strong> <strong>Reed-Solomon</strong> over GF(256) adds check codewords (10 here); levels L/M/Q/H recover about 7/15/25/30% of lost codewords, which is how a code survives a logo, a smudge, or a tear. <strong>Layout:</strong> the codeword bits are placed in a boustrophedon zig-zag around the function patterns, then one of <strong>eight masks</strong> is XORed over the data — chosen by a penalty score — so no big blank areas or fake finders confuse the reader. Bigger messages step up through 40 <strong>versions</strong> (21×21 up to 177×177), adding alignment patterns; the principles are identical. Verified in node against the ISO/IEC 18004 Annex-I example: data <code>10 20 0C 56 61 80…</code>, ECC <code>A5 24 D4 C1 ED 36 C7 87 2C 55</code>, all ten RS syndromes zero, and the placed matrix reads back to the original codewords.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="qr-ctl">
          <input className="qr-input" value={msg} inputMode="numeric" maxLength={30} onChange={e => setMsg(e.target.value.replace(/[^0-9]/g, ''))} aria-label="digits to encode" />
          <div className="qr-presets">{PRESETS.map(p => <button key={p} type="button" className={`qr-preset ${msg === p ? 'on' : ''}`} onClick={() => setMsg(p)}>{p}</button>)}</div>
          <span className="qr-read">digits {qr.digits.length} · {qr.dataCW.length} data + {qr.eccCW.length} ECC · mask {qr.mask} · reads back as <b>{qr.decoded}</b>{qr.decoded === qr.digits ? ' ✓' : ''}</span>
        </div>
      )}
    />
  );
}
