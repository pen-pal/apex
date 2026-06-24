// Hash chain — the tamper-evidence trick at the heart of blockchains, Git, certificate-
// transparency logs, and append-only audit logs. Each block stores the HASH OF THE PREVIOUS
// block alongside its own data, and its own hash is computed over (data ‖ prevHash). That one
// link makes the chain immutable in practice: change any block's data and its hash changes,
// which breaks the prevHash stored in the NEXT block, whose hash then changes too — the
// damage cascades all the way to the tip. So a single stored "tip" hash certifies the entire
// history. (A blockchain adds proof-of-work so rewriting also costs compute; here we show the
// linking itself.) Real SHA-256; tested.
import { sha256, hex } from './sha256';

export interface Block { index: number; data: string; prevHash: string; hash: string }

const GENESIS_PREV = '0'.repeat(64);

/** A block's hash is SHA-256 over index ‖ data ‖ prevHash. */
export function blockHash(index: number, data: string, prevHash: string): string {
  return hex(sha256(new TextEncoder().encode(`${index}|${data}|${prevHash}`)));
}

/** Build a chain where each block links to the previous one's hash. */
export function buildChain(items: string[]): Block[] {
  const chain: Block[] = [];
  let prevHash = GENESIS_PREV;
  items.forEach((data, index) => {
    const hash = blockHash(index, data, prevHash);
    chain.push({ index, data, prevHash, hash });
    prevHash = hash;
  });
  return chain;
}

export interface Check { index: number; recomputed: string; valid: boolean }

/** Re-derive every block's hash live, chaining from genesis through CURRENT data, and compare
 *  to the committed hash. Tampering one block's data changes its live hash, which feeds the
 *  next block's link — so the mismatch CASCADES from the tampered block to the tip. */
export function verify(chain: Block[]): { checks: Check[]; valid: boolean; firstBroken: number | null } {
  let prevLive = GENESIS_PREV;
  const checks: Check[] = chain.map((b) => {
    const recomputed = blockHash(b.index, b.data, prevLive); // uses the LIVE previous hash
    prevLive = recomputed;
    return { index: b.index, recomputed, valid: recomputed === b.hash };
  });
  const firstBroken = checks.findIndex((c) => !c.valid);
  return { checks, valid: firstBroken === -1, firstBroken: firstBroken === -1 ? null : firstBroken };
}

/** Edit one block's data, leaving its committed hash stale — exactly what verify() catches,
 *  with the break rippling from this block to the tip. */
export function tamper(chain: Block[], index: number, newData: string): Block[] {
  return chain.map((b, i) => (i === index ? { ...b, data: newData } : b));
}

export { GENESIS_PREV };
