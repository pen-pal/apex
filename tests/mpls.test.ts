import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { mpls } from '../src/protocols/mpls';

// Hand-verified MPLS label stack entries (RFC 3032 §2.1, 4 octets each:
// Label 20b | TC/Exp 3b | S 1b | TTL 8b), as carried after Ethernet
// EtherType 0x8847 (MPLS unicast).
//
// SINGLE LABEL (bottom of stack), followed by the start of an inner IPv4 header:
//   Label = 18      -> 0x00012 (20 bits)
//   TC    = 0       -> 000
//   S     = 1       -> bottom of stack: the inner packet follows
//   TTL   = 64      -> 0x40
//
// Bit packing into 4 bytes:
//   byte0 byte1 = high 16 bits of label = 0x00 0x01
//   byte2 = (low 4 label bits 0010) (TC 000) (S 1) = 0010 0001 = 0x21
//   byte3 = TTL = 0x40
const mplsBottom = [0x00, 0x01, 0x21, 0x40];

// The encapsulated IPv4 header (first bytes): version=4, IHL=5 -> 0x45,
// DSCP/ECN 0x00, total length 0x0054 = 84 bytes, ... We only need the leading
// bytes to prove the inner packet lands intact in node.payload.
const innerIpv4Start = [0x45, 0x00, 0x00, 0x54, 0x12, 0x34, 0x40, 0x00, 0x40, 0x01];

// A TWO-LABEL STACK (an outer transport label, S=0, then a bottom label, S=1):
//   Outer: Label = 100 (0x00064), TC = 5 (101), S = 0, TTL = 255 (0xFF)
//     byte2 = (low 4 of 0x064 = 0100)(TC 101)(S 0) = 0100 1010 = 0x4A
//     bytes = 0x00 0x06 0x4A 0xFF
//   Inner: Label = 18, TC = 0, S = 1, TTL = 64 -> the mplsBottom above.
const mplsOuter = [0x00, 0x06, 0x4a, 0xff];

describe('MPLS label stack dissection', () => {
  const reg = new ProtocolRegistry();
  reg.register(mpls);

  it('parses a single 4-byte bottom-of-stack label entry', () => {
    const node = dissect([...mplsBottom, ...innerIpv4Start], 'mpls', reg);
    const h = node.header;
    expect(h.byteLength).toBe(4);
    expect(h.get('label')).toBe(18);
    expect(h.get('trafficClass')).toBe(0);
    expect(h.get('bottomOfStack')).toBe(1);
    expect(h.get('timeToLive')).toBe(64);
  });

  it('stops at the bottom of the stack (S=1) and leaves the inner packet in the payload', () => {
    const node = dissect([...mplsBottom, ...innerIpv4Start], 'mpls', reg);
    // S=1 -> no MPLS child; the inner network-layer packet is not named by the
    // header, so dissection stops here and the inner packet stays in the payload.
    expect(mpls.next!(node.header, reg)).toBe(null);
    expect(node.child).toBe(null);
    expect(node.payload).toEqual(innerIpv4Start);
    // The first byte of the payload is the inner IPv4 version/IHL nibble 0x45.
    expect(node.payload[0]).toBe(0x45);
  });

  it('recurses into another MPLS entry when S=0 (a stacked label)', () => {
    const node = dissect([...mplsOuter, ...mplsBottom, ...innerIpv4Start], 'mpls', reg);
    const h = node.header;
    expect(h.get('label')).toBe(100);
    expect(h.get('trafficClass')).toBe(5);
    expect(h.get('bottomOfStack')).toBe(0);
    expect(h.get('timeToLive')).toBe(255);
    // S=0 -> dispatch to another MPLS label entry.
    expect(mpls.next!(h, reg)).toBe('mpls');
    // The dissector recurses: the child is the bottom label, parsed correctly.
    expect(node.child).not.toBe(null);
    expect(node.child!.header.get('label')).toBe(18);
    expect(node.child!.header.get('bottomOfStack')).toBe(1);
    // And the inner IPv4 packet ends up in the bottom label's payload.
    expect(node.child!.payload).toEqual(innerIpv4Start);
  });
});
