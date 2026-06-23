// SSDP — Simple Service Discovery Protocol, the discovery layer of UPnP.
// SSDP was first specified in the IETF draft "draft-cai-ssdp-v1-03" (Oct 1999)
// and later folded into the UPnP Device Architecture (UDA 1.0/1.1/2.0). It has
// no standalone RFC; the closest normative wire-syntax reference is the UPnP
// Device Architecture spec §1 (Discovery), which in turn reuses the HTTP/1.1
// message grammar of RFC 9112 (formerly RFC 2616). This spec cites those.
//
// SSDP is "HTTPU/HTTPMU" — HTTP messages carried not over TCP but directly over
// UDP (HTTPU = HTTP-over-Unicast-UDP, HTTPMU = HTTP-over-Multicast-UDP). The
// message bytes look exactly like an HTTP/1.1 request, but the transport is a
// single UDP datagram, and discovery traffic is sent to a well-known multicast
// group rather than to one host.
//
// TRANSPORT: UDP, destination port 1900 (the IANA-reserved "ssdp" port). The
// multicast group is 239.255.255.250 (IPv4, the IANA-reserved relative
// administratively-scoped address 5; UPnP 2.0 also defines IPv6 link-local
// FF02::C, site-local FF05::C, etc.). A control point multicasts searches to
// 239.255.255.250:1900; devices multicast their presence to the same group and
// answer searches by UNICAST UDP back to the searcher's source address/port.
//
// THE THREE MESSAGE KINDS (all HTTP/1.1-shaped):
//   1. Search request   — control point -> multicast group:
//        M-SEARCH * HTTP/1.1\r\n
//        HOST: 239.255.255.250:1900\r\n
//        MAN: "ssdp:discover"\r\n        (an HTTP "mandatory extension" hdr, RFC 2774)
//        MX: 3\r\n                        (max seconds a device may wait before replying)
//        ST: ssdp:all\r\n                 (Search Target: what you're looking for)
//        \r\n
//   2. Search response  — device -> searcher, UNICAST, looks like an HTTP reply:
//        HTTP/1.1 200 OK\r\n
//        CACHE-CONTROL: max-age=1800\r\n  (how long this advert stays valid)
//        LOCATION: http://192.168.1.5:80/desc.xml\r\n  (URL of the device description)
//        ST: upnp:rootdevice\r\n
//        USN: uuid:...::upnp:rootdevice\r\n  (Unique Service Name)
//        \r\n
//   3. Presence announce — device -> multicast group, when it (dis)appears:
//        NOTIFY * HTTP/1.1\r\n
//        HOST: 239.255.255.250:1900\r\n
//        NT: upnp:rootdevice\r\n           (Notification Type)
//        NTS: ssdp:alive\r\n               (or "ssdp:byebye" when leaving; "ssdp:update")
//        USN: uuid:...::upnp:rootdevice\r\n
//        CACHE-CONTROL: max-age=1800\r\n
//        LOCATION: http://192.168.1.5:80/desc.xml\r\n
//        \r\n
//
// WHY THIS SPEC HAS NO BIT-FIELDS
// -------------------------------
// Exactly like http.ts and sip.ts, SSDP is a TEXT, line-oriented protocol. A
// message is US-ASCII characters delimited by CRLF (\r\n) and the ":" field
// separator, not bits at fixed offsets. The request-line, header order, and the
// header names that appear all vary message to message, so there is no field
// that lives "at bit offset N for K bits". Inventing offsets would be a lie
// about the wire. So we model SSDP truthfully:
//
//   * fields: []            — there is no fixed binary header to dissect.
//   * headerBytes: () => 0  — nothing is consumed as a binary header, so the
//                             ENTIRE UDP payload falls through as node.payload,
//                             which IS the ASCII message text. The byte view then
//                             shows the real bytes (0x4D 0x2D 0x53 0x45 0x41 0x52
//                             0x43 0x48 = "M-SEARCH").
//   * no `next`             — there is no further protocol nested inside; the
//                             message is the application data, so dissection stops.
//
// MESSAGE FRAMING: over UDP each SSDP message is exactly one datagram. There is
// no Content-Length body framing in practice — the blank CRLF line ends the
// headers and (for these discovery messages) there is no body. The datagram
// boundary bounds the message. We don't implement length rules here; the whole
// UDP payload is simply node.payload.
import type { ProtocolSpec } from '../core/types';

export const ssdp: ProtocolSpec = {
  id: 'ssdp',
  name: 'SSDP',
  layer: 7,
  summary:
    'A TEXT, line-based discovery protocol for UPnP — "HTTP over UDP" (HTTPU/HTTPMU), on UDP port 1900 and the multicast group 239.255.255.250. A message looks exactly like an HTTP/1.1 request: a request-line ("M-SEARCH * HTTP/1.1" to find services, or "NOTIFY * HTTP/1.1" to announce presence), header field-lines each ended by CRLF (HOST, MAN, MX, ST for searches; NT, NTS, USN, LOCATION for notifies), and a blank CRLF. Like HTTP it has no fixed bit-fields — it is framed by \\r\\n and ":", so Apex shows the raw message text rather than a byte grid. Control points M-SEARCH the multicast group; devices reply by unicast and announce themselves with NOTIFY.',
  // Intentionally empty: SSDP has no fixed binary header. It reuses the HTTP/1.1
  // message grammar (RFC 9112) carried over UDP (HTTPU/HTTPMU). See the
  // top-of-file comment. With headerBytes() => 0 the whole UDP payload becomes
  // node.payload, exposing the real ASCII message bytes in the byte view.
  fields: [],
  // No binary header is consumed, so the entire UDP payload is the message text
  // (request-line, header field-lines, blank line).
  headerBytes: () => 0,
  // There is no protocol nested inside an SSDP message — it is the application
  // data itself — so dissection stops here.
};
