// The data-driven contract. A protocol is DATA, not code: it declares its
// fields, how to find the next layer, and (optionally) its behaviour and
// construction. The engine reads these specs; it never hardcodes a protocol.
// See docs/protocol-spec.md for the authoring guide.

// 'ipv6' and 'bytes' are byte-oriented: their value can exceed 48 bits, so the
// engine reads them into ParsedField.bytes (a byte array) rather than a number.
export type FieldType = 'uint' | 'hex' | 'ipv4' | 'mac' | 'enum' | 'flags' | 'ipv6' | 'bytes';

/** One field in a protocol header. Widths are in BITS; sub-byte fields are fine. */
export interface Field {
  name: string;                 // machine name, e.g. "srcPort"
  label: string;                // human label, e.g. "Source port"
  bits: number;                 // width in bits
  type?: FieldType;             // how to format the value (default: decimal uint)
  enumMap?: Record<number, string>;     // for type 'enum'
  flagBits?: string[];          // for type 'flags'; index 0 = most-significant bit
  decode?: (value: number, header: ParsedHeader) => string; // human meaning
  endian?: 'le';                // read this (byte-aligned) field little-endian; default is big-endian (network order)
  note?: string;                // short teaching note
  desc?: string;                // one-paragraph plain explanation of the field
  detail?: string;              // deep-dive teaching text (multi-line; \n preserved)
}

export interface ParsedField {
  field: Field;
  value: number;                // numeric value (exact for <= 48 bits; 0 for byte-oriented fields)
  bytes?: number[];             // raw bytes for byte-oriented fields (> 48 bits, e.g. IPv6 address)
  bitOffset: number;            // absolute bit offset within this PDU
  bits: number;
  display: string;              // formatted value
  meaning?: string;             // decoded human meaning
}

export interface ParsedHeader {
  spec: ProtocolSpec;
  fields: ParsedField[];
  byteLength: number;           // header length in bytes
  get(name: string): number;    // numeric value of a field by name
}

/** One layer of a dissected PDU. child === next layer up the stack. */
export interface DissectionNode {
  header: ParsedHeader;
  raw: number[];                // every byte of this PDU
  payload: number[];            // bytes after the header, bounded by length fields
  trailer: number[];            // trailing bytes not part of the PDU (FCS / padding)
  child: DissectionNode | null;
}

/** Behaviour view (e.g. the TCP state diagram). */
export interface StateMachine {
  initial: string;
  states: string[];
  transitions: Record<string, Record<string, string>>; // state -> event -> nextState
}

/** Conversation / sequence view (e.g. the TCP connection lifecycle). */
export interface ConversationStep {
  from: 'client' | 'server';
  label: string;                // 'SYN', 'SYN, ACK', 'PSH, ACK (data)'
  note?: string;                // teaching description of this step
  flags?: string;               // e.g. 'SYN (0x02)' — shown in the packet box
  clientState?: string;         // each endpoint's state AFTER this step
  serverState?: string;
  /** How the sender's sequence number advances: SYN/FIN consume 1, data consumes the payload length. */
  advance?: 'syn' | 'data' | 'fin' | 'none';
}
export interface ConversationSpec { participants: [string, string]; steps: ConversationStep[]; }

/** Example endpoint parameters used when BUILDING a frame from data. */
export interface Connection {
  srcMac: number[]; dstMac: number[];
  srcIp: number[]; dstIp: number[];
  srcIp6: number[]; dstIp6: number[];   // 16-byte IPv6 addresses
  srcPort: number; dstPort: number;
  seq: number; ack: number; flags: number; window: number; ttl: number;
}
export interface BuildCtx {
  payload: number[];
  conn: Connection;
  childId?: string;  // the protocol id encapsulated inside this layer (sets demux fields: EtherType, IP protocol, …)
  network?: string;  // the enclosing network-layer id ('ipv4' | 'ipv6'), e.g. to pick the right checksum pseudo-header
}

export interface ProtocolSpec {
  id: string;                   // 'ethernet', 'ipv4', 'tcp'
  name: string;                 // 'Ethernet II'
  layer: number;                // OSI-ish layer number, for grouping
  summary: string;              // one-line teaching summary
  fields: Field[];
  /** Which protocol id is inside? Return null to stop dissecting. */
  next?: (header: ParsedHeader, registry: Registry) => string | null;
  /** Header length in bytes when variable (e.g. IHL*4). Default: ceil(sum(bits)/8). */
  headerBytes?: (header: ParsedHeader) => number;
  /** Total PDU length (header + payload) when a length field says so (e.g. IP totalLength). */
  pduBytes?: (header: ParsedHeader) => number;
  /** Build THIS layer's header bytes (generator direction). */
  encode?: (ctx: BuildCtx) => number[];
  states?: StateMachine;
  conversation?: ConversationSpec;
}

export interface Registry {
  get(id: string): ProtocolSpec | undefined;
  register(spec: ProtocolSpec): void;
  all(): ProtocolSpec[];
}
