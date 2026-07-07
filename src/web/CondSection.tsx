// Conditional & range requests, made visible. A resource carries an ETag and Last-Modified; build a
// request with preconditions (If-None-Match, If-Modified-Since, Range, If-Range, If-Match) and watch
// the server answer 200 / 304 / 206 / 416 / 412 — and how many body bytes that saves. All status
// logic from conditional.ts (tested against RFC 9110).
import { useMemo, useState } from 'react';
import { respond, type Req, type Resource } from './conditional';

const RES: Resource = { etag: '"v7"', lastModified: 10, content: 'ABCDEFGHIJKLMNOP' };

type Scn = { id: string; label: string; req: (range: [number, number]) => Req; headerLine: (range: [number, number]) => string };
const SCENARIOS: Scn[] = [
  { id: 'plain', label: 'plain GET', req: () => ({ method: 'GET' }), headerLine: () => 'GET /file' },
  { id: 'reval', label: 'revalidate (fresh)', req: () => ({ method: 'GET', ifNoneMatch: '"v7"' }), headerLine: () => 'GET /file\nIf-None-Match: "v7"' },
  { id: 'reval-stale', label: 'revalidate (changed)', req: () => ({ method: 'GET', ifNoneMatch: '"v6"' }), headerLine: () => 'GET /file\nIf-None-Match: "v6"' },
  { id: 'range', label: 'resume / range', req: (r) => ({ method: 'GET', range: r }), headerLine: (r) => `GET /file\nRange: bytes=${r[0]}-${r[1]}` },
  { id: 'ifrange-stale', label: 'If-Range stale', req: (r) => ({ method: 'GET', range: r, ifRange: '"v6"' }), headerLine: (r) => `GET /file\nRange: bytes=${r[0]}-${r[1]}\nIf-Range: "v6"` },
  { id: 'put-ok', label: 'PUT (If-Match ok)', req: () => ({ method: 'PUT', ifMatch: '"v7"', body: '…' }), headerLine: () => 'PUT /file\nIf-Match: "v7"' },
  { id: 'put-conflict', label: 'PUT (If-Match stale)', req: () => ({ method: 'PUT', ifMatch: '"v6"', body: '…' }), headerLine: () => 'PUT /file\nIf-Match: "v6"' },
];

const statusClass = (s: number) => (s === 200 ? 'ok' : s === 206 ? 'partial' : s === 304 ? 'notmod' : 'err');

export function CondSection() {
  const [scn, setScn] = useState('reval');
  const [range, setRange] = useState<[number, number]>([4, 9]);
  const sc = SCENARIOS.find((s) => s.id === scn)!;
  const req = sc.req(range);
  const resp = useMemo(() => respond(RES, req), [scn, range]);
  const isRange = scn === 'range' || scn === 'ifrange-stale';
  const bodyBytes = resp.body ? resp.body.length : 0;

  // which content bytes are in the response body (for the 206 highlight)
  const served = useMemo(() => {
    if (resp.status === 206) { const m = resp.headers['Content-Range'].match(/bytes (\d+)-(\d+)/); return m ? [+m[1], +m[2]] as [number, number] : null; }
    if (resp.status === 200 && req.method === 'GET') return [0, RES.content.length - 1] as [number, number];
    return null;
  }, [resp]);

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Conditional &amp; range requests — don’t resend what the client already has</h2></div>
        <p className="jsec-sub">
          You loaded the page once; on the next visit most of it hasn’t changed — re-downloading it would be pure waste, and that is
          what <strong>conditional requests</strong> prevent. Every resource carries a <strong>validator</strong>: an
          <strong> ETag</strong> (an opaque version id) and a Last-Modified time. Clients turn them into <strong>preconditions</strong> —
          “only send the body if it changed” (revalidation), “send only these bytes” (resume), “only write if nobody beat me to it”
          (optimistic concurrency). The server answers with a status that can skip the body entirely.
        </p>

        <div className="cond-res">
          <span className="cond-reslbl">resource</span>
          <span className="cond-tag">ETag {RES.etag}</span>
          <span className="cond-tag">Last-Modified: day {RES.lastModified}</span>
          <span className="cond-tag">{RES.content.length} bytes</span>
        </div>

        <div className="cond-scns">
          {SCENARIOS.map((s) => <button key={s.id} className={`cond-scn ${scn === s.id ? 'on' : ''}`} onClick={() => setScn(s.id)}>{s.label}</button>)}
        </div>
        {isRange && (
          <div className="cond-rangectrl">
            <label>range start <input type="range" min={0} max={RES.content.length + 2} value={range[0]} onChange={(e) => setRange([+e.target.value, Math.max(+e.target.value, range[1])])} /><b>{range[0]}</b></label>
            <label>range end <input type="range" min={0} max={RES.content.length + 2} value={range[1]} onChange={(e) => setRange([Math.min(range[0], +e.target.value), +e.target.value])} /><b>{range[1]}</b></label>
          </div>
        )}

        <div className="cond-exchange">
          <div className="cond-req"><div className="cond-side">request</div><pre>{sc.headerLine(range)}</pre></div>
          <div className="cond-arrow">→</div>
          <div className="cond-resp">
            <div className="cond-side">response</div>
            <div className={`cond-status ${statusClass(resp.status)}`}>{resp.status} {resp.reason}</div>
            <pre className="cond-headers">{Object.entries(resp.headers).map(([k, v]) => `${k}: ${v}`).join('\n')}</pre>
          </div>
        </div>

        <div className="cond-bytes">
          {RES.content.split('').map((c, i) => (
            <span key={i} className={`cond-byte ${served && i >= served[0] && i <= served[1] ? 'sent' : ''}`}>{c}</span>
          ))}
        </div>
        <div className="cond-explain">
          <p>{resp.explain}</p>
          <div className="cond-bw"><b>{bodyBytes}</b> body bytes sent {bodyBytes === 0 ? '— a full round-trip saved' : bodyBytes < RES.content.length ? `(of ${RES.content.length})` : '(the whole thing)'}</div>
        </div>

        <p className="cond-foot">
          These three jobs all ride the same validators. Revalidation (304) is what makes a browser refresh cheap — the ETag round-trips, the
          body doesn’t. Range (206) powers resumable downloads and video seeking; <code>If-Range</code> makes resuming safe by re-checking the
          file hasn’t changed under you. And <code>If-Match</code> on a write is the cure for the lost-update problem: two editors who both
          read v7 can’t both blindly save — the second gets 412 and must merge. Strong ETags compare bytes; weak ones (<code>W/</code>) allow
          semantically-equivalent representations.
        </p>
      </section>
    </div>
  );
}
