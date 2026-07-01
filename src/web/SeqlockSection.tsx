// The seqlock, made visible. Pick an interleaving of a writer (updating two fields that must agree) and a reader,
// and step through it: the counter goes odd while writing, the reader snapshots it, reads the data, and re-checks
// it. Two verdicts are shown side by side — a naive lockless reader that just takes what it read (and sometimes
// tears), and the seqlock reader that retries on an odd or changed counter. The footer proves it exhaustively
// across all 70 interleavings. Real model from seqlock.ts.
import { useMemo, useState } from 'react';
import { writerOps, readerOps, execute, seqlockOutcome, naiveOutcome, interleavings, type State, type Ev } from './seqlock';

const INIT: State = { seq: 0, a: 1, b: 1 };
const W = writerOps(1), R = readerOps();
const SCENARIOS: { name: string; order: Ev[] }[] = [
  { name: 'race: write during read', order: [R[0], R[1], W[0], W[1], W[2], W[3], R[2], R[3]] },
  { name: 'write in progress (odd)', order: [W[0], R[0], R[1], R[2], R[3], W[1], W[2], W[3]] },
  { name: 'clean: write, then read', order: [W[0], W[1], W[2], W[3], R[0], R[1], R[2], R[3]] },
];

// exhaustive counts (computed once)
const ALL = interleavings(W, R);
const NAIVE_TORN = ALL.filter((o) => naiveOutcome(execute(o, INIT).regs).kind === 'torn').length;

const verdictText = (o: ReturnType<typeof seqlockOutcome>) =>
  o.kind === 'retry' ? '↻ retry (read again)' : o.kind === 'torn' ? `✗ TORN — a=${o.a}, b=${o.b} (mixed!)` : `✓ consistent — a=${o.a}, b=${o.b}`;

export function SeqlockSection() {
  const [sc, setSc] = useState(SCENARIOS[0]);

  const trace = useMemo(() => {
    let s = { ...INIT };
    return sc.order.map((ev) => {
      if (ev.actor === 'W') s = (ev as any).apply(s);
      const odd = s.seq % 2 === 1;
      return { ev, state: { ...s }, odd };
    });
  }, [sc]);

  const { regs } = execute(sc.order, INIT);
  const sl = seqlockOutcome(regs), nv = naiveOutcome(regs);

  return (
    <div className="sqk">
      <p className="sqk-intro">
        A writer updates two fields that must stay in sync (here <code>a</code> and <code>b</code>, both holding
        the current generation). It bumps a counter to <strong>odd</strong> before writing and <strong>even</strong>
        after. A reader snapshots the counter (<code>s1</code>), reads the data, re-reads the counter
        (<code>s2</code>), and accepts only if <code>s1</code> was even and equals <code>s2</code>. Pick an
        interleaving:
      </p>

      <div className="sqk-presets">
        {SCENARIOS.map((s) => <button key={s.name} type="button" className={`sqk-preset ${sc.name === s.name ? 'on' : ''}`} onClick={() => setSc(s)}>{s.name}</button>)}
      </div>

      <div className="sqk-timeline">
        <div className="sqk-lanes"><span className="sqk-lane w">writer</span><span className="sqk-lane r">reader</span><span className="sqk-lane s">state (seq · a · b)</span></div>
        {trace.map(({ ev, state, odd }, i) => (
          <div key={i} className={`sqk-row ${ev.actor === 'W' ? 'wrow' : 'rrow'} ${odd ? 'mid' : ''}`}>
            <span className="sqk-op w">{ev.actor === 'W' ? ev.label : ''}</span>
            <span className="sqk-op r">{ev.actor === 'R' ? ev.label : ''}</span>
            <span className="sqk-st"><b className={odd ? 'odd' : ''}>{state.seq}</b> · {state.a} · {state.b}{odd ? '  ⟵ write in progress' : ''}</span>
          </div>
        ))}
      </div>

      <div className="sqk-regs">reader captured: s1=<b>{regs.s1}</b> · a=<b>{regs.ra}</b> · b=<b>{regs.rb}</b> · s2=<b>{regs.s2}</b></div>

      <div className="sqk-verdicts">
        <div className={`sqk-verdict ${nv.kind === 'torn' ? 'bad' : 'ok'}`}>
          <span className="sqk-vh">naive lockless read</span>
          <span className="sqk-vv">{verdictText(nv)}</span>
          <span className="sqk-vn">takes whatever it read — no counter check</span>
        </div>
        <div className={`sqk-verdict ${sl.kind === 'retry' ? 'retry' : 'ok'}`}>
          <span className="sqk-vh">seqlock read</span>
          <span className="sqk-vv">{verdictText(sl)}</span>
          <span className="sqk-vn">{sl.kind === 'retry' ? (regs.s1 % 2 === 1 ? 's1 was odd → a write was in progress' : 's1 ≠ s2 → a write happened mid-read') : 's1 even and unchanged → safe'}</span>
        </div>
      </div>

      <div className="sqk-proof">
        Across all <b>{ALL.length}</b> possible interleavings of these steps: the naive reader tears on
        <b> {NAIVE_TORN}</b>, but the seqlock reader accepts a torn value on <b>0</b> — it always returns a
        consistent snapshot or retries.
      </div>

      <p className="sqk-foot">
        The economics are the whole point: reads are the overwhelmingly common case (a clock, a routing table, a
        config snapshot read millions of times between rare updates), so seqlock pushes all the cost onto the rare
        writer and the even-rarer read-that-races-a-write. Readers take no lock, write nothing to shared memory
        (no cache-line ping-pong between CPUs), and never block — they just occasionally loop. Compare the
        alternatives: a mutex serializes readers and bounces a cache line on every read; a reader-writer lock
        still has readers write the lock's shared state; <strong>RCU</strong> gives lock-free reads too but needs
        the writer to keep the old copy alive until readers finish, which suits pointer-based structures, whereas
        seqlock suits small fixed structs updated in place. The sharp edges: the protected data must be safe to
        read while torn (no dereferencing a half-updated pointer — a fault, not just a wrong value), writers must
        still exclude each other, and it needs real <strong>memory barriers</strong> so the compiler and CPU
        don't reorder the counter checks around the data reads (the kernel's <code>read_seqbegin</code> /
        <code>read_seqretry</code> place them correctly). Writer starvation is possible in theory if reads never
        stop, but in practice writes are so rare it doesn't bite. It's the mechanism behind Linux's
        <code> gettimeofday</code> fast path via the vDSO — which is why reading the time doesn't even enter the
        kernel. (Linux <code>seqlock_t</code>/<code>seqcount_t</code>.)
      </p>
    </div>
  );
}
