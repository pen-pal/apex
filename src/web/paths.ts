// Guided journeys — curated, ordered walks through existing sections that tell ONE story end to end.
// At 170+ sections the flat catalog answers "what is there?" but not "where do I start?"; a journey
// answers the second. A path is pure data: an ordered list of section ids, each with a one-line note
// on what to watch for. The engine derives the learner's position from the active section (no extra
// state), so the same section can live in several journeys. Every step id must be a real section —
// enforced by tests/paths.test.ts, the same taxonomy-guard discipline as the nav groups.

export interface PathStep { id: string; note: string }
export interface LearningPath { id: string; title: string; icon: string; blurb: string; steps: PathStep[] }

export const PATHS: LearningPath[] = [
  {
    id: 'https',
    title: 'How an HTTPS page loads',
    icon: '🌐',
    blurb: 'Follow one browser request from a typed name to an encrypted, multiplexed response — the flagship end-to-end story.',
    steps: [
      { id: 'dns', note: 'Turn the name into an IP — the recursive resolver walks root → TLD → authoritative.' },
      { id: 'arp', note: 'Off-subnet traffic still needs the gateway’s MAC — ARP shouts to find it on the LAN.' },
      { id: 'tcphand', note: 'A TCP 3-way handshake (SYN / SYN-ACK / ACK) opens the connection before any data.' },
      { id: 'certs', note: 'The server proves who it is with a certificate chain back to a trusted root.' },
      { id: 'dhkex', note: 'Both sides derive a shared secret over the public channel — the key is never sent.' },
      { id: 'aead', note: 'From here every record is encrypted AND authenticated; an eavesdropper sees only ciphertext.' },
      { id: 'http2', note: 'The actual GET — multiplexed as HTTP/2 streams over the one encrypted connection.' },
      { id: 'cdn', note: 'The response is often served from a nearby CDN edge, not the distant origin.' },
    ],
  },
  {
    id: 'packet',
    title: 'A packet’s journey across the internet',
    icon: '📦',
    blurb: 'One datagram, hop by hop: from "is this even local?" through NAT, TTL, and BGP to longest-prefix match at every router.',
    steps: [
      { id: 'subnet', note: 'First question: is the destination on my subnet, or does it go to the gateway?' },
      { id: 'arp', note: 'Off-subnet → resolve the gateway’s MAC with ARP to build the L2 frame.' },
      { id: 'switch', note: 'The LAN switch forwards by MAC address, learning which port each host is on.' },
      { id: 'nat', note: 'At the edge, NAT rewrites your private source IP to a public one.' },
      { id: 'ttlhop', note: 'Every router decrements TTL and recomputes the IPv4 header checksum.' },
      { id: 'traceroute', note: 'Traceroute weaponizes TTL expiry to reveal each hop along the path.' },
      { id: 'bgp', note: 'Between networks, BGP chooses the AS-path the packet will follow.' },
      { id: 'routing', note: 'At each hop, longest-prefix match picks the outgoing interface.' },
    ],
  },
  {
    id: 'crypto',
    title: 'Cryptography from scratch',
    icon: '🔒',
    blurb: 'Build trust from nothing: perfect secrecy → why classical fails → AES → modes → AEAD → key exchange → public keys → signatures.',
    steps: [
      { id: 'otpad', note: 'Start with provable perfect secrecy — the one-time pad — and its unforgiving key rule.' },
      { id: 'classical', note: 'Classical ciphers fall to frequency analysis; secrecy can’t live in a secret algorithm.' },
      { id: 'aesround', note: 'AES: watch SubBytes / ShiftRows / MixColumns / AddRoundKey diffuse one byte across the block.' },
      { id: 'ecbpenguin', note: 'A block cipher needs a mode — ECB leaks structure, and the penguin is still visible.' },
      { id: 'aead', note: 'AEAD (GCM / ChaCha-Poly) gives confidentiality AND integrity in a single pass.' },
      { id: 'dhkex', note: 'Diffie–Hellman lets two strangers agree on a key over a fully public wire.' },
      { id: 'rsa', note: 'Public-key crypto: encrypt with the public key, decrypt with the private one.' },
      { id: 'ecdsa', note: 'Sign with elliptic curves — and watch how one reused nonce leaks the private key.' },
    ],
  },
  {
    id: 'tcp',
    title: 'How TCP delivers a reliable stream',
    icon: '🚀',
    blurb: 'A lossy, reordering network underneath — yet an ordered, reliable byte stream on top. See every mechanism that makes that true.',
    steps: [
      { id: 'tcphand', note: 'SYN / SYN-ACK / ACK — both sides agree on their starting sequence numbers.' },
      { id: 'flow', note: 'The receive window stops a fast sender from overrunning a slow receiver.' },
      { id: 'arq', note: 'Lost a segment? ARQ retransmits — go-back-N versus selective repeat.' },
      { id: 'rto', note: 'The retransmission timer adapts to RTT; Karn’s rule avoids ambiguous samples.' },
      { id: 'congestion', note: 'Congestion control probes the network: slow-start, then additive-increase / multiplicative-decrease.' },
      { id: 'cubic', note: 'CUBIC grows the window along a cubic curve to fill fat, fast links quickly.' },
      { id: 'bbr', note: 'BBR models bottleneck bandwidth and RTT instead of treating loss as the only signal.' },
      { id: 'sack', note: 'Selective ACK tells the sender exactly which segments already arrived.' },
    ],
  },
  {
    id: 'database',
    title: 'Build a database',
    icon: '🗄️',
    blurb: 'From a single index on disk to a durable, isolated, replicated, distributed store — the layers a real database is made of.',
    steps: [
      { id: 'btree', note: 'The B+tree index: how a database finds a row in a handful of disk seeks.' },
      { id: 'wal', note: 'Write-ahead logging makes a crash recoverable — log the change first, then apply it.' },
      { id: 'mvcc', note: 'MVCC gives each transaction a consistent snapshot without blocking readers.' },
      { id: 'locking', note: 'Where snapshots aren’t enough, locks serialize access — and can deadlock.' },
      { id: 'lsm', note: 'LSM-trees flip the design for write-heavy loads: append to memory, then compact.' },
      { id: 'replication', note: 'Ship the WAL to replicas so a copy of the data survives a node loss.' },
      { id: 'quorum', note: 'Read/write quorums (R + W > N) keep replicas consistent under failure.' },
      { id: 'twopc', note: 'Two-phase commit makes one transaction atomic across several machines.' },
    ],
  },
  {
    id: 'distributed',
    title: 'Distributed systems foundations',
    icon: '🕸️',
    blurb: 'No global clock, no shared memory, nodes that fail — yet the cluster must agree. Walk from ordering time to reaching consensus.',
    steps: [
      { id: 'lamport', note: 'With no global clock, Lamport timestamps give a consistent "happened-before" order.' },
      { id: 'vclock', note: 'Vector clocks go further — they detect when two events are genuinely concurrent.' },
      { id: 'quorum', note: 'Quorums (R + W > N) let a replicated store stay consistent without a single leader.' },
      { id: 'raft', note: 'Raft elects one leader so a replicated log becomes easy to reason about.' },
      { id: 'raftlog', note: 'The leader replicates its log; an entry commits once a majority have stored it.' },
      { id: 'paxos', note: 'Paxos is the classic consensus core that Raft repackages to be teachable.' },
      { id: 'crdt', note: 'CRDTs let replicas edit independently and always merge without conflict.' },
      { id: 'cap', note: 'Under a network partition you must choose: stay consistent, or stay available.' },
    ],
  },
  {
    id: 'websec',
    title: 'How the browser defends you',
    icon: '🛡️',
    blurb: 'The web is hostile by default. See the layered defenses — origins, cookies, CSP, isolation, passkeys — and the attacks they stop.',
    steps: [
      { id: 'cors', note: 'The same-origin policy walls sites off; CORS opens precise, opt-in holes.' },
      { id: 'cookies', note: 'Cookies carry the session — and SameSite / HttpOnly decide who can use them.' },
      { id: 'csp', note: 'Content-Security-Policy whitelists what may run, blunting injected scripts.' },
      { id: 'webinject', note: 'Watch SQLi and XSS land — then the escaping and parameterization that stop them.' },
      { id: 'siteisolation', note: 'Site isolation puts each origin in its own process against Spectre-class leaks.' },
      { id: 'webauthn', note: 'Passkeys replace passwords with an origin-bound key a phisher can’t relay.' },
    ],
  },
  {
    id: 'cpu',
    title: 'Inside the CPU',
    icon: '🖥️',
    blurb: 'How a chip actually runs your code: instructions flowing through a pipeline, guessing branches, juggling caches and memory, up to the OS scheduler.',
    steps: [
      { id: 'pipeline', note: 'Instructions overlap in a 5-stage pipeline — and stall when one depends on another.' },
      { id: 'branchpredict', note: 'A branch’s direction is guessed before it’s known; a 2-bit counter keeps the pipeline full.' },
      { id: 'mesi', note: 'Each core caches memory privately; MESI keeps those copies coherent over a snooping bus.' },
      { id: 'tso', note: 'Store buffers let a core reorder its own writes — why two threads can both read stale values.' },
      { id: 'pagewalk', note: 'Every memory access translates a virtual address through a 4-level page table.' },
      { id: 'cpusched', note: 'The OS time-slices many processes onto the cores — FCFS, SJF, round-robin.' },
      { id: 'cfs', note: 'Linux’s CFS shares the CPU fairly by virtual runtime, weighted by nice value.' },
    ],
  },
  {
    id: 'production',
    title: 'Operating a service in production',
    icon: '🛠️',
    blurb: 'The lifecycle of running software reliably: ship it safely, keep it healthy, survive overload, and observe and harden it.',
    steps: [
      { id: 'deployments', note: 'Roll out v2 without downtime — rolling, blue-green, or canary.' },
      { id: 'healthcheck', note: 'Readiness gates traffic; liveness restarts — confusing them causes restart storms.' },
      { id: 'autoscale', note: 'Track load by adding and removing replicas with the HPA formula.' },
      { id: 'slo', note: 'Turn “be reliable” into an error budget you can spend on features.' },
      { id: 'loadshed', note: 'Under overload, shed fast — queuing everything collapses goodput.' },
      { id: 'idempotency', note: 'Make retries safe so a lost response can’t double-charge.' },
      { id: 'tracing', note: 'Follow one request across services to see where the latency really goes.' },
      { id: 'chaos', note: 'Inject failures on purpose to prove the blast radius is contained.' },
    ],
  },
];

export const pathById: Record<string, LearningPath> = Object.fromEntries(PATHS.map((p) => [p.id, p]));

/** The index of `sectionId` within a path's steps, or -1 if the learner has stepped off the path. */
export function stepIndexOf(path: LearningPath, sectionId: string): number {
  return path.steps.findIndex((s) => s.id === sectionId);
}
