// Guided story #11: how a container isolates a process — namespaces + cgroups, on the GuidedStory engine. A
// container is not a virtual machine: there is no guest OS. It is one ordinary process on the host kernel, given a
// private view of the system (namespaces) and a cap on resources (cgroups). Scenes: not-a-VM, namespaces, the image
// as root, cgroups, all together, then a live box — toggle the PID namespace and set a memory limit and watch what
// the process can see and use. Real Linux mechanism (PID/net/mount namespaces, memory cgroup, shared kernel).
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

type Phase = 'vm' | 'ns' | 'image' | 'cgroup' | 'together' | 'run';
const HOST_PIDS = ['100 sshd', '101 systemd', '102 nginx', '512 your-app'];

export function ContainerSection() {
  const [pidNs, setPidNs] = useState(true);
  const [limit, setLimit] = useState(256); // MB
  const NEED = 300; // the app wants ~300 MB
  const oom = limit < NEED;

  const narrated = (key: Phase, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: (a) => <Box phase={key} pidNs active={a} limit={512} oom={false} /> });

  const scenes: StoryScene[] = [
    narrated('vm', 'Not a virtual machine', 'A container feels like its own little computer, but there is no second operating system inside it. It is one ordinary process running on the host’s kernel — the same kernel as everything else. Two kernel features just make it think it is alone.'),
    narrated('ns', 'Namespaces — a private view', 'A namespace gives the process its own copy of some global resource. In a PID namespace it sees itself as PID 1 and cannot see host processes. A network namespace gives it its own interfaces and IP. A mount namespace gives it its own filesystem tree. Same kernel, different windows onto it.'),
    narrated('image', 'The image is its root', 'The mount namespace points the process’s / at the container image — a stack of read-only layers plus a thin writable one on top. So ls / shows the image’s files, not the host’s. It is chroot taken seriously.'),
    narrated('cgroup', 'cgroups — a resource cap', 'Namespaces control what it can see; control groups (cgroups) control what it can use. A cgroup caps the process’s CPU share, memory, and I/O, so one container cannot starve the others. Go over the memory cap and the kernel’s OOM killer stops it.'),
    narrated('together', 'That is the whole trick', 'Namespaces (what it sees) + cgroups (what it uses) + an image (its files) = a container. One shared kernel, many isolated processes. No guest OS to boot is exactly why a container starts in milliseconds where a VM takes seconds.'),
    { key: 'run', title: 'Toggle isolation yourself', caption: 'Turn the PID namespace off and the process suddenly sees every host process — isolation is a choice the kernel makes, not a wall. Set the memory limit below what the app needs (~300 MB) and the cgroup OOM-kills it.', render: (a) => <Box phase="run" pidNs={pidNs} active={a} limit={limit} oom={oom} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <>
          <label className="ctr-toggle"><input type="checkbox" checked={pidNs} onChange={(e) => setPidNs(e.target.checked)} /> PID namespace</label>
          <label className="ctr-lim">mem limit: {limit} MB<input type="range" min={64} max={512} step={64} value={limit} onChange={(e) => setLimit(Number(e.target.value))} /></label>
          <span className={`ctr-live ${oom ? 'bad' : ''}`}>{oom ? `✗ OOM-killed (needs ~${NEED} MB)` : 'running'}</span>
        </>
      )}
    />
  );
}

function Box({ phase, pidNs, active, limit, oom }: { phase: Phase; pidNs: boolean; active: boolean; limit: number; oom: boolean }) {
  const on = (p: Phase) => phase === p;
  const showNs = !on('vm');
  const showImage = on('image') || on('together') || on('run');
  const showCg = on('cgroup') || on('together') || on('run');
  return (
    <svg viewBox="0 0 900 480" className="story-svg">
      {/* shared kernel */}
      <rect x="40" y="380" width="820" height="60" rx="8" className="ctr-kernel" />
      <text x="450" y="416" className="ctr-kernel-lbl" textAnchor="middle">one shared Linux kernel</text>

      {/* host processes (left) */}
      <text x="60" y="60" className="ctr-host-lbl">host processes</text>
      {HOST_PIDS.map((t, i) => <text key={i} x="60" y={90 + i * 26} className="ctr-hpid">{t}</text>)}

      {/* the container box (right) */}
      <rect x="440" y="70" width="400" height="290" rx="12" className={`ctr-box ${oom ? 'oom' : ''}`} />
      <text x="640" y="96" className="ctr-box-lbl" textAnchor="middle">{on('vm') ? 'just a process' : 'container = process + namespaces + cgroup'}</text>

      {/* the process */}
      <rect x="590" y="120" width="180" height="52" rx="6" className="ctr-proc" />
      <text x="680" y="142" className="ctr-proc-lbl" textAnchor="middle">your app</text>
      <text x="680" y="162" className="ctr-proc-sub" textAnchor="middle">{showNs && pidNs ? 'sees itself as PID 1' : 'PID 512 on the host'}</text>
      <line x1="640" y1="360" x2="500" y2="380" className="ctr-edge" />

      {/* namespaces */}
      {showNs && <>
        <text x="470" y="200" className="ctr-ns-lbl">namespaces (its view):</text>
        {[`PID ns → ${pidNs ? 'PID 1, host hidden' : 'OFF — host PIDs visible!'}`, 'net ns → 172.17.0.2, own eth0', showImage ? 'mount ns → / = image' : 'mount ns → own /'].map((t, i) => (
          <text key={i} x="480" y={224 + i * 24} className={`ctr-ns ${i === 0 && showNs && !pidNs ? 'bad' : ''}`}>• {t}</text>
        ))}
      </>}

      {/* PID-ns off: host processes leak into the container view */}
      {on('run') && !pidNs && active && <line className="ctr-leak" x1="200" y1="150" x2="590" y2="150" pathLength={100} />}

      {/* cgroup meter */}
      {showCg && <>
        <text x="470" y="312" className="ctr-cg-lbl">cgroup: memory {on('run') ? `${limit}` : '512'} MB</text>
        <rect x="480" y="322" width="300" height="20" rx="4" className="ctr-meter" />
        <rect x="480" y="322" width={3 * Math.min(100, (300 / (on('run') ? limit : 512)) * 100)} height="20" rx="4" className={`ctr-meter-fill ${oom ? 'over' : ''}`} />
        <text x="790" y="337" className="ctr-cg-val">{oom ? 'OOM' : 'app ~300 MB'}</text>
      </>}

      <text x="450" y="466" className="ctr-foot" textAnchor="middle">
        {on('vm') ? 'no guest OS — the container shares the host kernel'
          : on('ns') ? 'namespaces virtualize what a process can SEE'
          : on('image') ? 'the image layers become the container’s root filesystem'
          : on('cgroup') ? 'cgroups cap what a process can USE — CPU, memory, I/O'
          : on('together') ? 'see (namespaces) + use (cgroups) + files (image) = a container'
          : (pidNs ? 'isolated: sees only itself' : 'PID namespace off — it can see every host process')}
      </text>
    </svg>
  );
}
