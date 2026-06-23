// Modbus/TCP — MODBUS Messaging on TCP/IP. Reference: "MODBUS Messaging on
// TCP/IP Implementation Guide V1.0b" (Modbus Organization), together with the
// "MODBUS Application Protocol Specification V1.1b3" which defines the function
// codes. Modbus/TCP runs over TCP, by convention on port 502.
//
// Modbus is not an IETF protocol — its authoritative references are the two
// Modbus Organization specifications above; the MBAP header layout and the
// function codes below are transcribed from them.
//
// FRAME STRUCTURE
// ---------------
// A Modbus/TCP frame is the 7-byte MBAP (MODBUS Application Protocol) header
// prepended to a Modbus PDU (Protocol Data Unit). The PDU is a 1-byte Function
// Code followed by function-specific Data:
//
//   MBAP header (7 bytes):
//     Transaction Identifier  (2 bytes)  — echoed by the server to pair req/resp
//     Protocol Identifier     (2 bytes)  — always 0x0000 for Modbus
//     Length                  (2 bytes)  — number of FOLLOWING bytes (Unit Id + PDU)
//     Unit Identifier         (1 byte)   — slave address / gateway routing
//   PDU:
//     Function Code           (1 byte)
//     Data                    (N bytes)  — function-specific (e.g. address+quantity)
//
// This spec models the 7-byte MBAP header plus the 1-byte Function Code (8 bytes
// total). The function-specific data that follows is not a single fixed bit grid
// (its layout depends on the function code and on whether the message is a
// request or a response), so it cannot be transcribed honestly as fixed-width
// Field entries — it falls through as node.payload. See the `note` on the
// functionCode field and `next: () => null`.
//
// ENDIANNESS: Modbus is BIG-ENDIAN (network order) on the wire for all multi-byte
// values, so no `endian` overrides are needed.
import type { ProtocolSpec } from '../core/types';

// MODBUS Application Protocol Specification V1.1b3, section 5 — public function
// codes. These are the common data-access functions.
const FUNCTION_CODE: Record<number, string> = {
  1: 'Read Coils',
  2: 'Read Discrete Inputs',
  3: 'Read Holding Registers',
  4: 'Read Input Registers',
  5: 'Write Single Coil',
  6: 'Write Single Register',
  15: 'Write Multiple Coils',
  16: 'Write Multiple Registers',
};

export const modbus: ProtocolSpec = {
  id: 'modbus',
  name: 'Modbus/TCP',
  layer: 7,
  summary:
    'A simple industrial request/response protocol over TCP/502. A 7-byte MBAP header (transaction id, protocol id = 0, length, unit id) precedes a Modbus PDU: a function code plus function-specific data (e.g. "read 3 holding registers starting at 0x006B").',
  fields: [
    {
      name: 'transactionId',
      label: 'Transaction Identifier',
      bits: 16,
      desc: 'A 2-byte identifier the client chooses for each request; the server copies it verbatim into its response so the client can pair a response with the request that caused it.',
      detail: `TRANSACTION IDENTIFIER (2 bytes, big-endian):
- "Identification of a MODBUS Request / Response transaction." The MODBUS Client initializes it; the MODBUS Server copies it unchanged into the response.
- This lets a client keep several requests outstanding on one TCP connection (pipelining) and still match each response to its request — TCP preserves order, but a gateway fronting several serial slaves may answer out of order.
- The value is opaque to Modbus itself; any 16-bit value works.`,
    },
    {
      name: 'protocolId',
      label: 'Protocol Identifier',
      bits: 16,
      decode: (v) => (v === 0 ? '0 (Modbus)' : String(v)),
      desc: 'A 2-byte protocol selector that is always 0x0000 for Modbus. It exists for intra-system multiplexing so other protocols could in principle share the framing.',
      detail: `PROTOCOL IDENTIFIER (2 bytes, big-endian):
- "0 = MODBUS protocol." Used for intra-system multiplexing.
- In practice it is always 0x0000 on a Modbus/TCP link; a receiver that sees any other value is not talking to a Modbus peer and should ignore the frame.`,
    },
    {
      name: 'length',
      label: 'Length',
      bits: 16,
      decode: (v) => `${v} bytes following (unit id + ${v - 1}-byte PDU)`,
      desc: 'The number of bytes that FOLLOW this field — i.e. the Unit Identifier (1 byte) plus the whole Modbus PDU (function code + data). It does NOT count the 6 bytes of MBAP header before it, so the full frame length is Length + 6.',
      detail: `LENGTH (2 bytes, big-endian):
- "Number of following bytes" = Unit Identifier (1) + Function Code (1) + Data (N).
- It does NOT include the first 6 MBAP bytes (Transaction Id, Protocol Id, Length itself). Total frame on the wire = Length + 6 bytes.
- Because TCP is a byte stream with no message boundaries, a Modbus/TCP receiver uses this field to find where one frame ends and the next begins. The dissector uses it (pduBytes = Length + 6) so trailing bytes of a coalesced stream don't leak into this frame's payload.
- A minimal frame (function code, no data) has Length = 2 (unit id + function code).`,
    },
    {
      name: 'unitId',
      label: 'Unit Identifier',
      bits: 8,
      desc: 'A 1-byte slave/device address used for routing. On a direct Modbus/TCP device it is often 0xFF or 0x01 and ignored; a gateway uses it to address a specific Modbus-serial slave behind it.',
      detail: `UNIT IDENTIFIER (1 byte):
- Replaces the "slave address" of Modbus Serial Line. "Used for intra-system routing purpose."
- Typical use: a TCP-to-serial gateway uses the Unit Id to pick which serial slave (1..247) receives the request.
- For a device that is itself the Modbus end point, the field is often set to 0x00 or 0xFF and ignored. The guide recommends 0xFF when the Unit Id is not significant.`,
    },
    {
      name: 'functionCode',
      label: 'Function Code',
      bits: 8,
      type: 'enum',
      enumMap: FUNCTION_CODE,
      note: 'First byte of the Modbus PDU. The function-specific data (e.g. starting address + quantity, or register values) follows as payload. In a response, bit 7 set (code + 0x80) signals an exception.',
      desc: 'The first byte of the Modbus PDU: it selects the operation (read coils, read holding registers, write a register, …). In a response, the high bit being set (function code + 0x80) marks an exception, with a following 1-byte exception code.',
      detail: `FUNCTION CODE (1 byte) — public data-access codes (MODBUS Application Protocol Spec V1.1b3 section 5):
  1  Read Coils                — read 1..2000 output bits
  2  Read Discrete Inputs      — read 1..2000 input bits
  3  Read Holding Registers    — read 1..125 read/write 16-bit registers
  4  Read Input Registers      — read 1..125 read-only 16-bit registers
  5  Write Single Coil         — write one output bit (0x0000 / 0xFF00)
  6  Write Single Register     — write one 16-bit register
 15  Write Multiple Coils      — write a span of output bits
 16  Write Multiple Registers  — write a span of 16-bit registers

REQUEST vs RESPONSE DATA (follows as payload, not modelled as fixed fields):
- A Read Holding Registers (3) REQUEST data = Starting Address (2 bytes) + Quantity of Registers (2 bytes).
- The matching RESPONSE data = Byte Count (1 byte) + that many register-value bytes.
So the same function code carries different data shapes in each direction — which is why this spec stops at the function code and exposes the rest as payload.

EXCEPTIONS: if the server cannot service the request it replies with Function Code + 0x80 (high bit set) followed by a 1-byte Exception Code (1 = Illegal Function, 2 = Illegal Data Address, 3 = Illegal Data Value, 4 = Server Device Failure, …).`,
    },
  ],
  // Fixed 7-byte MBAP header + 1-byte function code = 8 bytes modelled here.
  headerBytes: () => 8,
  // The Length field counts the bytes AFTER it (unit id + PDU). The 6 bytes
  // before/including Length (transaction id 2 + protocol id 2 + length 2) are not
  // counted, so the full frame = Length + 6. This bounds the PDU so a coalesced
  // TCP stream's following frame can't leak into this payload.
  pduBytes: (h) => h.get('length') + 6,
  // The function-specific data is request/response- and function-dependent; it is
  // not a fixed bit grid, so it falls through as node.payload and dissection stops.
  next: () => null,
};
