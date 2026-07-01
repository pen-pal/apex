// Priority inversion, made visible. Two Gantt timelines of the same three tasks — HIGH, MEDIUM, LOW — under
// the same fixed-priority scheduler. On the left, no priority inheritance: watch the HIGH task sit WAITING
// (striped) for ages while the MEDIUM task runs, even though medium is lower priority — because medium keeps
// preempting the low task that holds the lock high needs. On the right, priority inheritance lets the low task
// borrow high's priority, finish its critical section immediately, and hand the lock over — so high finishes
// far sooner and medium runs last, where it belongs. Real model from priorityinv.ts.
import { simulate, SCENARIO } from './priorityinv';

const LANES: ('H' | 'M' | 'L')[] = ['H', 'M', 'L'];
const NAME: Record<string, string> = { H: 'HIGH', M: 'MEDIUM', L: 'LOW' };

function Gantt({ title, ok, result, cols }: { title: string; ok: boolean; result: ReturnType<typeof simulate>; cols: number }) {
  const arrival: Record<string, number> = { L: 0, H: 2, M: 3 };
  return (
    <div className={`pinv-chart ${ok ? 'good' : 'bad'}`}>
      <div className="pinv-ctitle">{title}</div>
      <div className="pinv-grid">
        {LANES.map((id) => (
          <div key={id} className="pinv-lane">
            <span className={`pinv-lname ${id}`}>{NAME[id]}</span>
            <div className="pinv-cells">
              {Array.from({ length: cols }, (_, t) => {
                const who = result.timeline[t];
                let cls = 'pre';
                if (t >= arrival[id]) {
                  if (who === id) cls = `run ${id}`;
                  else if (result.completion[id] && t >= result.completion[id]) cls = 'gone';
                  else cls = 'wait';
                }
                return <span key={t} className={`pinv-cell ${cls}`} title={`t=${t}`} />;
              })}
            </div>
          </div>
        ))}
      </div>
      <div className={`pinv-summary ${ok ? 'good' : 'bad'}`}>
        HIGH finishes at <b>t={result.completion.H}</b> · waited <b>{result.hWait}</b> extra
        {ok ? ' — bounded by LOW’s critical section' : ' — blocked the whole time MEDIUM ran'}
      </div>
    </div>
  );
}

export function PriorityInvSection() {
  const noInh = simulate(SCENARIO, false);
  const inh = simulate(SCENARIO, true);
  const cols = Math.max(noInh.timeline.length, inh.timeline.length);

  return (
    <div className="pinv">
      <p className="pinv-intro">
        Three tasks share a scheduler: <span className="pinv-k H">HIGH</span>, <span className="pinv-k M">MEDIUM</span>,
        and <span className="pinv-k L">LOW</span>. LOW grabs a lock that HIGH will need. The danger: while HIGH
        waits for that lock, MEDIUM (which needs no lock) preempts LOW — so LOW can't release, and HIGH is stuck
        behind MEDIUM. Priorities are <strong>inverted</strong>. This is the bug that reset Mars Pathfinder in a
        loop until JPL patched it live.
      </p>

      <div className="pinv-charts">
        <Gantt title="❌ no inheritance" ok={false} result={noInh} cols={cols} />
        <Gantt title="✓ priority inheritance" ok={true} result={inh} cols={cols} />
      </div>

      <div className="pinv-legend">
        <span><i className="pinv-sw run H" /> running</span>
        <span><i className="pinv-sw wait" /> arrived, waiting</span>
        <span><i className="pinv-sw gone" /> done</span>
      </div>

      <p className="pinv-foot">
        Priority inheritance is the standard fix (it's in POSIX threads as <code>PTHREAD_PRIO_INHERIT</code>, and
        it's exactly what JPL enabled on Pathfinder): while a high-priority task is blocked on a mutex, the
        thread <em>holding</em> that mutex temporarily runs at the blocked task's priority, so nothing of medium
        priority can preempt it. The critical section finishes as fast as possible and the lock is handed over —
        the inversion is now <strong>bounded</strong> by the length of the critical section instead of being
        open-ended. A stricter cousin, the <strong>priority ceiling protocol</strong>, gives each lock a ceiling
        priority and also prevents deadlock and chained blocking. The deeper lesson is that a lock couples the
        schedulability of everyone who touches it — so real-time systems keep critical sections tiny and think
        hard about who shares a lock. (Sha, Rajkumar &amp; Lehoczky 1990; Reeves, "What really happened on
        Mars.")
      </p>
    </div>
  );
}
