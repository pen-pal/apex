// The ABA problem, made visible. Two threads race on a lock-free stack. Toggle between a plain CAS (compares
// only the pointer) and a versioned CAS (compares pointer + counter). Step through the interleaving: T2 moves
// the top A → B → C → A while T1 is preempted, so when T1's CAS runs, the top is A again. The plain CAS is
// fooled and splices in a freed node; the versioned CAS sees the counter moved and safely fails. Real model
// from aba.ts.
import { useState } from 'react';
import { runScenario } from './aba';

export function AbaSection() {
  const [tagged, setTagged] = useState(false);
  const r = runScenario(tagged);

  return (
    <div className="aba">
      <p className="aba-intro">
        Lock-free code coordinates with <strong>compare-and-swap</strong>: "set this to NEW only if it still
        holds OLD." The trap: CAS checks the value is the <em>same</em>, not that it never <em>changed</em>. If
        another thread cycles it <b>A → B → A</b> while you're preempted, your CAS sees A and succeeds — though
        the world moved. Watch it happen on a stack (A→B→C):
      </p>

      <div className="aba-toggle">
        <button type="button" className={`aba-tbtn ${!tagged ? 'on bad' : ''}`} onClick={() => setTagged(false)}>plain CAS (pointer only)</button>
        <button type="button" className={`aba-tbtn ${tagged ? 'on ok' : ''}`} onClick={() => setTagged(true)}>versioned CAS (pointer + counter)</button>
      </div>

      <div className={`aba-verdict ${r.corrupted ? 'bad' : 'ok'}`}>
        {r.corrupted
          ? <><b>⚠ CORRUPTED</b> — the stale CAS succeeded and set <code>top</code> to <b>B</b>, a node that was already popped and freed. The stack is now broken (dangling pointer, lost nodes).</>
          : <><b>✓ SAFE</b> — the CAS failed because the counter had moved (0 ≠ 3), so T1 detects the interference and retries correctly.</>}
      </div>

      <ol className="aba-timeline">
        {r.events.map((e, i) => {
          const isCas = i === r.events.length - 1;
          return (
            <li key={i} className={`aba-step ${e.actor === 'T1' ? 't1' : 't2'} ${isCas ? (r.corrupted ? 'corrupt' : 'safe') : ''}`}>
              <span className={`aba-actor ${e.actor === 'T1' ? 'a1' : 'a2'}`}>{e.actor}</span>
              <span className="aba-detail">{e.detail}</span>
              <span className="aba-reg">top=<b>{e.top}</b>{tagged && <span className="aba-ver"> v{e.version}</span>}</span>
            </li>
          );
        })}
      </ol>

      <p className="aba-foot">
        The reason ABA is a <em>pointer</em> problem specifically is memory reuse: a general-purpose allocator
        loves to hand back a just-freed address, so "the same pointer value" stops meaning "the same object." The
        fixes all restore that meaning. A <strong>tagged pointer</strong> (shown here) glues a version counter to
        the pointer and CAS-es the pair atomically — hardware helps with double-width CAS (x86
        <code> CMPXCHG16B</code>, ARM <code>CASP</code>) — so a full A→B→A cycle bumps the tag and your stale CAS
        fails. When you can't spare tag bits, you keep the memory from being reused under you:
        <strong> hazard pointers</strong> let each thread publish the addresses it's reading so no one frees them,
        and epoch-based / <strong>RCU</strong> reclamation defers freeing until every reader that could hold a
        reference has moved on. Higher-level languages dodge it wholesale — a tracing garbage collector never
        frees a node while any thread still references it, so the address can't be reused and ABA simply can't
        arise (which is why you rarely hear about it in Java/Go and constantly in C/C++ lock-free code). It's the
        canonical example of why "lock-free" is not "easy": the atomic instruction is the simple part; safe
        memory reclamation is the hard part. (Treiber, 1986; Michael, "Hazard Pointers," 2004.)
      </p>
    </div>
  );
}
