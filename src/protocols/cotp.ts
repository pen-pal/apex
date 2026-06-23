// COTP — Connection-Oriented Transport Protocol. ISO/IEC 8073 / ITU-T X.224,
// carried over TCP per RFC 905 (the ISO Transport Protocol specification) and
// RFC 1006 (ISO transport over TCP). Authoritative reference for the TPDU codes
// and the DT structure used here: RFC 905 §13 ("Structure and encoding of
// TPDUs"). https://www.rfc-editor.org/rfc/rfc905
//
// COTP is the ISO layer-4 transport beneath the Siemens S7 stack:
//   TCP/102 -> TPKT -> COTP -> S7comm.
// Over TCP, S7 uses transport class 0, so the headers are short.
//
// TPDU STRUCTURE (RFC 905 §13.2)
// ------------------------------
// Every TPDU begins with:
//   byte 0:  LI   Length Indicator — the number of octets in the header that
//                 FOLLOW this LI byte (it does NOT count the LI byte itself, and
//                 it does NOT count the user data). So header length = LI + 1.
//   byte 1:  TPDU code — the high nibble selects the TPDU type; the low nibble
//                 is type-specific (a credit value, or 0).
//
// TPDU CODES (RFC 905 §13.1, high nibble of byte 1):
//   CR 1110 (0xE0)  Connection Request
//   CC 1101 (0xD0)  Connection Confirm
//   DR 1000 (0x80)  Disconnect Request
//   DC 1100 (0xC0)  Disconnect Confirm
//   DT 1111 (0xF0)  Data
//   ED 0001 (0x10)  Expedited Data
//   AK 0110 (0x60)  Data Acknowledgement
//   EA 0010 (0x20)  Expedited Acknowledgement
//   RJ 0101 (0x50)  Reject
//   ER 0111 (0x70)  TPDU Error
//
// DATA (DT) TPDU, class 0/1 normal format (RFC 905 §13.7.1.a, §13.7.3):
//   byte 0: LI (= 2 for class 0)
//   byte 1: DT code 1111 0000 (0xF0)
//   byte 2: bit 8 = EOT (End of TSDU; 1 = last DT of this data unit),
//           bits 7-1 = TPDU-NR (send sequence number, 0 in class 0).
// So a class-0 DT carrying an "end of data" S7 message looks like: 02 F0 80.
//
// DISPATCH: only a DT (0xF0) TPDU carries user data (the S7comm PDU). CR/CC/DR/
// DC and the acknowledgement TPDUs carry COTP connection parameters (TSAPs,
// TPDU size, …) as a variable part, NOT an S7 PDU — so next() returns 's7comm'
// only for DT, and null otherwise.
//
// ENDIANNESS: single-byte fields; no multi-byte ordering applies.
import type { ProtocolSpec, ParsedHeader } from '../core/types';

// RFC 905 §13.1 — TPDU code values (the byte as a whole; the low nibble is 0 for
// the fixed-format types and a credit/sequence value for CC/AK/RJ). We key the
// enum on the high nibble so credit bits in the low nibble don't change the name.
const TPDU_TYPE: Record<number, string> = {
  0xe: 'CR (Connection Request)',
  0xd: 'CC (Connection Confirm)',
  0x8: 'DR (Disconnect Request)',
  0xc: 'DC (Disconnect Confirm)',
  0xf: 'DT (Data)',
  0x1: 'ED (Expedited Data)',
  0x6: 'AK (Data Acknowledgement)',
  0x2: 'EA (Expedited Acknowledgement)',
  0x5: 'RJ (Reject)',
  0x7: 'ER (TPDU Error)',
};

export const cotp: ProtocolSpec = {
  id: 'cotp',
  name: 'COTP (ISO 8073)',
  layer: 4,
  summary:
    'The ISO connection-oriented transport protocol (ISO 8073 / X.224) run over TCP per RFC 905/1006, beneath the Siemens S7 stack. Each TPDU starts with a Length Indicator (octets of header after it) and a TPDU code whose high nibble names the type (CR/CC/DT/...). A Data (DT) TPDU then carries an EOT bit + send sequence number; its user data is the S7comm PDU. Only DT TPDUs carry S7 — connection TPDUs carry COTP parameters instead.',
  fields: [
    {
      name: 'lengthIndicator',
      label: 'Length Indicator',
      bits: 8,
      decode: (v) => `${v} (header = ${v + 1} bytes incl. this LI)`,
      desc: 'The number of header octets that FOLLOW this byte — it does not count itself and does not count the user data. The full COTP header length is therefore LI + 1. For a class-0 Data TPDU the LI is 2 (the code byte plus the EOT/sequence byte).',
      detail: `LENGTH INDICATOR (1 byte, RFC 905 §13.2.1):
- "The length indicator field is contained in the first octet of the TPDU. The value is the length of the header in octets ... excluding the length indicator field and the user data field."
- Header length = LI + 1. The user data (the S7comm PDU for a DT) is NOT counted by LI; it is bounded by the enclosing TPKT length instead.
- A class-0 DT has LI = 2 (DT code byte + EOT/TPDU-NR byte). A Connection Request/Confirm has a larger LI because it carries a variable part (source/destination references, TSAPs, TPDU size).`,
    },
    {
      name: 'pduType',
      label: 'TPDU type',
      bits: 4,
      type: 'enum',
      enumMap: TPDU_TYPE,
      note: 'High nibble of the TPDU code byte. 0xE=CR, 0xD=CC, 0xF=DT (Data), 0x8=DR. Only DT carries an S7comm PDU.',
      desc: 'The 4 most-significant bits of the TPDU code byte select the TPDU type: Connection Request/Confirm to open the transport connection, Data (DT) to carry payload, Disconnect to tear it down. The Siemens S7 PDU rides inside DT TPDUs only.',
      detail: `TPDU CODE — high nibble (RFC 905 §13.1, table of TPDU codes):
  CR 1110  Connection Request   — open the ISO transport connection (carries TSAPs, TPDU size)
  CC 1101  Connection Confirm   — accept it (echoes/negotiates the same parameters)
  DR 1000  Disconnect Request   — tear the connection down
  DC 1100  Disconnect Confirm
  DT 1111  Data                 — carry one TSDU fragment (the S7comm PDU lives here)
  ED 0001  Expedited Data
  AK 0110  Data Acknowledgement
  EA 0010  Expedited Acknowledgement
  RJ 0101  Reject
  ER 0111  TPDU Error
For S7 over TCP the sequence is: CR -> CC opens the connection, then every S7 request/response is a DT TPDU. The low nibble of the code byte is 0 for fixed-format types and a credit/sequence value for CC/AK/RJ.`,
    },
    {
      name: 'pduTypeLow',
      label: 'Code (low nibble)',
      bits: 4,
      type: 'hex',
      note: 'Low nibble of the TPDU code byte — a credit value for CC/AK/RJ, otherwise 0.',
      desc: 'The 4 least-significant bits of the TPDU code byte. For the fixed-format types (DT, CR, DR, ...) this is 0; for CC, AK and RJ it carries the flow-control credit (CDT) value.',
    },
    {
      name: 'eot',
      label: 'EOT (End of TSDU)',
      bits: 1,
      decode: (v, h) =>
        h.get('pduType') !== 0xf
          ? 'n/a (only meaningful in a DT TPDU)'
          : v
            ? '1 (last DT of this data unit)'
            : '0 (more DTs follow)',
      note: 'Bit 8 of the DT byte after the code. 1 = this is the final DT TPDU of the TSDU. Only meaningful for DT TPDUs.',
      desc: 'For a Data (DT) TPDU, the high bit of the byte after the code marks End Of TSDU: set to 1 when this DT is the last fragment of a complete transport data unit, 0 when more DTs follow. S7 messages are small and usually fit one DT, so this is normally 1.',
      detail: `EOT (RFC 905 §13.7.3.c): "When set to ONE, indicates that the current DT TPDU is the last data unit of a complete DT TPDU sequence (End of TSDU). EOT is bit 8 of octet 3 in class 0 and 1." This field, together with TPDU-NR, occupies the byte after the DT code; it is only present (and only meaningful) on DT TPDUs. For non-DT TPDUs this byte is part of the connection variable part — Apex still shows it positionally but it carries no EOT meaning there.`,
    },
    {
      name: 'tpduNumber',
      label: 'TPDU number',
      bits: 7,
      decode: (v, h) =>
        h.get('pduType') !== 0xf ? `${v} (n/a outside a DT TPDU)` : String(v),
      note: 'Bits 7-1 of the DT byte after the code: the send sequence number (0 in class 0). Only meaningful for DT TPDUs.',
      desc: 'For a Data (DT) TPDU, the low 7 bits of the byte after the code are the send sequence number (TPDU-NR). In transport class 0 — which S7 over TCP uses — there is no transport-level flow control, so this is 0.',
      detail: `TPDU-NR (RFC 905 §13.7.3.d): "TPDU send Sequence Number (zero in Class 0). TPDU-NR is bits 7-1 of octet 3 for classes 0 and 1." S7 over TCP uses class 0, so TPDU-NR is 0 and the EOT|TPDU-NR byte for a normal S7 DT is 0x80 (EOT=1, NR=0).`,
    },
  ],
  // Header length = Length Indicator + 1 (the LI counts the bytes after itself).
  // This covers CR/CC (larger LI with a variable part) and DT (LI = 2) uniformly.
  headerBytes: (h) => h.get('lengthIndicator') + 1,
  // Only a Data (DT) TPDU (high nibble 0xF) carries the S7comm PDU. Connection
  // and acknowledgement TPDUs carry COTP parameters, not S7 — so stop there.
  next: (h: ParsedHeader) => (h.get('pduType') === 0xf ? 's7comm' : null),
};
