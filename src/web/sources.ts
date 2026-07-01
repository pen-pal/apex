/// <reference types="vite/client" />
// "View source" plumbing — expose each section's real, tested model file as readable code. Vite's import.meta.glob
// lazily bundles every model source as a raw string in its own chunk, so nothing is downloaded until a visitor
// actually opens the code panel. A section whose id matches its model filename (id "dram" → dram.ts) gets its
// source automatically; a few ids whose model lives under a different name are mapped explicitly below.
const loaders = import.meta.glob('./*.ts', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>;

// section id → model filename, only where they differ from `${id}.ts`. Each verified against the section's actual
// component's single primary model import (block-scoped), so the panel always shows THIS section's real model.
const ALIAS: Record<string, string> = {
  lb: 'loadbalance', simanneal: 'simulanneal',
  aead: 'aesgcm', aesround: 'aes', ecbpenguin: 'aes', cdn: 'cachehierarchy', certs: 'certchain',
  chash: 'consistenthash', congestion: 'tcpcc', crc32: 'crc32walk', cycledetect: 'floydcycle',
  deployments: 'deploystrat', dhkex: 'dh', distvec: 'dv', dns: 'dnsjourney', editdist: 'editdistance',
  errors: 'errordetect', falseshare: 'falsesharing', flow: 'slidingwindow', gracefulshutdown: 'shutdown',
  grpc: 'grpcmsg', h2flow: 'flowctl', hashbreak: 'sha1', hashint: 'sha256', http3: 'qpack', iouring: 'ioring',
  linecode: 'linecoding', natpunch: 'nattraversal', ospf: 'linkstate', phiaccrual: 'phi', pqc: 'lwe',
  queueing: 'queue', quorum: 'quorumrw', ratelimit: 'tokenbucket', routing: 'dijkstra', segrouting: 'segroute',
  shuffle: 'fisheryates', stptree: 'stp', subdomain: 'subdomaintakeover', sws: 'swsyndrome', tcphand: 'tcphandshake',
  threshsig: 'threshold', tlsdowngrade: 'tlsneg', vclock: 'vectorclock', vlan: 'vlanlab', vxlan: 'overlay',
  websocket: 'websocketws',
};

function fileFor(id: string): string {
  const base = ALIAS[id] ?? id;
  return `./${base}.ts`;
}

/** Does this section have a viewable model source? */
export const hasSource = (id: string): boolean => fileFor(id) in loaders;

/** Lazily load a section's model source (or null if none is mapped). */
export const loadSource = (id: string): Promise<string> | null => loaders[fileFor(id)]?.() ?? null;

/** The model filename shown to the user, e.g. "dram.ts". */
export const sourceName = (id: string): string => fileFor(id).replace('./', '');
