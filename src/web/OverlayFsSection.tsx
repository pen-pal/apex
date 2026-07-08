// OverlayFS — see a container image as stacked layers, and watch copy-up happen. The merged view is what the process
// sees as "/"; the layer stack below shows where each file really lives. Edit a file from a read-only image layer and
// it copies up into the writable layer (the image stays pristine); delete one and a whiteout hides it. Model + tests
// in overlayfs.ts.
import { useMemo, useState } from 'react';
import { read, merged, write, remove, type Stack, type Layer } from './overlayfs';

const mk = (name: string, readOnly: boolean, files: Record<string, { content: string } | { whiteout: true }>): Layer => ({ name, readOnly, files });
const INITIAL = (): Stack => [
  mk('base image (alpine)', true, { '/etc/os-release': { content: 'alpine 3.20' }, '/bin/sh': { content: 'busybox' }, '/app/config': { content: 'listen=80' } }),
  mk('app layer', true, { '/app/config': { content: 'listen=443' }, '/app/server': { content: '<binary>' } }),
  mk('container (writable)', false, {}),
];
// bottom→top in the model; display top→bottom (writable on top), matching how overlays are drawn.
const LAYER_CLASS = ['ovl-base', 'ovl-app', 'ovl-upper'];

export function OverlayFsSection() {
  const [stack, setStack] = useState<Stack>(INITIAL);
  const [note, setNote] = useState('The container sees one filesystem. Edit or delete a file and watch where the change actually lands.');
  const [flash, setFlash] = useState<string | null>(null);

  const view = useMemo(() => merged(stack), [stack]);
  const paths = useMemo(() => Object.keys(view).sort(), [view]);

  const doEdit = (path: string) => {
    const from = read(stack, path)!.layer;
    const { stack: s, copiedUp } = write(stack, path, `${view[path]} (edited)`);
    setStack(s); setFlash(path);
    setNote(copiedUp
      ? `Copy-up: “${path}” lived in a read-only layer (${stack[from].name}), so the kernel copied it into the writable layer before your write. The image layer is untouched — that copy is yours alone.`
      : `Wrote “${path}” straight into the writable layer (it was already there).`);
  };
  const doDelete = (path: string) => {
    const { stack: s, whiteout } = remove(stack, path);
    setStack(s); setFlash(null);
    setNote(whiteout
      ? `Whiteout: “${path}” exists in a read-only layer, so it can’t be erased there — a whiteout marker in the writable layer hides it from the merged view. The file is still in the image.`
      : `Removed “${path}” from the writable layer (it only lived there).`);
  };
  const reset = () => { setStack(INITIAL()); setFlash(null); setNote('Reset. Edit or delete a file and watch where the change lands.'); };

  const layerOf = (p: string) => read(stack, p)!.layer;

  return (
    <div className="ovl">
      <div className="ovl-cols">
        <div className="ovl-merged">
          <div className="ovl-lbl">merged view — what the container sees at <code>/</code></div>
          {paths.map((p) => {
            const li = layerOf(p);
            return (
              <div key={p} className={`ovl-file ${flash === p ? 'ovl-flash' : ''}`}>
                <code className="ovl-path">{p}</code>
                <span className={`ovl-src ${LAYER_CLASS[li]}`}>{stack[li].name.split(' ')[0]}</span>
                <span className="ovl-acts">
                  <button type="button" onClick={() => doEdit(p)}>edit</button>
                  <button type="button" onClick={() => doDelete(p)}>rm</button>
                </span>
              </div>
            );
          })}
          {paths.length === 0 && <div className="ovl-empty">(everything deleted)</div>}
        </div>

        <div className="ovl-stack">
          <div className="ovl-lbl">the real layers (top wins)</div>
          {[...stack].map((_, i) => stack.length - 1 - i).map((li) => {
            const l = stack[li];
            const entries = Object.entries(l.files);
            return (
              <div key={li} className={`ovl-layer ${LAYER_CLASS[li]} ${l.readOnly ? 'ovl-ro' : 'ovl-rw'}`}>
                <div className="ovl-layer-h"><code>{l.name}</code><span>{l.readOnly ? '🔒 read-only' : '✎ writable'}</span></div>
                <div className="ovl-layer-files">
                  {entries.length === 0 && <span className="ovl-nil">∅ empty</span>}
                  {entries.map(([p, e]) => (
                    <code key={p} className={`ovl-entry ${'whiteout' in e ? 'ovl-wh' : ''} ${flash === p && !l.readOnly ? 'ovl-flash' : ''}`}>
                      {'whiteout' in e ? `⊘ ${p}` : p}
                    </code>
                  ))}
                </div>
              </div>
            );
          })}
          <button type="button" className="ovl-reset" onClick={reset}>↺ reset</button>
        </div>
      </div>

      <div className="ovl-note">{note}</div>

      <p className="ovl-foot">
        This is how a container image <em>is</em> a filesystem: a stack of read-only image layers (each a Docker build
        step) plus one writable layer per container. The kernel unions them into <code>merged/</code> — the topmost
        layer with a path wins — so <strong>a hundred containers share one image on disk</strong> and only their tiny
        diffs differ. <strong>Copy-up</strong> is the whole trick: reads come straight from the image, but the first
        write to an image file copies it into the writable layer, so the shared layers stay pristine (and a big-file
        write is briefly slow while it copies). Deletes can’t touch a read-only layer, so a <strong>whiteout</strong>
        entry in the upper layer hides the lower file. Real overlayfs names these <code>lowerdir</code> (the image
        layers, colon-joined), <code>upperdir</code> (the diff), <code>workdir</code> (scratch for atomic copy-ups),
        and <code>merged</code> (the mount). (Linux overlayfs.)
      </p>
    </div>
  );
}
