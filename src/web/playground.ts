// The playground runner. Apex is static and offline, so it runs the one language it can honestly execute in the page —
// JavaScript — inside a sandboxed Web Worker (no DOM, killable, timed out). It captures console output and the last
// expression's value and returns the REAL result; nothing is faked. Go/Python/Rust/C/C++ stay read-only examples
// elsewhere because running them would need a backend or heavy WASM. formatValue is pure and unit-tested; runJs is
// browser-only (Worker/Blob) and verified by running it in the UI.

export interface RunResult { logs: string[]; result?: string; error?: string; ms: number }

// Render a value the way a console would — readable, stable, and cycle-safe.
export function formatValue(v: unknown, seen: WeakSet<object> = new WeakSet()): string {
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  const t = typeof v;
  if (t === 'string') return v as string;
  if (t === 'number' || t === 'boolean' || t === 'bigint') return String(v);
  if (t === 'function') return `[Function${(v as { name?: string }).name ? ': ' + (v as { name: string }).name : ' (anonymous)'}]`;
  if (t === 'symbol') return (v as symbol).toString();
  if (typeof v === 'object') {
    if (seen.has(v as object)) return '[Circular]';
    seen.add(v as object);
    if (Array.isArray(v)) return '[' + v.map((x) => formatValue(x, seen)).join(', ') + ']';
    const o = v as Record<string, unknown>;
    return '{ ' + Object.keys(o).map((k) => `${k}: ${formatValue(o[k], seen)}`).join(', ') + ' }';
  }
  return String(v);
}

// The worker body, as a string. It rebinds console to collect output, evaluates the user's code, and posts back the
// captured logs plus the value of the final expression. formatValue is inlined so the worker is self-contained.
function workerSource(): string {
  return `
const FMT = ${formatValue.toString()};
self.onmessage = (e) => {
  const logs = [];
  // Must return undefined (like real console.*), or the completion value of code ending in console.log() would be the
  // array length instead of undefined.
  const push = (args) => { logs.push(args.map((a) => FMT(a)).join(' ')); };
  self.console = { log: (...a) => push(a), info: (...a) => push(a), warn: (...a) => push(a), error: (...a) => push(a), debug: (...a) => push(a) };
  try {
    const value = (0, eval)(e.data);
    self.postMessage({ logs, result: value === undefined ? undefined : FMT(value) });
  } catch (err) {
    self.postMessage({ logs, error: (err && err.message) ? err.message : String(err) });
  }
};`;
}

// Run JS in a throwaway Worker with a hard timeout. Resolves with the real logs/result/error.
export function runJs(code: string, timeoutMs = 2000): Promise<RunResult> {
  return new Promise((resolve) => {
    const start = performance.now();
    let worker: Worker | null = null;
    let url = '';
    const done = (r: Omit<RunResult, 'ms'>) => {
      clearTimeout(timer);
      if (worker) worker.terminate();
      if (url) URL.revokeObjectURL(url);
      resolve({ ...r, ms: Math.round(performance.now() - start) });
    };
    const timer = setTimeout(() => done({ logs: [], error: `timed out after ${timeoutMs}ms (an infinite loop?)` }), timeoutMs);
    try {
      url = URL.createObjectURL(new Blob([workerSource()], { type: 'text/javascript' }));
      worker = new Worker(url);
      worker.onmessage = (e: MessageEvent<Omit<RunResult, 'ms'>>) => done(e.data);
      worker.onerror = (e) => done({ logs: [], error: e.message || 'worker error' });
      worker.postMessage(code);
    } catch (err) {
      done({ logs: [], error: err instanceof Error ? err.message : String(err) });
    }
  });
}
