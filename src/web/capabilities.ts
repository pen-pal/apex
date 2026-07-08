// Linux capabilities — root's power split into ~40 independent bits, so a process can hold exactly the ones it needs
// and nothing else. This is coarser than seccomp (which filters individual syscalls): a capability is a whole class of
// privileged operation. The model is deliberately simple and exactly matches the kernel's check: an operation is
// permitted iff the process holds the capability it requires (or the operation needs no privilege at all). The point of
// the section is least privilege — a web server needs only CAP_NET_BIND_SERVICE to bind :80; grant it full root and an
// exploit inherits every dangerous power too.

export interface Cap { id: string; label: string; allows: string }
export interface Op { id: string; label: string; cap: string | null; danger: boolean; detail: string }

// A representative slice of the real capability set (there are ~40).
export const CAPS: Cap[] = [
  { id: 'CAP_NET_BIND_SERVICE', label: 'NET_BIND_SERVICE', allows: 'bind to ports below 1024' },
  { id: 'CAP_CHOWN', label: 'CHOWN', allows: 'change any file’s owner' },
  { id: 'CAP_DAC_OVERRIDE', label: 'DAC_OVERRIDE', allows: 'bypass file permission checks' },
  { id: 'CAP_NET_RAW', label: 'NET_RAW', allows: 'open raw/packet sockets' },
  { id: 'CAP_SETUID', label: 'SETUID', allows: 'become any user, including root' },
  { id: 'CAP_KILL', label: 'KILL', allows: 'signal any process' },
  { id: 'CAP_SYS_MODULE', label: 'SYS_MODULE', allows: 'load/unload kernel modules' },
  { id: 'CAP_SYS_ADMIN', label: 'SYS_ADMIN', allows: 'mount, namespaces — the “new root”' },
];

// What the (exploited) web server might try to do. The first two are its legitimate job; the rest are what an attacker
// would attempt after popping a shell in it.
export const OPS: Op[] = [
  { id: 'bind80', label: 'bind port :80', cap: 'CAP_NET_BIND_SERVICE', danger: false, detail: 'the server’s actual job — serve HTTP on the privileged port' },
  { id: 'readcfg', label: 'read its own /app/config', cap: null, danger: false, detail: 'no privilege needed — the file is owned by the app user' },
  { id: 'shadow', label: 'read /etc/shadow', cap: 'CAP_DAC_OVERRIDE', danger: true, detail: 'bypass permissions to steal password hashes' },
  { id: 'chown', label: 'chown a file to root', cap: 'CAP_CHOWN', danger: true, detail: 'plant a root-owned setuid binary' },
  { id: 'sniff', label: 'sniff the network', cap: 'CAP_NET_RAW', danger: true, detail: 'raw sockets to capture or spoof traffic' },
  { id: 'setuid0', label: 'become root (setuid 0)', cap: 'CAP_SETUID', danger: true, detail: 'drop the app user and run as root' },
  { id: 'rootkit', label: 'load a kernel module', cap: 'CAP_SYS_MODULE', danger: true, detail: 'insert a rootkit into the kernel' },
  { id: 'escape', label: 'mount / escape the container', cap: 'CAP_SYS_ADMIN', danger: true, detail: 'the catch-all cap that breaks isolation' },
];

// The kernel's check: allowed iff the op needs no capability, or the process holds the one it needs.
export function permits(held: Set<string>, op: Op): boolean {
  return op.cap === null || held.has(op.cap);
}

// The one capability the app legitimately needs (least privilege = exactly this).
export const NEEDED = 'CAP_NET_BIND_SERVICE';

export interface Verdict { kind: 'least' | 'over' | 'broken' | 'idle'; text: string }

export function assess(held: Set<string>): Verdict {
  if (!held.has(NEEDED)) {
    return { kind: 'broken', text: 'The server can’t bind :80 without CAP_NET_BIND_SERVICE — it won’t even start. Dropping every capability is too far.' };
  }
  const dangerHeld = OPS.filter((o) => o.danger && o.cap && held.has(o.cap));
  if (dangerHeld.length === 0) {
    return { kind: 'least', text: 'Least privilege: the server binds :80 and literally nothing dangerous is possible. Pop a shell in it and the attacker is boxed in — this is why you drop every capability but the one you need.' };
  }
  const worst = dangerHeld[dangerHeld.length - 1];
  return { kind: 'over', text: `Over-privileged: the process holds ${dangerHeld.length} dangerous capabilit${dangerHeld.length === 1 ? 'y' : 'ies'} it never uses. An exploit could ${worst.detail.toLowerCase()}. Full root grants all of them at once.` };
}

export const ALL_CAPS = (): Set<string> => new Set(CAPS.map((c) => c.id));
export const LEAST_PRIVILEGE = (): Set<string> => new Set([NEEDED]);
