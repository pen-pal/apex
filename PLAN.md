# Apex — roadmap

Principle: **start small, grow gradually, keep the bytes real.** Each phase ships something genuinely correct and visual before the next is started. Every protocol is a registry entry; the engine never changes to add one.

---

## Phase 0 — the spine (engine + registry)  ✅ in place
Refactor away from one-off prototypes into a generic, data-driven engine.

**Done**
- `ProtocolSpec` contract (`src/core/types.ts`).
- Generic `dissect()` engine + `BitReader` + registry + `buildFrame()`.
- Verified `inetChecksum` (RFC 1071) and `crc32` (IEEE 802.3).
- Ethernet II, IPv4, TCP as data-driven specs (with TCP state machine + handshake declared).
- CLI demo (`npm run demo`) — build a frame, dissect it back, recover the payload with the FCS isolated as a trailer.
- Tests for checksums, IPv4 parsing/bounding, and full round-trip.
- Minimal browser entry so `npm run dev` runs the engine.

**Acceptance:** `npm run test:run` green; `npm run demo` recovers the payload; nothing in `src/core/` names a protocol.

## Phase 0.1 — the byte / anatomy view  ✅ in place
Port the prototype's clickable hex grid onto the engine output. Colour each byte by its field via `bitOffset`/`bits`; click to decode; expand flag/sub-byte fields to bits. Number-vs-text insight (`443` → `01 BB` vs `34 34 33`).
**Acceptance:** every byte of a built frame is attributed to a field, generated entirely from `DissectionNode`.

**Done**
- `src/web/byteModel.ts` — pure, React-free derivation: flattens the `DissectionNode` tree into one attributed `ByteCell` per frame byte (layer, region, and the field slice(s) that own each byte, with packed sub-byte fields split by bit width). Names no protocol.
- `src/web/ByteView.tsx` + `colors.ts` — hex grid coloured per field (packed bytes show a bit-proportional gradient), a layer legend, and a decode panel (hex/bin/dec/ascii, per-field meaning, flag bit breakdown). Clicking a byte highlights every byte of the same field.
- `src/web/main.tsx` — app shell with a Text/Number input toggle delivering the `443` → `01 BB` vs `34 34 33` insight.
- `tests/byteModel.test.ts` — asserts full byte coverage, stack layout, and packed-byte splitting.
- Note surfaced: the Ethernet FCS is reported under IPv4's trailer (Ethernet II has no length field to bound its own PDU), so the engine surfaces it past the IPv4 `totalLength` boundary. The view labels it honestly as the frame trailer.

## Phase 1 — the journey / encapsulation view  ✅ in place
Animate data going down the stack, the frame on the wire, a router re-wrapping for the next hop, and back up. Show the overhead each layer adds.
**Acceptance:** the journey is rendered from the `child` chain + builder segments, with the router re-wrap visible.

**Done**
- `src/web/journeyModel.ts` — derives the journey from engine data: the layer nest from the dissection `child` chain, the flat byte layout from `buildFrame` segments, and the **router re-wrap by re-building the frame through the same specs with a next-hop connection (TTL−1, new MACs) and diffing the two dissections** — so no protocol offsets live in the view. Reports field-level before→after changes and the engine-recovered payload.
- `src/web/JourneyView.tsx` — five sections in the light theme (matching `d.html`'s layout): animated nested encapsulation boxes (overhead accumulates inside-out), a proportional byte-layout bar, an on-the-wire NRZ-L signal (SVG square wave of the first 32 bits), the router re-wrap (TTL 64→63, IP checksum + Ethernet FCS recomputed; end-to-end fields untouched), and a decapsulation peel + recovered-message badge.
- `src/web/main.tsx` — a Byte-anatomy / Journey tab switcher; both views derive from the same built frame.
- `tests/journeyModel.test.ts` — asserts the nest/overhead, segment-sum = total, real round-trip recovery, and that the router changes exactly TTL/IP-checksum/MACs/FCS while leaving IPs, ports, seq, and the TCP checksum unchanged.

## Phase 2 — conversation + state machine, synchronized
Wire the conversation/sequence view (`spec.conversation`) and the state-machine view (`spec.states`) to the `SimClock`. Stepping the handshake advances all four views together, with seq/ack numbers evolving.
**Acceptance:** one `SimClock` step updates byte, journey, conversation, and state views in lockstep — the synchronization that was hard to do by hand.

## Phases 3–6 — protocol breadth  ✅ largely in place
Added as pure data-driven registry additions (one spec file + test each; engine untouched except a generic wide-field hook):
- **UDP** (RFC 768), **DNS** (RFC 1035) — UDP→DNS dispatch by port works.
- **HTTP/1.1** (RFC 9112) — modeled honestly as text (no binary fields; whole segment is ASCII).
- **TLS** (RFC 8446) — record layer dissected; application-data records left **opaque** (no invented plaintext).
- **ARP** (RFC 826), **ICMP** (RFC 792), **ICMPv6** (RFC 4443), **IPv6** (RFC 8200), **DHCP** (RFC 2131), **QUIC** (RFC 9000, long-header prefix; encrypted body opaque).
- Engine: generic **wide-field path** (fields > 48 bits read into `ParsedField.bytes`; `ipv6` formatter with RFC 5952 `::` compression, `bytes` formatter) — no protocol names in core.
- Each ships a real-bytes test; all RFC-fact-checked against the spec.
- UI: an **Examples** picker loads each protocol's real capture into the byte-anatomy view.

## Phase 7 — interactivity & real captures  ✅ in place
- **Generic real-checksum builder** (`buildStack`) — composes any layer stack (Ethernet/IPv4/UDP/TCP) around a payload with real checksums + FCS, via each spec's `encode` and a `childId` demux hook. No engine changes.
- **Full end-to-end example frames** — every example is now a real frame (Ethernet→IPv4→UDP/TCP→app); the journey, lifecycle and checksum views show the whole stack (HTTP/TLS surface the real TCP lifecycle; IPv4 checksums validate).
- **Advanced builder controls** — edit src/dst IP, ports, TTL, window, TCP flags; the frame rebuilds live with per-field validation (`connectionForm`).
- **TLS crypto sandbox** (`CryptoView`) — real WebCrypto AES-256-GCM on sandbox values; shows the opaque TLS application_data record shape and the avalanche effect (flip one plaintext bit → ~half the 128-bit auth tag changes). Never decrypts real captures.
- **.pcap import** (`pcap.ts` + UI) — load a classic libpcap file, pick a packet, dissect it through every view. Ships `sample.pcap` (7 real frames).

**Still open (depth):** TLS handshake-as-states + WebCrypto key exchange; TCP segmentation/reassembly; loss/retransmit in the state view; pcapng support; IPv6 in the generic builder (needs IPv6 addresses on `Connection`); SimClock wiring so all views step from one timeline.

## Phase 8 — the protocol pipeline (ongoing)
Goal: cover the practical protocol universe (roughly Wireshark's common dissector set), one fleet at a time. Each round is a workflow of data-driven specs + RFC-fact-checked tests; rounds run **sequentially** (concurrent fleets would clobber each other's `tsc` checks). After each round: apply verifier fixes → wire dispatch maps + register → add example frames → reload the app.

- **Round 1 ✅** — UDP, ARP, ICMP, IPv6, ICMPv6, DNS, DHCP, HTTP, TLS, QUIC.
- **Round 2 ✅** — SMB2, NTP, RTP, TFTP, SNMP, SSH, OSPF, IGMP, GRE, 802.1Q VLAN, FTP, SMTP, POP3, IMAP, Telnet, SIP. (+ generic `endian:'le'` engine hook for SMB2.)
- **Round 3 ⏳** — SCTP, ESP, AH, VRRP, BGP, LLDP, EAPOL, PPPoE, VXLAN, WireGuard, MQTT, Modbus, RADIUS, Syslog.
- **Round 4 (queued)** — DHCPv6, mDNS, LLMNR, NBNS/NetBIOS, Kerberos, LDAP, TACACS+, DTLS, IKE/ISAKMP, CoAP.
- **Round 5 (queued)** — RIP, EIGRP, PIM, IS-IS, HSRP, STP/RSTP, CDP, MPLS, L2TP, PPP.
- **Round 6 (queued)** — RTCP, Diameter, AMQP, NFS/SunRPC (portmap), iSCSI, PTP (1588), GTP-U, BACnet, DNP3, RADIUS-acct.
- **Round 7+ (queued)** — SMB1, RDP, VNC/RFB, IRC, XMPP, WHOIS, Finger, SOCKS, WebSocket, RARP, DCCP, MACsec ✅ (802.1AE SecTAG, conditional SCI, opaque ICV), QinQ (802.1ad), 802.11, …

Net count grows each round; the engine and `src/core/` stay protocol-agnostic throughout (only generic hooks — wide fields, `endian` — are ever added).

---

### Definition of done (every phase)
Tests pass · new protocols cite their RFC and have capture-anchored tests · `src/core/` still names no protocol · the relevant view renders from engine data · an accuracy review reports no blocking issues.
