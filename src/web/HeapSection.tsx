// Binary heap, made visible. The same heap shown two ways — as a tree and as the flat array
// it really is — with the last sift path highlighted. Push values and watch them bubble up;
// pop the minimum and watch the replacement sink down. Real heap in heap.ts (tested).
import { useMemo, useState } from 'react';
import { create, push, pop, peek, type Heap } from './heap';

function clone(h: Heap): Heap { return { data: [...h.data] }; }

export function HeapSection() {
  const [heap, setHeap] = useState<Heap>(() => { const h = create(); [5, 3, 8, 1, 9, 2, 7].forEach((v) => push(h, v)); return h; });
  const [val, setVal] = useState('4');
  const [lastPath, setLastPath] = useState<Set<number>>(new Set());
  const [note, setNote] = useState('');

  const data = heap.data;
  const doPush = () => { const v = parseInt(val, 10); if (isNaN(v)) return; const h = clone(heap); const p = push(h, v); setHeap(h); setLastPath(new Set(p)); setNote(`pushed ${v} — sifted up ${p.length - 1} level${p.length === 2 ? '' : 's'}`); };
  const doPop = () => { const h = clone(heap); const r = pop(h); setHeap(h); setLastPath(new Set(r.path)); setNote(r.min === null ? 'heap is empty' : `popped the minimum (${r.min}); the last element sank down ${r.path.length - 1} level${r.path.length === 2 ? '' : 's'}`); };
  const reset = () => { const h = create(); [5, 3, 8, 1, 9, 2, 7].forEach((v) => push(h, v)); setHeap(h); setLastPath(new Set()); setNote(''); };

  // tree layout: level by level
  const levels = useMemo(() => {
    const out: number[][] = [];
    let i = 0, w = 1;
    while (i < data.length) { out.push(data.slice(i, i + w).map((_, k) => i + k)); i += w; w *= 2; }
    return out;
  }, [data]);

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Binary heap — the smallest is always on top</h2></div>
        <p className="jsec-sub">
          A min-heap is a complete binary tree where every parent is ≤ its children, so the minimum sits at the root, free to read. It’s
          stored as a plain array: node <code>i</code>’s children are at <code>2i+1</code> and <code>2i+2</code>. Push appends and
          <strong> sifts up</strong>; pop-min moves the last element to the root and <strong>sifts down</strong> — each O(log n).
        </p>

        <div className="heap-ops">
          <input value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && doPush()} inputMode="numeric" />
          <button onClick={doPush}>push</button>
          <button onClick={doPop}>pop min{peek(heap) !== null ? ` (${peek(heap)})` : ''}</button>
          <button onClick={reset} className="heap-reset">reset</button>
        </div>

        <div className="heap-tree">
          {levels.map((level, li) => (
            <div key={li} className="heap-level">
              {level.map((idx) => (
                <div key={idx} className={`heap-node ${lastPath.has(idx) ? 'sift' : ''} ${idx === 0 ? 'root' : ''}`}>{data[idx]}</div>
              ))}
            </div>
          ))}
          {data.length === 0 && <div className="heap-empty">empty</div>}
        </div>

        <div className="heap-array">
          <span className="heap-alabel">array:</span>
          {data.map((v, i) => <span key={i} className={`heap-cell ${lastPath.has(i) ? 'sift' : ''}`}><i>{i}</i>{v}</span>)}
        </div>

        {note && <div className="heap-note">{note}</div>}

        <p className="heap-foot">
          Storing the tree as a flat array drops the pointers entirely: contiguous memory for cache locality, and the tree shape is implicit in the indices. Building a
          heap from n items is O(n) (bottom-up “heapify”), and popping all of them sorts in O(n log n) — that’s <strong>heapsort</strong>,
          in place. A priority queue like this is what lets Dijkstra and A* always pull the closest frontier cell next, what merges
          Huffman’s two least-frequent nodes, and what event simulators use to fire the next-soonest event.
        </p>
      </section>
    </div>
  );
}
