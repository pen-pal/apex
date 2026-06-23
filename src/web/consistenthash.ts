// Consistent hashing — how distributed caches and sharded databases spread keys
// across nodes so that adding or removing a node moves as FEW keys as possible.
// Both nodes and keys are hashed onto a ring (0..RING-1); a key belongs to the
// first node clockwise from its position. Add a node and only the keys in the arc
// behind it move; remove one and only its keys move to the next node. Naive
// hash-mod-N, by contrast, remaps almost every key when N changes. Pure, tested.

export const RING = 1 << 16; // 65536 positions on the ring

/** A small, stable string hash (FNV-1a, 32-bit) → position on the ring. */
export function hashRing(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % RING;
}

export interface VNode { pos: number; node: string; vIndex: number }

export class HashRing {
  readonly replicas: number;
  private nodes = new Set<string>();
  private ring: VNode[] = []; // sorted by pos

  constructor(replicas = 1) { this.replicas = Math.max(1, replicas); }

  get nodeList(): string[] { return [...this.nodes].sort(); }
  get points(): VNode[] { return this.ring.slice(); }

  addNode(node: string): void {
    if (this.nodes.has(node)) return;
    this.nodes.add(node);
    for (let v = 0; v < this.replicas; v++) this.ring.push({ pos: hashRing(`${node}#${v}`), node, vIndex: v });
    this.ring.sort((a, b) => a.pos - b.pos || a.node.localeCompare(b.node));
  }

  removeNode(node: string): void {
    if (!this.nodes.delete(node)) return;
    this.ring = this.ring.filter((p) => p.node !== node);
  }

  /** The node that owns `key`: the first vnode clockwise from the key's position. */
  lookup(key: string): string | null {
    if (this.ring.length === 0) return null;
    const h = hashRing(key);
    for (const p of this.ring) if (p.pos >= h) return p.node;
    return this.ring[0].node; // wrap around past the top of the ring
  }

  /** Map every key in `keys` to its owning node. */
  distribution(keys: string[]): Record<string, string> {
    const out: Record<string, string> = {};
    for (const k of keys) out[k] = this.lookup(k) ?? '';
    return out;
  }
}

/** Naive sharding for contrast: node = nodes[ hash(key) mod N ]. */
export function moduloAssign(key: string, nodes: string[]): string {
  if (nodes.length === 0) return '';
  return [...nodes].sort()[hashRing(key) % nodes.length];
}

/** How many keys change owner between two distributions. */
export function movedKeys(before: Record<string, string>, after: Record<string, string>): number {
  let moved = 0;
  for (const k of Object.keys(before)) if (before[k] !== after[k]) moved++;
  return moved;
}
