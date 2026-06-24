// Sidebar taxonomy — the 32 sections grouped into collapsible categories so the
// nav stays navigable. Pure data + a tiny lookup, kept here (and tested) so the
// grouping can't silently drift out of sync with the sections themselves.

export interface SectionMeta { id: string; label: string; icon: string }

export const SECTION_META: SectionMeta[] = [
  { id: 'network', label: 'Network', icon: '🌐' },
  { id: 'switch', label: 'L2 switch', icon: '🔌' },
  { id: 'dhcp', label: 'DHCP (DORA)', icon: '📨' },
  { id: 'nat', label: 'NAT / PAT', icon: '🔀' },
  { id: 'traceroute', label: 'Traceroute', icon: '🛰️' },
  { id: 'subnet', label: 'Subnetting', icon: '🧮' },
  { id: 'fragment', label: 'IP fragmentation', icon: '🧩' },
  { id: 'natpunch', label: 'NAT traversal', icon: '🕳️' },
  { id: 'ipcompare', label: 'IPv4 vs IPv6', icon: '⇄' },
  { id: 'icmp', label: 'ICMP messages', icon: '🚨' },
  { id: 'multicast', label: 'Multicast & IGMP', icon: '📡' },
  { id: 'vlan', label: 'VLAN tagging', icon: '🏷️' },
  { id: 'arp', label: 'ARP resolution', icon: '📇' },
  { id: 'csma', label: 'WiFi CSMA/CA', icon: '📶' },
  { id: 'routing', label: 'Routing & paths', icon: '🧭' },
  { id: 'distvec', label: 'Distance-vector', icon: '📐' },
  { id: 'bgp', label: 'BGP paths', icon: '🛣️' },
  { id: 'bgphijack', label: 'BGP hijack', icon: '🏴‍☠️' },
  { id: 'dns', label: 'DNS journey', icon: '🔎' },
  { id: 'mdns', label: 'mDNS & DNS-SD', icon: '🖨️' },
  { id: 'encdns', label: 'Encrypted DNS', icon: '🕵️' },
  { id: 'congestion', label: 'TCP congestion', icon: '📈' },
  { id: 'flow', label: 'Flow control', icon: '🪟' },
  { id: 'arq', label: 'ARQ (GBN vs SR)', icon: '🔁' },
  { id: 'bufferbloat', label: 'Bufferbloat', icon: '🚰' },
  { id: 'qos', label: 'QoS scheduling', icon: '🚦' },
  { id: 'http2', label: 'HTTP/2 multiplexing', icon: '🧵' },
  { id: 'quic', label: 'QUIC vs TCP', icon: '🚀' },
  { id: 'http3', label: 'HTTP/3 & QPACK', icon: '🌐' },
  { id: 'cdn', label: 'CDN & caching', icon: '⚡' },
  { id: 'ratelimit', label: 'Rate limiting', icon: '🪣' },
  { id: 'crypto', label: 'Cryptography', icon: '🔒' },
  { id: 'aesround', label: 'AES internals', icon: '🧊' },
  { id: 'aead', label: 'CTR & AEAD', icon: '🔐' },
  { id: 'rsa', label: 'RSA', icon: '🗝️' },
  { id: 'ecc', label: 'Elliptic curves', icon: '➰' },
  { id: 'ecdsa', label: 'ECDSA & nonce reuse', icon: '✍️' },
  { id: 'chacha', label: 'ChaCha20', icon: '🌀' },
  { id: 'hashint', label: 'SHA-256 internals', icon: '🧮' },
  { id: 'dhmitm', label: 'DH man-in-the-middle', icon: '🕴️' },
  { id: 'tlsdowngrade', label: 'TLS downgrade', icon: '⬇️' },
  { id: 'pwhash', label: 'Password hashing', icon: '🔑' },
  { id: 'pqc', label: 'Post-quantum (LWE)', icon: '🔮' },
  { id: 'certs', label: 'Certificates (PKI)', icon: '📜' },
  { id: 'identity', label: 'Identity & Auth', icon: '🪪' },
  { id: 'cookies', label: 'Cookies & sessions', icon: '🍪' },
  { id: 'attacks', label: 'Attacks', icon: '⚔️' },
  { id: 'merkle', label: 'Merkle tree', icon: '🌳' },
  { id: 'encoding', label: 'Encoding', icon: '🔤' },
  { id: 'errors', label: 'Error control', icon: '🛡️' },
  { id: 'chash', label: 'Consistent hashing', icon: '⭕' },
  { id: 'lb', label: 'Load balancing', icon: '⚖️' },
  { id: 'bloom', label: 'Bloom filter', icon: '🌸' },
  { id: 'vclock', label: 'Vector clocks', icon: '🕰️' },
  { id: 'gossip', label: 'Gossip spread', icon: '🗣️' },
  { id: 'raft', label: 'Raft election', icon: '👑' },
  { id: 'cap', label: 'CAP theorem', icon: '⚖️' },
  { id: 'replication', label: 'Replication (WAL)', icon: '🗄️' },
  { id: 'twopc', label: 'Two-phase commit', icon: '🤝' },
];

export const metaById: Record<string, SectionMeta> = Object.fromEntries(SECTION_META.map((m) => [m.id, m]));

export interface SectionGroup { label: string; icon: string; ids: string[] }

export const GROUPS: SectionGroup[] = [
  { label: 'Network basics', icon: '🌐', ids: ['network', 'switch', 'arp', 'csma', 'dhcp', 'nat', 'natpunch', 'traceroute', 'subnet', 'fragment', 'ipcompare', 'icmp', 'multicast', 'vlan'] },
  { label: 'Routing & naming', icon: '🧭', ids: ['routing', 'distvec', 'bgp', 'bgphijack', 'dns', 'mdns', 'encdns'] },
  { label: 'Transport & web', icon: '🚀', ids: ['congestion', 'flow', 'arq', 'bufferbloat', 'qos', 'http2', 'quic', 'http3', 'cdn', 'ratelimit'] },
  { label: 'Cryptography', icon: '🔒', ids: ['crypto', 'aesround', 'aead', 'chacha', 'hashint', 'rsa', 'ecc', 'ecdsa', 'dhmitm', 'tlsdowngrade', 'pwhash', 'pqc', 'merkle'] },
  { label: 'Security & web', icon: '🛡️', ids: ['certs', 'identity', 'cookies', 'attacks'] },
  { label: 'Data & encoding', icon: '🔤', ids: ['encoding', 'errors'] },
  { label: 'Distributed systems', icon: '🕸️', ids: ['chash', 'lb', 'bloom', 'vclock', 'gossip', 'raft', 'cap', 'replication', 'twopc'] },
];

/** The label of the group that contains `id` (or null if ungrouped). */
export function groupOf(id: string): string | null {
  return GROUPS.find((g) => g.ids.includes(id))?.label ?? null;
}
