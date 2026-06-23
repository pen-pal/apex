// Raft leader election, made visible. Five nodes in a ring. Click a node to fire
// its election timeout: it becomes a candidate at a new term, votes for itself, and
// asks everyone else for a vote — a majority makes it leader. Or force a split vote
// (two candidates at once) and watch nobody win, so a new term is needed. Real Raft
// election rules (see raft.ts).
import { useState } from 'react';
import { initCluster, runElection, runRace, majority, type Node } from './raft';

const N = 5;
const CX = 180, CY = 170, R = 120;
const posOf = (i: number) => {
  const a = (i / N) * 2 * Math.PI - Math.PI / 2;
  return { x: CX + R * Math.cos(a), y: CY + R * Math.sin(a) };
};
const ROLE_COLOR: Record<string, string> = { follower: 'hsl(0 0% 70%)', candidate: 'hsl(212 70% 55%)', leader: 'hsl(145 55% 42%)' };

interface Last { kind: 'election' | 'race'; term: number; outcome: 'leader' | 'split'; leader: number | null; voteEdges: [number, number][]; summary: string }

export function RaftSection() {
  const [cluster, setCluster] = useState<Node[]>(() => initCluster(N));
  const [last, setLast] = useState<Last | null>(null);

  const timeout = (i: number) => {
    const r = runElection(cluster, i);
    setCluster(r.nodes);
    const edges = r.votes.filter((v) => v !== i).map((v) => [v, i] as [number, number]);
    setLast({
      kind: 'election', term: r.term, outcome: r.outcome, leader: r.outcome === 'leader' ? i : null, voteEdges: edges,
      summary: r.outcome === 'leader'
        ? `Node ${i} won term ${r.term} with ${r.votes.length}/${N} votes → LEADER.`
        : `Node ${i} got only ${r.votes.length}/${N} votes (needs ${majority(N)}) → no leader; a new election must start at a higher term.`,
    });
  };
  const split = () => {
    const r = runRace(cluster, [0, 1]);
    setCluster(r.nodes);
    const edges: [number, number][] = [];
    for (const c of [0, 1]) for (const v of r.tallies[c]) if (v !== c) edges.push([v, c]);
    setLast({
      kind: 'race', term: r.term, outcome: r.outcome, leader: r.leader, voteEdges: edges,
      summary: r.outcome === 'split'
        ? `Split vote in term ${r.term}: node 0 got ${r.tallies[0].length}, node 1 got ${r.tallies[1].length} — neither reached ${majority(N)}. Term ends with NO leader; election timers restart at a higher term.`
        : `Even in the race, node ${r.leader} reached a majority → LEADER.`,
    });
  };
  const reset = () => { setCluster(initCluster(N)); setLast(null); };

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Raft leader election — agreeing on one leader</h2></div>
        <p className="jsec-sub">
          A Raft cluster needs exactly one leader, but with no shared clock, how do they agree? Each node waits a random
          time; whoever times out first becomes a <strong>candidate</strong>, bumps the <strong>term</strong>, votes for
          itself, and asks the rest. A node votes <strong>once per term</strong>, and a <strong>majority</strong> wins.
          Click a node to make it time out — or force a split and watch nobody win.
        </p>

        <div className="raft-controls">
          <button className="ghost small" onClick={split}>⚡ force a split vote (nodes 0 &amp; 1)</button>
          <button className="ghost small" onClick={reset}>↺ reset cluster</button>
          <span className="raft-hint">tip: click any node to fire its election timeout</span>
        </div>

        <svg className="raft-svg" viewBox="0 0 360 340" role="img" aria-label="raft cluster ring">
          <defs><marker id="raft-arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0,0 L9,4.5 L0,9 z" fill="hsl(28 70% 50%)" /></marker></defs>
          {last?.voteEdges.map(([from, to], i) => {
            const a = posOf(from), b = posOf(to);
            return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="raft-vote" markerEnd="url(#raft-arrow)" />;
          })}
          {cluster.map((node) => {
            const p = posOf(node.id);
            return (
              <g key={node.id} onClick={() => timeout(node.id)} style={{ cursor: 'pointer' }}>
                <circle cx={p.x} cy={p.y} r={26} fill="#fff" stroke={ROLE_COLOR[node.role]} strokeWidth={node.role === 'leader' ? 4 : 2.5} />
                <text x={p.x} y={p.y - 3} className="raft-id" textAnchor="middle">{node.role === 'leader' ? '👑' : ''}N{node.id}</text>
                <text x={p.x} y={p.y + 10} className="raft-role" textAnchor="middle" fill={ROLE_COLOR[node.role]}>{node.role[0].toUpperCase()}·t{node.term}</text>
              </g>
            );
          })}
        </svg>

        <div className="raft-legend">
          <span><i className="raft-sw" style={{ background: ROLE_COLOR.follower }} /> follower</span>
          <span><i className="raft-sw" style={{ background: ROLE_COLOR.candidate }} /> candidate</span>
          <span><i className="raft-sw" style={{ background: ROLE_COLOR.leader }} /> leader</span>
          <span><i className="raft-sw" style={{ background: 'hsl(28 70% 50%)' }} /> vote granted →</span>
        </div>

        {last && <div className={`raft-result ${last.outcome}`}>{last.summary}</div>}
        <p className="enc-note">Randomized election timeouts make ties rare: after a split, each node waits a fresh random interval, so usually one
          candidate starts well before the others and wins cleanly. Raft also requires a leader’s log to be at least as up-to-date as a voter’s — that
          extra rule (beyond term + majority) is what guarantees a committed entry is never lost.</p>
      </section>
    </div>
  );
}
