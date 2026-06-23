// S7comm — Siemens S7 Communication, the application protocol of the Siemens
// S7 PLC stack (TCP/102): TCP -> TPKT (RFC 1006) -> COTP (ISO 8073) -> S7comm.
//
// S7comm is a Siemens-proprietary protocol with NO public RFC. The header layout
// transcribed below is the well-documented, widely-implemented structure used by
// the Wireshark "s7comm" dissector (epan/dissectors/packet-s7comm.c — the
// authoritative open reference for these field offsets) and by independent S7
// tooling (e.g. the plcscan/s7.py client, which negotiates against real Siemens
// PLCs using exactly these bytes). Field widths and the 10-vs-12-byte header rule
// below are taken from that dissector, NOT invented to match this code.
//
// HEADER STRUCTURE (Wireshark packet-s7comm.c, dissect of the S7comm header)
// -------------------------------------------------------------------------
//   byte 0:    Protocol Id      — always 0x32 ("S7 magic")
//   byte 1:    ROSCTR           — message type (Job / Ack / Ack_Data / Userdata)
//   bytes 2-3: Redundancy Id    — reserved, 0x0000 in practice
//   bytes 4-5: PDU Reference    — request id, echoed in the matching response (BE)
//   bytes 6-7: Parameter length — length of the parameter area that follows (BE)
//   bytes 8-9: Data length      — length of the data area that follows (BE)
//   bytes 10-11 (ROSCTR 2/3 ONLY): Error class (1) + Error code (1)
//
// So the header is 10 bytes for Job (0x01) and Userdata (0x07), and 12 bytes for
// Ack (0x02) and Ack_Data (0x03) — the two response types carry an extra 2-byte
// error class/code field. After the header come the parameter area (parameter
// length bytes) and then the data area (data length bytes); their internal layout
// is function-specific (e.g. Setup Communication, Read Var, Write Var), so this
// spec does not invent it — it falls through as node.payload and next() is null.
//
// ENDIANNESS: all multi-byte fields (PDU reference, parameter length, data length)
// are big-endian (network order) — matching the Wireshark dissector, which reads
// every one of them with ENC_BIG_ENDIAN.
import type { ProtocolSpec, ParsedHeader } from '../core/types';

// Wireshark packet-s7comm.c — rosctr_names: the ROSCTR (Remote Operating Service
// Control) message types.
const ROSCTR: Record<number, string> = {
  0x01: 'Job',        // request with acknowledgement (read/write, setup, ...)
  0x02: 'Ack',        // acknowledgement, no data field
  0x03: 'Ack_Data',   // response: acknowledgement carrying a data field
  0x07: 'Userdata',   // extended functions (block, cyclic, security, ...)
};

export const s7comm: ProtocolSpec = {
  id: 's7comm',
  name: 'S7comm',
  layer: 7,
  summary:
    'Siemens S7 Communication, the application protocol of the S7 PLC stack over TCP/102 (inside TPKT/COTP). The header is protocol id 0x32, a ROSCTR message type (Job / Ack / Ack_Data / Userdata), a reserved redundancy id, a PDU reference echoed between request and response, and parameter+data lengths. Responses (Ack / Ack_Data) add a 2-byte error class/code, making the header 12 bytes instead of 10. The function-specific parameter and data areas follow as payload.',
  fields: [
    {
      name: 'protocolId',
      label: 'Protocol Id',
      bits: 8,
      type: 'hex',
      decode: (v) => (v === 0x32 ? '0x32 (S7comm)' : `0x${v.toString(16)} (expected 0x32)`),
      desc: 'The S7comm "magic" byte: always 0x32. It marks the start of an S7comm PDU inside the COTP data unit; a parser uses it to confirm the COTP payload really is S7comm.',
      detail: `PROTOCOL ID (1 byte): constant 0x32. The Wireshark dissector and Siemens tooling treat any first byte other than 0x32 as "not S7comm" and stop. (Note: S7CommPlus, the newer variant, uses 0x72 here instead — that is a different protocol and out of scope.)`,
    },
    {
      name: 'rosctr',
      label: 'ROSCTR (message type)',
      bits: 8,
      type: 'enum',
      enumMap: ROSCTR,
      note: 'Remote Operating Service Control: 0x01 Job (request), 0x02 Ack, 0x03 Ack_Data (response with data), 0x07 Userdata. ROSCTR 0x02/0x03 make the header 12 bytes (extra error class/code).',
      desc: 'The message type. A master sends a Job (0x01) — read/write memory, start/stop, or Setup Communication — and the PLC answers with Ack_Data (0x03), which carries the result data. Userdata (0x07) covers extended functions like block transfer and diagnostics.',
      detail: `ROSCTR (Remote Operating Service Control), Wireshark rosctr_names:
  0x01 Job        Request that expects an acknowledgement: Read Var, Write Var,
                  Setup Communication, PLC control (start/stop), block up/download.
  0x02 Ack        Acknowledgement with NO data field (rare bare ack).
  0x03 Ack_Data   Response to a Job, carrying a data field (e.g. the read values).
  0x07 Userdata   Extended/"user" functions: block functions, cyclic data, time-
                  of-day, security, programmer (online) functions.
HEADER LENGTH DEPENDS ON THIS FIELD: for ROSCTR 0x02 and 0x03 (the response types)
the header is 12 bytes — the extra 2 bytes are the Error class and Error code. For
0x01 (Job) and 0x07 (Userdata) the header is 10 bytes with no error field.`,
    },
    {
      name: 'redundancyId',
      label: 'Redundancy Id',
      bits: 16,
      type: 'hex',
      decode: (v) => (v === 0 ? '0x0000 (reserved)' : `0x${v.toString(16).padStart(4, '0')}`),
      desc: 'A 2-byte field reserved for H-system (redundant PLC) use. On a normal connection it is 0x0000 and carries no meaning.',
      detail: `REDUNDANCY IDENTIFICATION (2 bytes, big-endian): reserved; 0x0000 in ordinary traffic. It is relevant only to Siemens H-system (high-availability redundant) CPUs.`,
    },
    {
      name: 'pduReference',
      label: 'PDU Reference',
      bits: 16,
      desc: 'A request identifier chosen by the master and echoed verbatim by the PLC in the matching response, so a client can pair each Ack_Data with the Job that caused it. The value is opaque; any 16-bit value works.',
      detail: `PROTOCOL DATA UNIT REFERENCE (2 bytes, big-endian per the Wireshark dissector, ENC_BIG_ENDIAN):
- The master picks a reference (often a counter) for each Job; the PLC copies it into the Ack/Ack_Data response unchanged.
- This lets several requests be outstanding on one connection and still be matched to their responses. The value itself has no other meaning to S7comm.`,
    },
    {
      name: 'parameterLength',
      label: 'Parameter length',
      bits: 16,
      decode: (v) => `${v} bytes`,
      desc: 'The length in bytes of the parameter area that follows the header. The parameter area names the function (its first byte is the function code) and carries its fixed arguments — e.g. the address items of a Read Var, or the negotiated PDU size of a Setup Communication.',
      detail: `PARAMETER LENGTH (2 bytes, big-endian): the size of the parameter block that immediately follows the header. The parameter block begins with a 1-byte function code (e.g. 0xF0 Setup Communication, 0x04 Read Var, 0x05 Write Var) and continues with function-specific arguments. Apex bounds the whole PDU by (header + parameterLength + dataLength) and leaves the parameter block in the payload, since its layout depends on the function.`,
    },
    {
      name: 'dataLength',
      label: 'Data length',
      bits: 16,
      decode: (v) => `${v} bytes`,
      desc: 'The length in bytes of the data area that follows the parameter area. It carries bulk values — for example the register/variable values returned by a Read Var, or the data class + values written by a Write Var. It is 0 for requests that carry no bulk data (such as Setup Communication).',
      detail: `DATA LENGTH (2 bytes, big-endian): the size of the data block that follows the parameter block. For a Read Var request it is 0 (only addresses are sent); for the Ack_Data response it holds the returned values, each prefixed by a return code and transport size. Setup Communication carries no data, so dataLength = 0 in both directions.`,
    },
    {
      name: 'errorClass',
      label: 'Error class',
      bits: 8,
      type: 'hex',
      decode: (v, h) => {
        const r = h.get('rosctr');
        if (r !== 0x02 && r !== 0x03) return 'n/a (only present in Ack / Ack_Data responses)';
        return v === 0 ? '0x00 (no error)' : `0x${v.toString(16).padStart(2, '0')}`;
      },
      note: 'Present ONLY for ROSCTR 0x02/0x03 (responses). 0x00 = no error. The high byte of the S7comm error code.',
      desc: 'Only present on Ack / Ack_Data responses (bytes 10). 0x00 means success; non-zero classes report the kind of failure (e.g. application relationship, object definition, hardware fault). Together with the error code it forms the 16-bit S7 error code.',
      detail: `ERROR CLASS (1 byte, responses only — Wireshark "Header Byte 10, only available at type 2 or 3"): the high byte of the combined S7comm error code. 0x00 = no error. Example classes: 0x81 application relationship, 0x82 object definition, 0x83 no resources, 0x84 error on service processing, 0x85 error on supplies, 0x87 access fault.`,
    },
    {
      name: 'errorCode',
      label: 'Error code',
      bits: 8,
      type: 'hex',
      decode: (v, h) => {
        const r = h.get('rosctr');
        if (r !== 0x02 && r !== 0x03) return 'n/a (only present in Ack / Ack_Data responses)';
        return v === 0 ? '0x00 (no error)' : `0x${v.toString(16).padStart(2, '0')}`;
      },
      note: 'Present ONLY for ROSCTR 0x02/0x03 (responses). The low byte of the S7comm error code. 0x00 with class 0x00 = success.',
      desc: 'Only present on Ack / Ack_Data responses (bytes 11). It is the low byte of the 16-bit S7 error code; combined with the error class, 0x0000 means the Job succeeded.',
      detail: `ERROR CODE (1 byte, responses only — Wireshark "Header Byte 11, only available at type 2 or 3"): the low byte of the combined 16-bit error code (error class << 8 | error code). A successful response has error class 0x00 and error code 0x00.`,
    },
  ],
  // Header is 10 bytes for Job (0x01) / Userdata (0x07) and 12 bytes for the
  // response types Ack (0x02) / Ack_Data (0x03), which append error class + code.
  // The errorClass/errorCode fields are declared above (bytes 10-11) but are
  // only CONSUMED when headerBytes returns 12; for a 10-byte header the
  // engine reads them positionally into what is actually the parameter area, so
  // we clamp headerBytes here and the byte view shows the true 10/12-byte split.
  headerBytes: (h: ParsedHeader) => {
    const r = h.get('rosctr');
    return r === 0x02 || r === 0x03 ? 12 : 10;
  },
  // The whole S7 PDU = header + parameter area + data area. Bounding it here keeps
  // a coalesced TCP/TPKT stream's trailing bytes out of this PDU's payload.
  pduBytes: (h: ParsedHeader) => {
    const r = h.get('rosctr');
    const hdr = r === 0x02 || r === 0x03 ? 12 : 10;
    return hdr + h.get('parameterLength') + h.get('dataLength');
  },
  // The parameter/data areas are function-specific (Setup Communication, Read Var,
  // Write Var, ...). We do not invent their layout; they fall through as payload.
  next: () => null,
};
