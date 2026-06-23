import { describe, it, expect } from 'vitest';
import { buildTree, inclusionProof, verifyProof, leafHash, nodeHash, hashHex } from '../src/web/merkle';

const blocks = ['alice→bob: 5', 'bob→carol: 3', 'carol→dave: 8', 'dave→eve: 1'];

describe('buildTree', () => {
  it('hashes leaves and folds pairwise to a single root', () => {
    const t = buildTree(blocks);
    expect(t.leaves).toHaveLength(4);
    expect(t.levels).toHaveLength(3); // 4 leaves → 2 → 1
    expect(t.levels[2]).toHaveLength(1); // the root level
    // root is the hash of the two intermediate nodes
    const expected = nodeHash(t.levels[1][0], t.levels[1][1]);
    expect(hashHex(t.root)).toBe(hashHex(expected));
  });
  it('is deterministic', () => {
    expect(hashHex(buildTree(blocks).root)).toBe(hashHex(buildTree(blocks).root));
  });
  it('duplicates the last node when a level has an odd count', () => {
    const t = buildTree(['a', 'b', 'c']); // 3 leaves
    // level 1 has 2 nodes: hash(a,b) and hash(c,c)
    expect(t.levels[1]).toHaveLength(2);
    expect(hashHex(t.levels[1][1])).toBe(hashHex(nodeHash(t.leaves[2], t.leaves[2])));
  });
});

describe('inclusion proofs', () => {
  it('a valid proof recomputes the root for every leaf', () => {
    const t = buildTree(blocks);
    for (let i = 0; i < blocks.length; i++) {
      const proof = inclusionProof(t, i);
      expect(proof).toHaveLength(2); // log2(4)
      expect(verifyProof(t.leaves[i], proof, t.root)).toBe(true);
    }
  });
  it('the proof is just sibling hashes with their side', () => {
    const t = buildTree(blocks);
    const proof = inclusionProof(t, 0); // leftmost leaf
    expect(proof[0].position).toBe('right'); // its sibling is on the right
    expect(hashHex(proof[0].hash)).toBe(hashHex(t.leaves[1]));
  });
  it('a wrong leaf fails the proof', () => {
    const t = buildTree(blocks);
    const proof = inclusionProof(t, 2);
    const forged = leafHash('carol→dave: 800'); // tampered amount
    expect(verifyProof(forged, proof, t.root)).toBe(false);
  });
});

describe('tamper sensitivity', () => {
  it('changing ANY leaf changes the root', () => {
    const a = buildTree(blocks);
    const tampered = [...blocks];
    tampered[2] = 'carol→dave: 800';
    const b = buildTree(tampered);
    expect(hashHex(b.root)).not.toBe(hashHex(a.root));
  });
  it('changing one leaf leaves the OTHER subtree’s hashes untouched', () => {
    const a = buildTree(blocks);
    const tampered = [...blocks];
    tampered[3] = 'dave→eve: 100'; // right half changes
    const b = buildTree(tampered);
    // left intermediate node (covers leaves 0,1) is unchanged
    expect(hashHex(b.levels[1][0])).toBe(hashHex(a.levels[1][0]));
    // right intermediate node (covers leaves 2,3) and the root changed
    expect(hashHex(b.levels[1][1])).not.toBe(hashHex(a.levels[1][1]));
    expect(hashHex(b.root)).not.toBe(hashHex(a.root));
  });
});
