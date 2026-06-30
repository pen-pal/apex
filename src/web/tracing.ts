// Distributed tracing — following one request as it fans out across services, and seeing where the time
// actually went. Each unit of work is a SPAN with a start, a duration, and a parent; spans sharing a
// trace id form a tree, and laying them out on a timeline gives the familiar WATERFALL. The key derived
// number is a span's SELF TIME: its own duration minus the time its children took — that's the work it
// did itself, and self-times across the whole tree partition the total request latency exactly, so a
// trace tells you precisely which service to optimize. The trace context (trace id + parent span id) is
// propagated across every network hop (W3C traceparent header) so the pieces can be stitched back into
// one tree. Reference: Sigelman et al., "Dapper" (Google 2010); the W3C Trace Context spec; OpenTelemetry.

export interface Span { id: string; parent: string | null; service: string; op: string; start: number; duration: number }
export interface TraceInfo { spans: Span[]; total: number; depth: Record<string, number>; selfTime: Record<string, number>; byService: { service: string; ms: number }[]; root: Span }

export function analyze(spans: Span[]): TraceInfo {
  const children: Record<string, Span[]> = {};
  for (const s of spans) if (s.parent) (children[s.parent] ??= []).push(s);

  const root = spans.find((s) => s.parent === null)!;
  const depth: Record<string, number> = {};
  const setDepth = (s: Span, d: number) => { depth[s.id] = d; for (const c of children[s.id] ?? []) setDepth(c, d + 1); };
  setDepth(root, 0);

  const selfTime: Record<string, number> = {};
  for (const s of spans) selfTime[s.id] = s.duration - (children[s.id] ?? []).reduce((a, c) => a + c.duration, 0);

  const svc: Record<string, number> = {};
  for (const s of spans) svc[s.service] = (svc[s.service] ?? 0) + selfTime[s.id];
  const byService = Object.entries(svc).map(([service, ms]) => ({ service, ms })).sort((a, b) => b.ms - a.ms);

  // ordered for a waterfall: pre-order DFS by start time
  const ordered: Span[] = [];
  const walk = (s: Span) => { ordered.push(s); for (const c of (children[s.id] ?? []).sort((a, b) => a.start - b.start)) walk(c); };
  walk(root);

  return { spans: ordered, total: root.duration, depth, selfTime, byService, root };
}
