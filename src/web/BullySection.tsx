// The Bully algorithm, made visible. A row of nodes you can kill or revive; pick who
// notices the dead coordinator and starts the election, then step through the ELECTION /
// OK / COORDINATOR messages and watch the highest survivor always win. Real logic in
// bully.ts (tested).
import { useMemo, useState } from 'react';
import { runElection, type Message } from './bully';

const NODES = [1, 2, 3, 4, 5];

const COLOR: Record<Message['type'], string> = {
  ELECTION: 'hsl(212 70% 50%)', OK: 'hsl(150 55% 42%)', COORDINATOR: 'hsl(38 85% 48%)',
};

export function BullySection() {
  const [dead, setDead] = useState<Set<number>>(new Set([5]));
  const [starter, setStarter] = useState(2);
  const alive = useMemo(() => new Set(NODES.filter((n) => !dead.has(n))), [dead]);
  const startOk = alive.has(starter);
  const e = useMemo(() => (startOk ? runElection(NODES, alive, starter) : null), [alive, starter, startOk]);
  const [step, setStep] = useState(99);

  const shown = e ? Math.min(step, e.messages.length) : 0;

  const toggleDead = (n: number) => setDead((s) => { const x = new Set(s); x.has(n) ? x.delete(n) : x.add(n); return x; });

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>The Bully algorithm — the highest survivor wins</h2></div>
        <p className="jsec-sub">
          When the leader dies, someone has to take over — and everyone must agree on who. The Bully rule is simple: the live node with
          the highest id becomes coordinator. A node that notices the gap challenges everyone above it; if anyone higher is alive, it
          “bullies” its way in and challenges further up. Kill some nodes, pick who starts, and step through it.
        </p>

        <div className="bully-nodes">
          {NODES.map((n) => (
            <div key={n} className={`bully-node ${dead.has(n) ? 'dead' : ''} ${e?.coordinator === n ? 'coord' : ''} ${starter === n ? 'starter' : ''}`}>
              <div className="bully-id">{n}{e?.coordinator === n && <span className="bully-crown">👑</span>}</div>
              <button onClick={() => toggleDead(n)}>{dead.has(n) ? 'revive' : 'kill'}</button>
              <label className="bully-startpick"><input type="radio" name="starter" checked={starter === n} onChange={() => setStarter(n)} disabled={dead.has(n)} /> start</label>
            </div>
          ))}
        </div>

        {!startOk ? <div className="bully-warn">Pick a live node to start the election.</div> : e && (
          <>
            <div className="bully-controls">
              <button onClick={() => setStep(0)} disabled={shown === 0}>⏮</button>
              <button onClick={() => setStep(Math.max(0, shown - 1))} disabled={shown === 0}>◀</button>
              <span className="bully-count">message {shown} / {e.messages.length}</span>
              <button onClick={() => setStep(shown + 1)} disabled={shown >= e.messages.length}>▶</button>
              <button onClick={() => setStep(e.messages.length)} disabled={shown >= e.messages.length}>⏭</button>
            </div>

            <div className="bully-log">
              {e.messages.slice(0, shown).map((m, i) => (
                <div key={i} className={`bully-msg ${i === shown - 1 ? 'cur' : ''}`}>
                  <span className="bully-tag" style={{ background: COLOR[m.type] }}>{m.type}</span>
                  <span>{m.from} → {m.to}</span>
                  <span className="bully-why">
                    {m.type === 'ELECTION' ? `node ${m.from} challenges higher node ${m.to}`
                      : m.type === 'OK' ? `node ${m.to} is alive — takes over the election`
                      : `node ${m.from} declares itself coordinator to ${m.to}`}
                  </span>
                </div>
              ))}
            </div>

            <div className="bully-result">
              {shown >= e.messages.length
                ? <>👑 Node <b>{e.coordinator}</b> is the new coordinator — the highest live id.</>
                : `electing… (highest live id is ${e.coordinator})`}
            </div>
          </>
        )}

        <p className="bully-foot">
          It always converges on max(alive), and once a higher node recovers it can call a new election and reclaim leadership — hence
          “bully”. The cost is O(n²) messages in the worst case. The Ring algorithm is the lower-traffic alternative; production systems
          usually fold leader election into a consensus protocol (Raft’s randomized election timeouts, ZooKeeper/ZAB) so the leader and
          the replicated log stay consistent together.
        </p>
      </section>
    </div>
  );
}
