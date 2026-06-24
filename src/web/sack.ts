// TCP Selective Acknowledgment (SACK, RFC 2018). A plain cumulative ACK can only say
// "I have everything up to byte X" — so when a segment is lost but later ones arrive, the
// sender is blind to what got through and may resend everything after the gap (go-back-N).
// SACK adds blocks that report the exact ranges received ABOVE the cumulative point, so
// the sender retransmits only the actual holes. This models the difference: which
// segments each strategy puts back on the wire. Pure and tested on a worked loss pattern.

export interface SackInfo {
  cumulativeAck: number;       // highest in-order segment the receiver has (0 = none)
  highestReceived: number;     // highest segment number received at all
  sackBlocks: [number, number][]; // contiguous received ranges above the cumulative ack
  holes: number[];             // missing segments below the highest received
  retransmitWithSack: number[];    // SACK: just the holes
  retransmitGoBackN: number[];     // no SACK: everything after the cumulative ack
  saved: number;               // segments SACK avoids resending
}

/** `received[i]` = was segment (i+1) received? Segments are numbered 1..N. */
export function analyze(received: boolean[]): SackInfo {
  const n = received.length;
  const has = (seg: number) => received[seg - 1];

  let cumulativeAck = 0;
  while (cumulativeAck < n && has(cumulativeAck + 1)) cumulativeAck++;

  let highestReceived = 0;
  for (let s = 1; s <= n; s++) if (has(s)) highestReceived = s;

  // contiguous received blocks strictly above the cumulative ack
  const sackBlocks: [number, number][] = [];
  let start = -1;
  for (let s = cumulativeAck + 1; s <= highestReceived; s++) {
    if (has(s)) { if (start === -1) start = s; }
    else if (start !== -1) { sackBlocks.push([start, s - 1]); start = -1; }
  }
  if (start !== -1) sackBlocks.push([start, highestReceived]);

  const holes: number[] = [];
  for (let s = cumulativeAck + 1; s <= highestReceived; s++) if (!has(s)) holes.push(s);

  const retransmitGoBackN: number[] = [];
  for (let s = cumulativeAck + 1; s <= highestReceived; s++) retransmitGoBackN.push(s);

  return {
    cumulativeAck, highestReceived, sackBlocks, holes,
    retransmitWithSack: holes.slice(),
    retransmitGoBackN,
    saved: retransmitGoBackN.length - holes.length,
  };
}
