// Huffman coding, made visible. Type text and watch the frequency-sorted tree build,
// each leaf's path become its code, and the bitstream shrink below fixed-width — with
// the prefix-free property that lets it decode with no separators. Real optimal codes
// (huffman.ts, tested).
import { useMemo, useState } from 'react';
import { counts, buildTree, buildCodes, encode, type Node } from './huffman';

interface Pos { node: Node; x: number; y: number; code: string }

function layout(tree: Node | null): { nodes: Pos[]; w: number; h: number } {
  if (!tree) return { nodes: [], w: 0, h: 0 };
  const leaves: Pos[] = [];
  const all: Pos[] = [];
  let depth = 0;
  const place = (n: Node, d: number, code: string): number => {
    depth = Math.max(depth, d);
    if (n.symbol !== undefined) { const x = leaves.length; const p = { node: n, x, y: d, code }; leaves.push(p); all.push(p); return x; }
    const lx = n.left ? place(n.left, d + 1, code + '0') : 0;
    const rx = n.right ? place(n.right, d + 1, code + '1') : lx;
    const x = (lx + rx) / 2; const p = { node: n, x, y: d, code }; all.push(p); return x;
  };
  place(tree, 0, '');
  return { nodes: all, w: Math.max(1, leaves.length - 1), h: depth };
}

const HUE = (i: number) => `hsl(${(i * 47) % 360} 60% 55%)`;

export function HuffmanSection() {
  const [text, setText] = useState('mississippi river');
  const tree = useMemo(() => buildTree(counts(text)), [text]);
  const codes = useMemo(() => buildCodes(tree), [tree]);
  const r = useMemo(() => encode(text), [text]);
  const cnt = counts(text);
  const syms = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]);
  const colorOf: Record<string, string> = {}; syms.forEach((s, i) => (colorOf[s] = HUE(i)));

  const { nodes, w, h } = layout(tree);
  const W = 560, H = 200, padX = 24, padY = 18;
  const sx = (x: number) => padX + (w ? (x / w) * (W - 2 * padX) : (W - 2 * padX) / 2);
  const sy = (y: number) => padY + (h ? (y / h) * (H - 2 * padY) : 0);

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Huffman coding — short codes for frequent symbols</h2></div>
        <p className="jsec-sub">
          Count each symbol, then repeatedly merge the two least-frequent nodes; the path to a leaf (left 0, right 1) is its code.
          Common letters end up near the root with short codes, rare ones deeper — and no code is a prefix of another, so the stream
          decodes with no separators.
        </p>
        <label className="huf-field"><span>text</span><input value={text} onChange={(e) => setText(e.target.value)} /></label>

        <svg className="huf-tree" viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W }}>
          {nodes.map((p, i) => {
            const kids = [p.node.left, p.node.right].filter(Boolean) as Node[];
            return kids.map((k, j) => {
              const kp = nodes.find((q) => q.node === k)!;
              const mx = (sx(p.x) + sx(kp.x)) / 2, my = (sy(p.y) + sy(kp.y)) / 2;
              return <g key={`${i}-${j}`}><line x1={sx(p.x)} y1={sy(p.y)} x2={sx(kp.x)} y2={sy(kp.y)} className="huf-edge" /><text x={mx} y={my} className="huf-bit">{j === 0 ? '0' : '1'}</text></g>;
            });
          })}
          {nodes.map((p, i) => p.node.symbol !== undefined
            ? <g key={`l${i}`}><circle cx={sx(p.x)} cy={sy(p.y)} r={11} fill={colorOf[p.node.symbol]} /><text x={sx(p.x)} y={sy(p.y) + 3} className="huf-leaf">{p.node.symbol === ' ' ? '␣' : p.node.symbol}</text></g>
            : <circle key={`n${i}`} cx={sx(p.x)} cy={sy(p.y)} r={4} className="huf-inner" />)}
        </svg>

        <div className="huf-codes">
          {syms.map((s) => (
            <div key={s} className="huf-code" style={{ borderColor: colorOf[s] }}>
              <span className="huf-sym" style={{ background: colorOf[s] }}>{s === ' ' ? '␣' : s}</span>
              <span className="huf-freq">×{cnt[s]}</span>
              <code className="huf-bits">{codes[s]}</code>
            </div>
          ))}
        </div>

        <div className="huf-stream">{[...text].map((ch, i) => <code key={i} style={{ color: colorOf[ch] }}>{codes[ch]}</code>)}</div>

        <div className="huf-stats">
          <span>fixed-width: <strong>{r.originalBits} bits</strong></span>
          <span>Huffman: <strong>{r.compressedBits} bits</strong></span>
          <span className="huf-save">saved <strong>{Math.round((1 - r.ratio) * 100)}%</strong></span>
        </div>
        <p className="huf-foot">
          Huffman is provably optimal for a per-symbol code, and it’s the entropy-coding back end of DEFLATE (zip, gzip, PNG) and
          JPEG. Modern compressors add a dictionary stage (LZ77) to exploit repeated <em>sequences</em>, then Huffman- or
          arithmetic-code the result — but the principle here, spend fewer bits on what’s common, is the whole game.
        </p>
      </section>
    </div>
  );
}
