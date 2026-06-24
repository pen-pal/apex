// 802.1Q VLAN tagging — the 4-byte tag a switch inserts into an Ethernet frame to
// keep virtual LANs separate on one wire. The tag sits right after the source MAC:
// a 2-byte TPID (0x8100, marking the frame tagged) then a 2-byte TCI = PCP(3) priority
// ‖ DEI(1) drop-eligible ‖ VID(12) the VLAN id. Access ports carry one untagged VLAN;
// trunk ports carry many, tagged, with one untagged "native" VLAN — and that native
// VLAN is exactly what the double-tagging hop abuses. Real bytes (IEEE 802.1Q).

export const TPID = 0x8100;

export interface Tag { pcp: number; dei: number; vid: number }

/** Tag Control Information: PCP<<13 | DEI<<12 | VID. */
export const tci = (t: Tag): number => ((t.pcp & 0x7) << 13) | ((t.dei & 0x1) << 12) | (t.vid & 0xfff);

/** The 4 on-wire tag bytes: TPID (2) + TCI (2), big-endian. */
export function buildTag(t: Tag): Uint8Array {
  const c = tci(t);
  return Uint8Array.from([(TPID >> 8) & 0xff, TPID & 0xff, (c >> 8) & 0xff, c & 0xff]);
}

export interface ParsedTag { tpid: number; pcp: number; dei: number; vid: number }

export function parseTag(b: Uint8Array): ParsedTag {
  const tpid = (b[0] << 8) | b[1];
  const c = (b[2] << 8) | b[3];
  return { tpid, pcp: (c >> 13) & 0x7, dei: (c >> 12) & 0x1, vid: c & 0xfff };
}

/** What the first switch does to a frame arriving on its native (untagged) VLAN:
 *  it removes the outer tag. With a double-tagged frame, the inner tag survives onto
 *  the trunk and a second switch delivers it to that VLAN — the VLAN-hopping attack. */
export function stripOuter(tags: Tag[]): Tag[] {
  return tags.slice(1);
}

export const VID_MIN = 0, VID_MAX = 4095;
