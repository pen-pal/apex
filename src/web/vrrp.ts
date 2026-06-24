// VRRP — first-hop redundancy (RFC 5798). Hosts are configured with ONE default gateway IP, so if
// that router dies they're cut off. VRRP hides a group of routers behind a single VIRTUAL IP (and a
// virtual MAC 00-00-5E-00-01-{VRID}); whichever router is MASTER answers for it. The master is the
// highest-priority router; it sends advertisements every interval. If the backups stop hearing them,
// they take over — but cleverly: each backup's Master_Down timer is offset by a SKEW proportional to
// (256 − priority), so the highest-priority backup times out FIRST and becomes master alone, instead
// of several backups colliding. Hosts never notice: the VIP and virtual MAC just move. A gratuitous
// ARP repoints the switches. Pure timing model from the RFC's formulas, tested.

export interface Router { id: string; priority: number; up: boolean }

/** The group's virtual MAC for a given VRID (RFC 5798 §7.3). */
export const virtualMac = (vrid: number): string => `00:00:5e:00:01:${vrid.toString(16).padStart(2, '0')}`;

/** Skew_Time = ((256 − priority) / 256) · Advertisement_Interval — higher priority ⇒ smaller skew. */
export const skewTime = (priority: number, advIntervalCs: number): number => ((256 - priority) / 256) * advIntervalCs;

/** Master_Down_Interval = 3 · Advertisement_Interval + Skew_Time (in centiseconds). */
export const masterDownInterval = (priority: number, advIntervalCs: number): number => 3 * advIntervalCs + skewTime(priority, advIntervalCs);

export interface Election {
  master: string | null; // highest-priority router that is up
  backups: string[]; // the other up routers, highest priority first
  takeoverCs: number | null; // if the master just failed, when the new master takes over
  newMaster: string | null; // who that is
}

/** Resolve mastership now, and — if the current master is down — who takes over and when. */
export function elect(routers: Router[], _advIntervalCs?: number): Election {
  const up = routers.filter((r) => r.up).sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  if (up.length === 0) return { master: null, backups: [], takeoverCs: null, newMaster: null };
  const master = up[0];
  const backups = up.slice(1).map((r) => r.id);
  return { master: master.id, backups, takeoverCs: null, newMaster: null };
}

/** Fail the current master and compute the failover: the surviving highest-priority router wins,
 *  and its Master_Down_Interval is when it claims the VIP (the smallest interval ⇒ no collision). */
export function failover(routers: Router[], advIntervalCs: number): Election {
  const cur = elect(routers, advIntervalCs).master;
  const survivors = routers.map((r) => (r.id === cur ? { ...r, up: false } : r));
  const after = elect(survivors, advIntervalCs);
  if (!after.master) return { master: null, backups: [], takeoverCs: null, newMaster: null };
  // the new master is the highest-priority survivor; it takes over after ITS Master_Down_Interval
  const newM = routers.find((r) => r.id === after.master)!;
  return { master: cur, backups: after.backups, takeoverCs: masterDownInterval(newM.priority, advIntervalCs), newMaster: after.master };
}
