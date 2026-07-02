// Guided story #10: how Git stores your code — content-addressed objects, on the GuidedStory engine. Git does not
// store diffs; it stores snapshots, and every object is named by the SHA-1 of its content. Scenes: the snapshot
// idea, blobs (a file → its hash, so identical files dedupe), trees (a directory → name→hash entries), commits (a
// tree + parent + message), the Merkle cascade that makes history tamper-evident, then a live box: edit a file and
// watch its blob hash — and the tree and commit above it — change. The blob hashes are REAL git object ids
// (sha1("blob <len>\0" + content), verified against `git hash-object`).
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';
import { sha1 } from './sha1';
import { enc, hex, concatBytes } from './bytes';

const blobBytes = (content: string): Uint8Array => sha1(enc(`blob ${enc(content).length}\0${content}`));
const short = (h: Uint8Array) => hex(h).slice(0, 8);
// tree: entries "<mode> <name>\0" + 20-byte binary hash, concatenated in name order
const treeBytes = (entries: { name: string; hash: Uint8Array }[]): Uint8Array => {
  const body = concatBytes(...[...entries].sort((a, b) => a.name < b.name ? -1 : 1).map((e) => concatBytes(enc(`100644 ${e.name}\0`), e.hash)));
  return sha1(concatBytes(enc(`tree ${body.length}\0`), body));
};
const AUTHOR = 'Apex <apex@example.com> 1700000000 +0000';
const commitBytes = (treeHex: string, msg: string): Uint8Array => {
  const body = `tree ${treeHex}\nauthor ${AUTHOR}\ncommitter ${AUTHOR}\n\n${msg}\n`;
  return sha1(enc(`commit ${enc(body).length}\0${body}`));
};

type Phase = 'snap' | 'blob' | 'tree' | 'commit' | 'merkle' | 'run';
type Model = { blobs: { name: string; content: string; hash: Uint8Array }[]; tree: Uint8Array; commit: Uint8Array };
const README = '# Apex\n';

export function GitObjectsSection() {
  const [content, setContent] = useState('hello\n');
  const model = (c: string) => {
    const files = [{ name: 'hello.txt', content: c }, { name: 'readme.md', content: README }];
    const blobs = files.map((f) => ({ ...f, hash: blobBytes(f.content) }));
    const tree = treeBytes(blobs.map((b) => ({ name: b.name, hash: b.hash })));
    const commit = commitBytes(hex(tree), 'initial commit');
    return { blobs, tree, commit };
  };
  const live = model(content);

  const narrated = (key: Phase, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <Graph phase={key} m={model('hello\n')} /> });

  const scenes: StoryScene[] = [
    narrated('snap', 'Snapshots, not diffs', 'Git does not store your changes as diffs. Every commit is a full snapshot of your files — and every piece of it is stored in one big key/value store, where the key of an object is the SHA-1 of its own content. Same content, same key, always.'),
    narrated('blob', 'Blobs — a file by its hash', 'Each file’s contents become a blob: git prepends a tiny header and hashes the result. That hash is the file’s address. Two files with identical contents — anywhere, in any commit — get the same hash and are stored exactly once. Dedup falls out for free.'),
    narrated('tree', 'Trees — a directory by its hash', 'A directory becomes a tree object: a list of entries, each a filename pointing to a blob’s hash (or a subtree’s). Hash that list and you get one hash that stands for the entire directory’s state.'),
    narrated('commit', 'Commits — a snapshot by its hash', 'A commit wraps one tree hash with a parent commit, an author, and a message, then hashes all of that. Its hash therefore stands for the whole snapshot plus its history. A branch is just a name pointing at one commit hash.'),
    narrated('merkle', 'Why history can’t be forged', 'These hashes chain, like a Merkle tree. Change one byte in a file and its blob hash changes, so the tree hash changes, so the commit hash changes, so every commit after it changes. You cannot quietly rewrite an old commit — its id, and all descendants, would no longer match.'),
    { key: 'run', title: 'Edit a file, watch the hashes move', caption: 'Edit hello.txt below. Its blob hash is a real git object id — the exact thing `git hash-object` prints. Change one character and watch it, the tree, and the commit all change together.', render: () => <Graph phase="run" m={live} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>Git is not a pile of diffs; it is a content-addressed key/value store, where an object’s name <em>is</em> the SHA-1 hash of its own contents. Save the same file twice — anywhere, in any commit — and it lands at the same address and is stored once. This walks from a single file up to a full commit.</>,
        takeaway: <>A file becomes a blob (named by its hash), a directory becomes a tree of name→hash entries, and a commit wraps one tree hash with a parent and a message — so a commit’s hash stands for an entire snapshot plus all its history. Because every hash is computed from the contents beneath it, changing one byte changes that blob’s hash, which changes its tree, which changes the commit, which changes every commit after it. That cascade is why you can’t quietly rewrite history: the ids would stop matching. And a branch is nothing but a name pointing at one commit hash.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <>
          <span className="git-live-lbl">hello.txt:</span>
          <input className="git-input" value={content} spellCheck={false} onChange={(e) => setContent(e.target.value)} />
          <span className="git-live-note">blob = {hex(live.blobs[0].hash).slice(0, 12)}…</span>
        </>
      )}
    />
  );
}

function Graph({ phase, m }: { phase: Phase; m: Model }) {
  const on = (p: Phase) => phase === p;
  const showBlob = !on('snap');
  const showTree = on('tree') || on('commit') || on('merkle') || on('run');
  const showCommit = on('commit') || on('merkle') || on('run');
  const cascade = on('merkle') || on('run');
  return (
    <svg viewBox="0 0 900 480" className="story-svg">
      {/* commit */}
      {showCommit && <>
        <rect x="330" y="40" width="240" height="76" rx="8" className={`git-obj commit ${cascade ? 'hot' : ''}`} />
        <text x="450" y="62" className="git-obj-lbl" textAnchor="middle">commit {short(m.commit)}</text>
        <text x="450" y="84" className="git-obj-sub" textAnchor="middle">tree {short(m.tree)}</text>
        <text x="450" y="102" className="git-obj-sub" textAnchor="middle">"initial commit"</text>
        <line x1="450" y1="116" x2="450" y2="150" className="git-edge" />
      </>}
      {/* tree */}
      {showTree && <>
        <rect x="330" y="150" width="240" height="90" rx="8" className={`git-obj tree ${cascade ? 'hot' : ''}`} />
        <text x="450" y="172" className="git-obj-lbl" textAnchor="middle">tree {short(m.tree)}</text>
        {m.blobs.map((bl, i) => <text key={i} x="350" y={196 + i * 20} className="git-tree-entry">{bl.name} → {short(bl.hash)}</text>)}
        <line x1="400" y1="240" x2="250" y2="300" className="git-edge" />
        <line x1="500" y1="240" x2="650" y2="300" className="git-edge" />
      </>}
      {/* blobs */}
      {showBlob && m.blobs.map((bl, i) => {
        const editing = on('run') && i === 0;
        return (
          <g key={i}>
            <rect x={i === 0 ? 130 : 570} y="300" width="200" height="86" rx="8" className={`git-obj blob ${editing ? 'hot' : ''}`} />
            <text x={i === 0 ? 230 : 670} y="322" className="git-obj-lbl" textAnchor="middle">blob {short(bl.hash)}</text>
            <text x={i === 0 ? 230 : 670} y="344" className="git-obj-sub" textAnchor="middle">{bl.name}</text>
            <text x={i === 0 ? 230 : 670} y="368" className="git-blob-content" textAnchor="middle">{JSON.stringify(bl.content).slice(0, 22)}</text>
          </g>
        );
      })}

      {on('snap') && <>
        <text x="450" y="200" className="git-mid" textAnchor="middle">object key = SHA-1( its own content )</text>
        <text x="450" y="238" className="git-mid dim" textAnchor="middle">a content-addressed store: the same bytes always land at the same address</text>
      </>}
      <text x="450" y="452" className="git-foot" textAnchor="middle">
        {on('snap') ? 'content addressing: identical content is identical everywhere, stored once'
          : on('blob') ? 'blob hash = sha1("blob " + length + NUL + contents) — a real git object id'
          : on('tree') ? 'a tree hash is the fingerprint of an entire directory listing'
          : on('commit') ? 'a commit hash is the fingerprint of the whole snapshot and its history'
          : on('merkle') ? 'one changed byte cascades up: blob → tree → commit → every child'
          : 'edit above — the blob is what `git hash-object` would print for those bytes'}
      </text>
    </svg>
  );
}
