// OverlayFS — how a container image is a filesystem. An image is a stack of read-only LOWER layers; a running
// container adds one writable UPPER layer on top. The kernel unions them into a single MERGED view the process sees
// as "/": for any path, the TOPMOST layer that has it wins. The trick is COPY-UP — reading a file serves it from
// whichever lower layer holds it, but WRITING copies it up into the upper layer first, so the shared image layers
// stay pristine (which is why 100 containers share one image yet each has its own diff). Deleting a lower file writes
// a WHITEOUT in the upper layer to hide it. Modelled: union resolution, copy-up, and whiteout.

export type Entry = { content: string } | { whiteout: true };
export type Layer = { name: string; readOnly: boolean; files: Record<string, Entry> };
export type Stack = Layer[]; // bottom (index 0) → top; the last, writable layer is the container's "upper"

const isWhiteout = (e: Entry | undefined): e is { whiteout: true } => !!e && 'whiteout' in e;

// The topmost layer that mentions `path` (whether a file or a whiteout), scanning upper→lower. null if no layer has it.
export function resolve(stack: Stack, path: string): { index: number; entry: Entry } | null {
  for (let i = stack.length - 1; i >= 0; i--) {
    const e = stack[i].files[path];
    if (e) return { index: i, entry: e };
  }
  return null;
}

// Read through the union: the content from the winning layer, or null if the path doesn't exist or is whited out.
export function read(stack: Stack, path: string): { content: string; layer: number } | null {
  const r = resolve(stack, path);
  if (!r || isWhiteout(r.entry)) return null;
  return { content: r.entry.content, layer: r.index };
}

// Every visible path in the merged view → its winning content (whiteouts and shadowed lower copies excluded).
export function merged(stack: Stack): Record<string, string> {
  const out: Record<string, string> = {};
  const paths = new Set<string>();
  for (const l of stack) for (const p of Object.keys(l.files)) paths.add(p);
  for (const p of paths) { const r = read(stack, p); if (r) out[p] = r.content; }
  return out;
}

const withUpper = (stack: Stack, files: Record<string, Entry>): Stack =>
  stack.map((l, i) => (i === stack.length - 1 ? { ...l, files } : l)); // replace only the upper; lowers keep identity

// Write a path: copy-up. The new content lands in the UPPER layer; lower layers are never touched. `copiedUp` is true
// when the path already existed in a lower layer (so this write shadowed it) rather than being brand new.
export function write(stack: Stack, path: string, content: string): { stack: Stack; copiedUp: boolean } {
  const upper = stack[stack.length - 1];
  const existedBelow = stack.slice(0, -1).some((l) => l.files[path] && !isWhiteout(l.files[path]));
  const copiedUp = existedBelow && !(path in upper.files);
  return { stack: withUpper(stack, { ...upper.files, [path]: { content } }), copiedUp };
}

// Delete a path from the merged view. If it exists in a lower layer we can't remove it there (read-only), so we write
// a WHITEOUT in the upper layer to hide it; if it only lived in the upper, we just drop it.
export function remove(stack: Stack, path: string): { stack: Stack; whiteout: boolean } {
  const upper = stack[stack.length - 1];
  const inLower = stack.slice(0, -1).some((l) => l.files[path] && !isWhiteout(l.files[path]));
  const files = { ...upper.files };
  if (inLower) { files[path] = { whiteout: true }; return { stack: withUpper(stack, files), whiteout: true }; }
  delete files[path];
  return { stack: withUpper(stack, files), whiteout: false };
}
