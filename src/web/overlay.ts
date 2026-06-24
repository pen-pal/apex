// VXLAN overlay networking (RFC 7348) — how a cloud runs thousands of isolated tenant L2 networks
// over one shared L3 fabric. A VTEP (VXLAN Tunnel Endpoint, usually the hypervisor vSwitch) takes a
// tenant's inner Ethernet frame and wraps it: VXLAN header (carrying a 24-bit VNI that names the
// tenant network) → UDP (dst port 4789) → outer IP (this VTEP → the remote VTEP) → outer Ethernet.
// The underlay just routes a normal UDP/IP packet; the remote VTEP strips the wrappers and delivers
// the original frame. 24 bits of VNI means ~16 million tenant networks on the same wire, fully
// isolated. The VTEP also LEARNS: it maps (VNI, inner source MAC) → the remote VTEP IP it arrived
// from, so replies are unicast across the fabric instead of flooded. Pure encapsulation model, tested.

export interface Frame { dstMac: string; srcMac: string; payload: string }

export interface VxlanPacket {
  outerEth: { note: string };
  outerIp: { src: string; dst: string; proto: string };
  udp: { srcPort: number; dstPort: number };
  vxlan: { flagsHex: string; vni: number };
  inner: Frame;
  overheadBytes: number;
}

export const VXLAN_PORT = 4789; // RFC 7348 §5: IANA-assigned destination UDP port
export const VXLAN_OVERHEAD = 50; // outer Eth(14) + IP(20) + UDP(8) + VXLAN(8)

/** A simple deterministic hash → ephemeral source port (real VTEPs hash the inner flow for ECMP entropy). */
function flowPort(inner: Frame): number {
  let h = 0;
  for (const ch of inner.srcMac + inner.dstMac + inner.payload) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0;
  return 49152 + (h % 16384); // 49152–65535 ephemeral range
}

/** Wrap a tenant frame for VNI `vni`, tunneled from srcVtep to dstVtep. */
export function encapsulate(inner: Frame, vni: number, srcVtep: string, dstVtep: string): VxlanPacket {
  return {
    outerEth: { note: 'next-hop MACs in the underlay (rewritten each hop)' },
    outerIp: { src: srcVtep, dst: dstVtep, proto: 'UDP (17)' },
    udp: { srcPort: flowPort(inner), dstPort: VXLAN_PORT },
    vxlan: { flagsHex: '0x08', vni }, // the I flag (0x08) marks the VNI as valid
    inner,
    overheadBytes: VXLAN_OVERHEAD,
  };
}

// ---- VTEP MAC learning (the control-plane half) -------------------------------------------------

export type MacTable = Record<string, string>; // key `${vni}|${mac}` → remote VTEP IP
const key = (vni: number, mac: string) => `${vni}|${mac}`;

/** Learn that `mac` in tenant network `vni` lives behind the VTEP at `vtepIp`. */
export function learn(table: MacTable, vni: number, mac: string, vtepIp: string): MacTable {
  return { ...table, [key(vni, mac)]: vtepIp };
}

/** Find the VTEP to unicast to, or null if unknown (→ flood as BUM traffic to all VTEPs in the VNI). */
export function lookup(table: MacTable, vni: number, mac: string): string | null {
  return table[key(vni, mac)] ?? null;
}
