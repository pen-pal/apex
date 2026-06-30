// NUMA first-touch, made visible. Two sockets, each with its own cores and memory. Pick how the big array
// gets initialized — serially from one core, in parallel by each core, or interleaved — and watch where
// the pages land and which accesses cross the slow interconnect. The whole lesson in one picture: the
// thread that FIRST WRITES a page decides which node it lives on, so parallel init turns every later
// access local. Real model from numa.ts.
import { useMemo, useState } from 'react';
import { firstTouch, interleave, cost, LOCAL_NS, REMOTE_NS, type Topology } from './numa';

const TOPO: Topology = { cpuNode: [0, 0, 1, 1] }; // cpu0,1→node0; cpu2,3→node1
const PAGES = [0, 1, 2, 3];
// Each core works on "its" page (core c ↔ page c) — a standard partitioned workload.
const WORK = PAGES.map((p) => ({ page: p, cpu: p }));

type Policy = 'serial' | 'parallel' | 'interleave';
const POLICIES: { id: Policy; label: string; note: string }[] = [
  { id: 'serial', label: 'serial init (1 thread)', note: 'core 0 initializes the whole array — first-touch pins every page to node 0' },
  { id: 'parallel', label: 'parallel first-touch', note: 'each core initializes its own slice — pages land local to whoever uses them' },
  { id: 'interleave', label: 'interleave (numactl)', note: 'round-robin pages across nodes — balanced bandwidth, not locality-optimal' },
];

const placementFor = (p: Policy): number[] =>
  p === 'serial' ? firstTouch([0, 0, 0, 0], TOPO)
    : p === 'parallel' ? firstTouch([0, 1, 2, 3], TOPO)
      : interleave(4, 2);

export function NumaSection() {
  const [policy, setPolicy] = useState<Policy>('serial');
  const placement = useMemo(() => placementFor(policy), [policy]);
  const result = useMemo(() => cost(placement, WORK, TOPO), [placement]);
  const best = cost(placementFor('parallel'), WORK, TOPO).ns;
  const slowdown = (result.ns / best);

  return (
    <div className="numa">
      <p className="numa-intro">
        On a multi-socket box, memory is divided among <strong>nodes</strong>; a core reaches its own node's
        RAM fast ({LOCAL_NS}ns) and the other node's RAM slower ({REMOTE_NS}ns — the <em>NUMA factor</em>).
        Linux decides where a page lives by <strong>first-touch</strong>: the page goes to the node of the
        core that first <em>writes</em> it. So how you initialize decides locality for the whole run.
      </p>

      <div className="numa-policies">
        {POLICIES.map((p) => (
          <button key={p.id} type="button" className={`numa-pbtn ${policy === p.id ? 'on' : ''}`} onClick={() => setPolicy(p.id)}>{p.label}</button>
        ))}
      </div>
      <div className="numa-pnote">{POLICIES.find((p) => p.id === policy)!.note}</div>

      <div className="numa-machine">
        {[0, 1].map((node) => (
          <div key={node} className="numa-node">
            <div className="numa-nh">node {node}</div>
            <div className="numa-cores">
              {TOPO.cpuNode.map((nd, cpu) => nd === node ? <span key={cpu} className="numa-core">core {cpu}</span> : null)}
            </div>
            <div className="numa-mem">
              {placement.map((pn, page) => pn === node ? (
                <span key={page} className="numa-page">pg {page}</span>
              ) : null)}
              {placement.every((pn) => pn !== node) && <span className="numa-empty">— no pages —</span>}
            </div>
          </div>
        ))}
        <div className="numa-link"><span>interconnect</span></div>
      </div>

      <div className="numa-access">
        <div className="numa-ah">accesses (each core reads its page):</div>
        <div className="numa-arows">
          {WORK.map((a) => {
            const local = TOPO.cpuNode[a.cpu] === placement[a.page];
            return (
              <div key={a.page} className={`numa-arow ${local ? 'local' : 'remote'}`}>
                <span>core {a.cpu}</span><span className="numa-aedge">{local ? '→ local →' : '⇢ remote ⇢'}</span><span>pg {a.page} (node {placement[a.page]})</span>
                <b>{local ? LOCAL_NS : REMOTE_NS}ns</b>
              </div>
            );
          })}
        </div>
      </div>

      <div className="numa-tally">
        <div className="numa-stat ok"><span>local</span><b>{result.local}</b></div>
        <div className="numa-stat bad"><span>remote</span><b>{result.remote}</b></div>
        <div className="numa-stat"><span>total</span><b>{result.ns}ns</b></div>
        <div className="numa-stat"><span>avg/access</span><b>{result.avgNs}ns</b></div>
        <div className={`numa-stat ${slowdown > 1.001 ? 'bad' : 'ok'}`}><span>vs first-touch</span><b>{slowdown.toFixed(2)}×</b></div>
      </div>

      <p className="numa-foot">
        The trap: <code>malloc</code> doesn't place anything — it just reserves addresses; the first write
        does the placing. A common bug is a serial <code>memset</code>/init loop that pins a multi-gigabyte
        array to one socket, then wonders why the other socket's threads are slow. Fixes: a parallel
        first-touch init loop (each thread writes the region it will later use), explicit policy via
        <code> numactl</code>/<code>set_mempolicy</code>/<code>mbind</code>, NUMA-aware allocators, and
        pinning threads with <code>sched_setaffinity</code> so the OS doesn't migrate them away from their
        memory. The kernel's <strong>AutoNUMA</strong> balancer can also migrate hot pages toward the cores
        using them — but getting first-touch right up front beats fixing it later. (Lameter 2013; numa(7).)
      </p>
    </div>
  );
}
