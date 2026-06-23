import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dhcpv6 } from '../src/protocols/dhcpv6';
import { dissect } from '../src/core/engine';

// A hand-verified DHCPv6 SOLICIT message (the UDP payload, client port 546 ->
// server multicast ff02::1:2 port 547), encoded per RFC 8415 §8 (client/server
// header) and §21 (TLV options).
//
// Byte breakdown:
//   01                 msg-type = 1 (SOLICIT)
//   10 08 74           transaction-id = 0x100874
//   --- options (TLV, fall through as payload) ---
//   00 08 00 02 00 00          OPTION_ELAPSED_TIME (code 8) len 2, value 0
//   00 01 00 0e                OPTION_CLIENTID (code 1) len 14
//     00 01 00 01 1d 1e 0b 36 00 0c 29 e5 41 33   DUID-LLT (type 1) ...
//   00 03 00 0c                OPTION_IA_NA (code 3) len 12
//     0a 00 0c 29                IAID
//     00 00 0e 10                T1 = 3600
//     00 00 15 18                T2 = 5400
//   00 06 00 04 00 17 00 18     OPTION_ORO (code 6) len 4: request DNS(23), DomainList(24)
//
// Apex models only the fixed 4-byte header (msg-type + transaction-id); the
// options follow as the TLV payload.
const solicit = [
  // --- modeled 4-byte client/server header ---
  0x01, // msg-type = SOLICIT
  0x10, 0x08, 0x74, // transaction-id = 0x100874
  // --- payload: OPTION_ELAPSED_TIME ---
  0x00, 0x08, 0x00, 0x02, 0x00, 0x00,
  // --- payload: OPTION_CLIENTID (DUID-LLT) ---
  0x00, 0x01, 0x00, 0x0e,
  0x00, 0x01, 0x00, 0x01, 0x1d, 0x1e, 0x0b, 0x36, 0x00, 0x0c, 0x29, 0xe5, 0x41, 0x33,
  // --- payload: OPTION_IA_NA ---
  0x00, 0x03, 0x00, 0x0c,
  0x0a, 0x00, 0x0c, 0x29,
  0x00, 0x00, 0x0e, 0x10,
  0x00, 0x00, 0x15, 0x18,
  // --- payload: OPTION_ORO ---
  0x00, 0x06, 0x00, 0x04, 0x00, 0x17, 0x00, 0x18,
];

describe('DHCPv6 client/server header dissection', () => {
  const reg = new ProtocolRegistry();
  reg.register(dhcpv6);

  it('parses the fixed 4-byte msg-type + transaction-id per RFC 8415 §8', () => {
    const node = dissect(solicit, 'dhcpv6', reg);
    const h = node.header;

    // Header is exactly 4 bytes: 1 (msg-type) + 3 (transaction-id).
    expect(h.byteLength).toBe(4);

    // SOLICIT = message type 1.
    expect(h.get('msgType')).toBe(1);

    // 24-bit transaction id, big-endian.
    expect(h.get('transactionId')).toBe(0x100874);
  });

  it('formats coded fields via their enum/decode', () => {
    const node = dissect(solicit, 'dhcpv6', reg);
    const f = (name: string) => node.header.fields.find((x) => x.field.name === name)!;
    expect(f('msgType').display).toBe('1 (SOLICIT)');
    expect(f('transactionId').display).toBe('0x100874');
  });

  it('leaves the options as the TLV payload, and stops', () => {
    const node = dissect(solicit, 'dhcpv6', reg);
    // 4-byte header consumed; the rest is the option TLV stream.
    expect(node.payload.length).toBe(solicit.length - 4);
    // The payload begins with OPTION_ELAPSED_TIME: code 0x0008, len 0x0002.
    expect(node.payload.slice(0, 4)).toEqual([0x00, 0x08, 0x00, 0x02]);
    // OPTION_CLIENTID (code 0x0001, len 0x000e) follows the 6-byte elapsed-time.
    expect(node.payload.slice(6, 10)).toEqual([0x00, 0x01, 0x00, 0x0e]);
    // We do not dissect the recursive TLV options as a child layer.
    expect(node.child).toBeNull();
  });
});
