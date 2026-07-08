// Container networking from the bytes up: network namespaces, veth pairs, a bridge, and NAT. Each container lives in
// its own network namespace with its own eth0 and IP. A veth pair is a virtual cable: one end is the container's eth0,
// the other is plugged into a Linux bridge on the host (docker0) that acts as a virtual switch. Containers on the SAME
// bridge reach each other directly at L2 with their private IPs — no NAT. To reach the internet the host MASQUERADEs
// (source-NAT): it rewrites the container's private RFC1918 source address to the host's routable IP so the reply can
// find its way back. Turn that off and the container is stranded. This computes the hop path + rewrites + verdict.

export interface Container { name: string; ip: string; bridge: string }
export interface Topology {
  containers: Container[];
  hostPublicIp: string;   // the host's routable address (what MASQUERADE rewrites to)
  masquerade: boolean;    // is SNAT/MASQUERADE enabled for egress to the internet?
}

export const INTERNET_IP = '93.184.216.34'; // example.com — a public destination outside every bridge

export interface Hop { where: string; src: string; dst: string; rewrite?: boolean; note?: string }
export interface Result { hops: Hop[]; ok: boolean; reason: string }

const isPrivate = (ip: string) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);

// Send an IP packet from a container to another container (by name) or to the internet (INTERNET_IP).
export function send(topo: Topology, fromName: string, dstIpOrName: string): Result {
  const from = topo.containers.find((c) => c.name === fromName);
  if (!from) return { hops: [], ok: false, reason: `no container named ${fromName}` };

  // Destination is another container?
  const target = topo.containers.find((c) => c.name === dstIpOrName || c.ip === dstIpOrName);
  if (target) {
    const hops: Hop[] = [{ where: `${from.name}:eth0`, src: from.ip, dst: target.ip }];
    if (target.bridge === from.bridge) {
      hops.push({ where: `${from.bridge} (bridge)`, src: from.ip, dst: target.ip, note: 'L2 switch — forwarded by MAC' });
      hops.push({ where: `${target.name}:eth0`, src: from.ip, dst: target.ip });
      return { hops, ok: true, reason: `Same bridge (${from.bridge}): the two eth0s share one L2 domain, so the bridge forwards the frame by MAC. Private IPs unchanged — no NAT.` };
    }
    // different bridge: the bridge floods within its own domain only, and nothing routes between the two subnets
    hops.push({ where: `${from.bridge} (bridge)`, src: from.ip, dst: target.ip, note: `${target.ip} is not on this bridge` });
    return { hops, ok: false, reason: `${target.name} is on a different bridge (${target.bridge}). A bridge only switches within its own L2 domain, and no route connects the two subnets — the packet is dropped. Isolation by design.` };
  }

  // Otherwise: egress to the internet.
  const dst = dstIpOrName;
  const hops: Hop[] = [
    { where: `${from.name}:eth0`, src: from.ip, dst },
    { where: `${from.bridge} (bridge)`, src: from.ip, dst, note: 'up to the host' },
  ];
  if (topo.masquerade) {
    hops.push({ where: 'host eth0 (MASQUERADE)', src: topo.hostPublicIp, dst, rewrite: true, note: `SNAT: ${from.ip} → ${topo.hostPublicIp}` });
    hops.push({ where: 'the internet', src: topo.hostPublicIp, dst });
    return { hops, ok: true, reason: `MASQUERADE rewrote the private source ${from.ip} to the host's routable ${topo.hostPublicIp}. The reply comes back to the host, which un-NATs it to ${from.ip}. That one iptables rule is the whole reason containers can browse the web.` };
  }
  hops.push({ where: 'host eth0 (no SNAT)', src: from.ip, dst, note: `source still ${from.ip}` });
  hops.push({ where: 'the internet', src: from.ip, dst, note: 'reply has nowhere to go' });
  return {
    hops, ok: false,
    reason: `Without MASQUERADE the source stays ${from.ip} — a ${isPrivate(from.ip) ? 'private RFC1918' : 'non-routable'} address. The request may leave, but the reply is addressed to ${from.ip}, which no router on the internet will carry back. The container is stranded.`,
  };
}
