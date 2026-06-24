// mDNS + DNS-SD (RFC 6762 / 6763) — how your laptop finds the printer with no DNS
// server at all. mDNS is ordinary DNS wire format, but queries go to the multicast
// group 224.0.0.251 (ff02::fb on v6), UDP 5353, and names live under .local. Every
// device both asks and answers. DNS-SD layers a record chain on top: a PTR lists
// the instances of a service type, an SRV gives an instance's host+port, TXT carries
// metadata, and A/AAAA resolves the host to an address. Pure model; the record types
// and ports are real.

export interface Service {
  instance: string; // human label, e.g. "Office LaserJet"
  type: string; // service type, e.g. "_ipp._tcp.local"
  host: string; // .local hostname
  port: number;
  ip: string;
  txt: Record<string, string>; // DNS-SD TXT key/value metadata
}

export const MDNS_GROUP = '224.0.0.251';
export const MDNS_GROUP_V6 = 'ff02::fb';
export const MDNS_PORT = 5353;

export const isLocal = (name: string): boolean => name.endsWith('.local');

/** A demo LAN of advertised services. */
export const SERVICES: Service[] = [
  { instance: 'Office LaserJet', type: '_ipp._tcp.local', host: 'laserjet.local', port: 631, ip: '192.168.1.20', txt: { ty: 'HP LaserJet Pro', rp: 'ipp/print', pdl: 'application/pdf', Color: 'T' } },
  { instance: 'Living Room', type: '_airplay._tcp.local', host: 'appletv.local', port: 7000, ip: '192.168.1.31', txt: { model: 'AppleTV6,2', deviceid: 'AA:BB:CC:DD:EE:FF' } },
  { instance: 'Kitchen', type: '_airplay._tcp.local', host: 'homepod.local', port: 7000, ip: '192.168.1.32', txt: { model: 'AudioAccessory5,1' } },
  { instance: 'dev-server', type: '_http._tcp.local', host: 'devbox.local', port: 8080, ip: '192.168.1.50', txt: { path: '/' } },
  { instance: 'Family TV', type: '_googlecast._tcp.local', host: 'chromecast.local', port: 8009, ip: '192.168.1.40', txt: { md: 'Chromecast', fn: 'Family TV' } },
];

/** Distinct service types advertised on the link (what a browser would discover). */
export const serviceTypes = (services: Service[]): string[] => [...new Set(services.map((s) => s.type))].sort();

/** A PTR query for `type` returns the instances offering it. */
export const browse = (services: Service[], type: string): Service[] => services.filter((s) => s.type === type);

export interface DnsRecord { kind: 'PTR' | 'SRV' | 'TXT' | 'A'; name: string; value: string }

/** The DNS-SD record chain that resolves one instance to a connectable address. */
export function resolve(s: Service): DnsRecord[] {
  return [
    { kind: 'PTR', name: s.type, value: `${s.instance}.${s.type}` },
    { kind: 'SRV', name: `${s.instance}.${s.type}`, value: `${s.host}:${s.port}` },
    { kind: 'TXT', name: `${s.instance}.${s.type}`, value: Object.entries(s.txt).map(([k, v]) => `${k}=${v}`).join(' ') },
    { kind: 'A', name: s.host, value: s.ip },
  ];
}

/** The full connection target, the point of the whole exercise. */
export const target = (s: Service): string => `${s.ip}:${s.port}`;
