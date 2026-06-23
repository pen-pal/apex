// Merkle tree (hash tree) — how you commit to a whole dataset with ONE hash and
// then prove any single item belongs, in log(n) hashes. Each leaf is the SHA-256 of
// a data block; every parent is the SHA-256 of its two children concatenated; the
// single top hash is the ROOT. An inclusion proof for a leaf is just the sibling
// hashes along its path: recompute upward with them and you must land on the root.
// Change any leaf and only its path (and the root) change — everything else is
// untouched. Real SHA-256 (src/web/sha256.ts). Used in git, blockchains, Cassandra
// anti-entropy, Certificate Transparency. Pure, tested.
import { sha256, hex, concatBytes } from './sha256';

const enc = (s: string) => new TextEncoder().encode(s);

/** Hash one leaf's data → 32-byte digest. */
export function leafHash(data: string): Uint8Array {
  return sha256(enc(data));
}

/** Hash two child digests into their parent: SHA-256(left ‖ right). */
export function nodeHash(left: Uint8Array, right: Uint8Array): Uint8Array {
  return sha256(concatBytes(left, right));
}

export interface MerkleTree {
  leaves: Uint8Array[]; // leaf hashes (bottom level)
  levels: Uint8Array[][]; // levels[0] = leaves … levels[top] = [root]
  root: Uint8Array;
}

/** Build a Merkle tree from leaf data blocks (last node duplicated on odd levels). */
export function buildTree(blocks: string[]): MerkleTree {
  const leaves = blocks.map(leafHash);
  if (leaves.length === 0) return { leaves, levels: [[]], root: new Uint8Array(32) };
  const levels: Uint8Array[][] = [leaves];
  let level = leaves;
  while (level.length > 1) {
    const next: Uint8Array[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : level[i]; // duplicate the last when odd
      next.push(nodeHash(left, right));
    }
    levels.push(next);
    level = next;
  }
  return { leaves, levels, root: level[0] };
}

export interface ProofStep { hash: Uint8Array; position: 'left' | 'right' } // sibling and which side it sits on

/** The inclusion proof for leaf `index`: the sibling hash at each level up to the root. */
export function inclusionProof(tree: MerkleTree, index: number): ProofStep[] {
  const proof: ProofStep[] = [];
  let idx = index;
  for (let l = 0; l < tree.levels.length - 1; l++) {
    const level = tree.levels[l];
    const isRight = idx % 2 === 1;
    const siblingIdx = isRight ? idx - 1 : idx + 1;
    const sibling = siblingIdx < level.length ? level[siblingIdx] : level[idx]; // duplicated last node
    proof.push({ hash: sibling, position: isRight ? 'left' : 'right' });
    idx = Math.floor(idx / 2);
  }
  return proof;
}

/** Verify a proof: fold the leaf hash with each sibling and check it reaches the root. */
export function verifyProof(leaf: Uint8Array, proof: ProofStep[], root: Uint8Array): boolean {
  let acc = leaf;
  for (const step of proof) {
    acc = step.position === 'left' ? nodeHash(step.hash, acc) : nodeHash(acc, step.hash);
  }
  return hex(acc) === hex(root);
}

/** Indices of the nodes on a leaf's path to the root (level → node index), for highlighting. */
export function pathIndices(tree: MerkleTree, index: number): number[] {
  const path: number[] = [];
  let idx = index;
  for (let l = 0; l < tree.levels.length; l++) { path.push(idx); idx = Math.floor(idx / 2); }
  return path;
}

export { hex as hashHex };
