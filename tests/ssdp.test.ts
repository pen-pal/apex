// SSDP dissection test. SSDP reuses the HTTP/1.1 message syntax (RFC 9112)
// carried over UDP (HTTPU/HTTPMU); the wire format is specified by the UPnP
// Device Architecture §1 (Discovery). An SSDP message is US-ASCII text:
// request-line CRLF, *(field-line CRLF), CRLF.
//
// The capture below is a real, on-the-wire M-SEARCH request as emitted by a
// UPnP control point to 239.255.255.250:1900 (this is the canonical
// "discover all" search shown in the UPnP Device Architecture §1.3.2):
//
//   M-SEARCH * HTTP/1.1\r\n
//   HOST: 239.255.255.250:1900\r\n
//   MAN: "ssdp:discover"\r\n
//   MX: 3\r\n
//   ST: ssdp:all\r\n
//   \r\n
//
// We encode that exact string to its ASCII byte values and dissect starting at
// our own layer ('ssdp'). Because SSDP has no binary header (fields: [], and
// headerBytes() => 0), the engine consumes a 0-byte header and the ENTIRE
// message text lands in node.payload. We assert the bytes round-trip back to the
// exact request text — i.e. SSDP is text-framed by CRLF, not by fixed offsets.
import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { ssdp } from '../src/protocols/ssdp';

const REQUEST_TEXT =
  'M-SEARCH * HTTP/1.1\r\n' +
  'HOST: 239.255.255.250:1900\r\n' +
  'MAN: "ssdp:discover"\r\n' +
  'MX: 3\r\n' +
  'ST: ssdp:all\r\n' +
  '\r\n';

// US-ASCII encode (each char is one byte; all chars here are < 0x80).
const bytes = [...REQUEST_TEXT].map((c) => c.charCodeAt(0));

const reg = new ProtocolRegistry();
reg.register(ssdp);

describe('SSDP (UPnP Device Architecture §1; HTTP/1.1 syntax, RFC 9112)', () => {
  it('has no fixed binary header (text-framed protocol)', () => {
    const node = dissect(bytes, 'ssdp', reg);
    expect(node.header.spec.fields).toHaveLength(0);
    expect(node.header.byteLength).toBe(0);
  });

  it('exposes the entire ASCII message as the payload', () => {
    const node = dissect(bytes, 'ssdp', reg);
    expect(node.payload).toHaveLength(bytes.length);
    expect(node.payload).toEqual(bytes);
    const decoded = String.fromCharCode(...node.payload);
    expect(decoded).toBe(REQUEST_TEXT);
  });

  it('is an HTTP-shaped request framed by CRLF (UDA §1.3.2)', () => {
    const node = dissect(bytes, 'ssdp', reg);
    const decoded = String.fromCharCode(...node.payload);
    const lines = decoded.split('\r\n');
    // request-line: Method SP request-target SP HTTP-version
    expect(lines[0]).toBe('M-SEARCH * HTTP/1.1');
    // Required M-SEARCH headers, in order.
    expect(lines[1]).toBe('HOST: 239.255.255.250:1900'); // multicast group + port 1900
    expect(lines[2]).toBe('MAN: "ssdp:discover"'); // mandatory-extension marker (RFC 2774)
    expect(lines[3]).toBe('MX: 3'); // max wait seconds before a device may reply
    expect(lines[4]).toBe('ST: ssdp:all'); // Search Target
    expect(lines[5]).toBe(''); // blank line ends the headers (no body)
  });

  it('the byte view sees real ASCII "M-SEARCH" at the start', () => {
    const node = dissect(bytes, 'ssdp', reg);
    // 'M','-','S','E','A','R','C','H'
    expect(node.payload.slice(0, 8)).toEqual([
      0x4d, 0x2d, 0x53, 0x45, 0x41, 0x52, 0x43, 0x48,
    ]);
  });

  it('targets the SSDP multicast group on UDP/1900', () => {
    const node = dissect(bytes, 'ssdp', reg);
    const decoded = String.fromCharCode(...node.payload);
    expect(decoded).toContain('239.255.255.250:1900');
  });

  it('stops dissecting — there is no nested child protocol', () => {
    const node = dissect(bytes, 'ssdp', reg);
    expect(node.child).toBeNull();
  });
});
