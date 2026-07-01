// Karatsuba, made visible. Enter two numbers and watch each split in half, spawn just THREE half-size products
// instead of four, and recombine — recursively, all the way down to single digits. The counter races Karatsuba's
// single-digit multiplies against schoolbook's n². Real logic from karatsuba.ts.
import { useMemo, useState } from 'react';
import { karatsuba, schoolbookMults, type Node } from './karatsuba';

interface Placed { node: Node; x: number; depth: number }

function layout(root: Node): { placed: Placed[]; edges: [number, number, number, number][]; w: number; h: number } {
  const placed: Placed[] = [], edges: [number, number, number, number][] = [];
  let leaf = 0, maxD = 0;
  const walk = (n: Node, depth: number): number => {
    maxD = Math.max(maxD, depth);
    if (n.children.length === 0) { const x = leaf++; placed.push({ node: n, x, depth }); return x; }
    const xs = n.children.map((c) => walk(c, depth + 1));
    const x = xs.reduce((a, b) => a + b, 0) / xs.length;
    placed.push({ node: n, x, depth });
    for (let i = 0; i < xs.length; i++) edges.push([x, depth, xs[i], depth + 1]);
    return x;
  };
  walk(root, 0);
  return { placed, edges, w: Math.max(1, leaf), h: maxD };
}

export function KaratsubaSection() {
  const [xs, setXs] = useState('1234');
  const [ys, setYs] = useState('5678');
  const x = useMemo(() => { try { return BigInt(xs.replace(/\D/g, '') || '0'); } catch { return 0n; } }, [xs]);
  const y = useMemo(() => { try { return BigInt(ys.replace(/\D/g, '') || '0'); } catch { return 0n; } }, [ys]);
  const r = useMemo(() => karatsuba(x, y), [x, y]);
  const school = schoolbookMults(x, y);
  const { placed, edges, w, h } = useMemo(() => layout(r.tree), [r]);

  // top-level decomposition for the algebra panel
  const t = r.tree;
  const m = t.m, B = 10n ** BigInt(m);
  const a = x / B, b = x % B, c = y / B, d = y % B;
  const [z2, z0, z1] = t.children.length === 3 ? t.children.map((k) => k.product) : [x * y, 0n, 0n];
  const cross = t.children.length === 3 ? z1 - z2 - z0 : 0n;

  const W = 680, H = 30 + h * 58;
  const nx = (px: number) => 20 + (w <= 1 ? (W - 40) / 2 : (px / (w - 1)) * (W - 40));
  const ny = (d: number) => 20 + d * 58;

  return (
    <div className="kar">
      <p className="kar-intro">
        Schoolbook multiplication does n² single-digit multiplies. Karatsuba splits each number in half —
        <strong> x = a·B + b</strong>, <strong>y = c·B + d</strong> — and notices the product needs only
        <strong> three</strong> half-size multiplies, not four, because the middle term
        <code> ad+bc = (a+b)(c+d) − ac − bd</code>. Recurse, and n² becomes <strong>n^1.585</strong>.
      </p>

      <div className="kar-inputs">
        <input className="kar-in" value={xs} onChange={(e) => setXs(e.target.value)} inputMode="numeric" />
        <span>×</span>
        <input className="kar-in" value={ys} onChange={(e) => setYs(e.target.value)} inputMode="numeric" />
        <span className="kar-eq">= <b>{r.product.toString()}</b></span>
      </div>

      {t.children.length === 3 && (
        <div className="kar-algebra">
          <div className="kar-split"><span>x = <b>{a.toString()}</b>·B + <b>{b.toString()}</b></span><span>y = <b>{c.toString()}</b>·B + <b>{d.toString()}</b></span><span className="kar-bnote">B = 10^{m}</span></div>
          <div className="kar-prods">
            <div className="kar-prod z2"><span>z₂ = a·c</span><b>{a.toString()}×{c.toString()} = {z2.toString()}</b></div>
            <div className="kar-prod z0"><span>z₀ = b·d</span><b>{b.toString()}×{d.toString()} = {z0.toString()}</b></div>
            <div className="kar-prod z1"><span>z₁ = (a+b)(c+d)</span><b>{(a + b).toString()}×{(c + d).toString()} = {z1.toString()}</b></div>
          </div>
          <div className="kar-combine">middle = z₁ − z₂ − z₀ = <b>{cross.toString()}</b> &nbsp;→&nbsp; z₂·B² + middle·B + z₀ = <b>{r.product.toString()}</b></div>
        </div>
      )}

      <div className="kar-treewrap">
        <div className="kar-tl">recursion tree — every node is one multiply; green leaves are single-digit</div>
        <svg viewBox={`0 0 ${W} ${H}`} className="kar-tree">
          {edges.map((e, i) => <line key={i} x1={nx(e[0])} y1={ny(e[1])} x2={nx(e[2])} y2={ny(e[3])} className="kar-edge" />)}
          {placed.map((p, i) => (
            <g key={i}>
              <rect x={nx(p.x) - 26} y={ny(p.depth) - 10} width={52} height={20} rx={4} className={`kar-node ${p.node.children.length === 0 ? 'leaf' : ''}`} />
              <text x={nx(p.x)} y={ny(p.depth) + 4} className="kar-nt" textAnchor="middle">{p.node.x.toString()}×{p.node.y.toString()}</text>
            </g>
          ))}
        </svg>
      </div>

      <div className="kar-counts">
        <div className="kar-count bad"><span>schoolbook (n²)</span><b>{school}</b><small>digit multiplies</small></div>
        <div className="kar-count good"><span>Karatsuba</span><b>{r.mults}</b><small>digit multiplies</small></div>
        <div className="kar-count"><span>ratio</span><b>{(school / r.mults).toFixed(2)}×</b><small>fewer, and it grows with size</small></div>
      </div>

      <p className="kar-foot">
        For small numbers Karatsuba can actually do <em>more</em> multiplies than schoolbook — the extra additions
        and the recursion overhead don't pay off until the operands are big enough (that crossover is why real
        libraries use schoolbook below ~20–40 digits and only then switch to Karatsuba). But the asymptotics are
        relentless: the ratio grows as n^0.415, so it's already ~18× at 1000 digits in the clean analysis (this
        base-10 demo does a bit less, since the (a+b)(c+d) halves can carry an extra digit), and the gap keeps
        widening — near 50× by ~10,000 digits. It was
        a genuinely surprising result — Kolmogorov had conjectured n² was optimal and set it as a seminar problem;
        Karatsuba found this within a week, and Kolmogorov was so struck he wrote up the result himself. The same
        divide-and-conquer idea generalizes: Toom-Cook splits into three or more parts (n^1.465 and below), and
        Schönhage-Strassen (n·log n·log log n) and finally Harvey-van der Hoeven (2021, n·log n) use the FFT — which is why multiplying
        two million-digit numbers (routine in cryptography and π-computation records) is feasible at all. Every one
        of them rests on the same move you see here: buy fewer multiplications with a little more addition.
        (Karatsuba &amp; Ofman, 1962.)
      </p>
    </div>
  );
}
