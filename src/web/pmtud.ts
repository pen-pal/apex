// Path MTU Discovery (RFC 1191). Every link has a Maximum Transmission Unit; the path's
// MTU is the smallest link along it. A sender that sets the Don't-Fragment bit and sends
// too large a packet gets it DROPPED at the narrow link, which returns an ICMP "Packet
// Too Big / fragmentation needed" (Type 3, Code 4) carrying that link's MTU. The sender
// shrinks and retries, converging on the path MTU. The failure mode: if a firewall eats
// those ICMP messages, the sender never learns — the connection just hangs on large
// transfers (a PMTUD "black hole"). Pure model; tested on a worked path.

export interface Link { name: string; mtu: number }

export interface Attempt {
  size: number;        // packet size tried
  droppedAtHop: number | null; // index of the link that dropped it (null = delivered)
  icmpMtu: number | null;      // next-hop MTU returned by ICMP (null if blocked or delivered)
  delivered: boolean;
}

export interface Result { attempts: Attempt[]; pathMtu: number | null; blackHole: boolean }

/** Run PMTUD across `links` starting from `initialSize` with DF set. */
export function pmtud(links: Link[], initialSize: number, icmpBlocked = false): Result {
  const attempts: Attempt[] = [];
  let size = initialSize;
  const truePathMtu = Math.min(...links.map((l) => l.mtu));

  for (let guard = 0; guard < links.length + 2; guard++) {
    const hop = links.findIndex((l) => size > l.mtu); // first link too small for this packet
    if (hop === -1) {
      attempts.push({ size, droppedAtHop: null, icmpMtu: null, delivered: true });
      return { attempts, pathMtu: size, blackHole: false };
    }
    if (icmpBlocked) {
      // dropped, and the ICMP that would teach the sender never arrives → black hole
      attempts.push({ size, droppedAtHop: hop, icmpMtu: null, delivered: false });
      return { attempts, pathMtu: null, blackHole: true };
    }
    const icmpMtu = links[hop].mtu;
    attempts.push({ size, droppedAtHop: hop, icmpMtu, delivered: false });
    size = icmpMtu; // shrink to what the ICMP reported and retry
  }
  // safety net (shouldn't be reached for a sane path)
  return { attempts, pathMtu: truePathMtu, blackHole: false };
}
