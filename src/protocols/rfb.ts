// RFB (Remote Framebuffer) — the wire protocol of VNC.
// RFC 6143, "The Remote Framebuffer Protocol" (March 2011). RFB runs over a
// reliable byte stream (TCP), by convention on port 5900 (display :0; display
// :N uses 5900+N). A VNC client/server exchange has three phases:
//
//   1. HANDSHAKE  (RFC 6143 §7.1)
//        a. ProtocolVersion — see below, a fixed 12-byte ASCII string.
//        b. Security — server offers security types, client picks one,
//           authentication runs (e.g. VNC challenge-response), SecurityResult.
//   2. INITIALISATION (§7.3) — ClientInit (1 byte: shared flag) then ServerInit
//      (framebuffer width/height, a 16-byte PIXEL_FORMAT, and the desktop name).
//   3. NORMAL PROTOCOL (§7.5/§7.6) — an asynchronous, message-oriented stream.
//      From here on, EVERY client-to-server message begins with a single U8
//      message-type byte that tells the receiver how to parse the rest.
//
// THE PROTOCOLVERSION HANDSHAKE (§7.1.1) — documented but not a `Field` grid.
// -------------------------------------------------------------------------
// The very first thing on the connection (server first, then the client echoes
// its choice) is exactly 12 ASCII bytes of the form "RFB xxx.yyy\n":
//
//   "RFB 003.008\n"  =  52 46 42 20 30 30 33 2e 30 30 38 0a
//    R  F  B     0  0  3  .  0  0  8  \n
//
// xxx and yyy are the zero-padded major/minor version (003.008 = RFB 3.8, the
// version standardised by RFC 6143). This is a TEXT preamble — like HTTP's
// request-line it has no fixed bit-fields — so we do NOT model it as Fields; we
// document it here so the teaching is complete, and model instead a real BINARY
// normal-phase message whose layout IS a fixed bit grid.
//
// WHAT THIS SPEC MODELS: FramebufferUpdateRequest (§7.5.3)
// -------------------------------------------------------
// FramebufferUpdateRequest is the client's way of saying "send me the pixels
// for this rectangle of the screen." It is the heartbeat of an interactive VNC
// session: the client repeatedly asks for updates (usually `incremental`) and
// the server answers with FramebufferUpdate messages. Its 10-byte layout is a
// clean, fixed bit grid, which makes it the ideal client-to-server message to
// dissect here. All multi-byte integers are network byte order / big-endian
// (RFC 6143 §7: "Multiple-byte integers ... are in big-endian order").
//
// We dissect a single client-to-server message: `headerBytes` is the full 10
// bytes, so nothing falls through as payload, and there is no encapsulated
// child protocol, so `next` returns null. (A general RFB stream parser would
// branch on message-type to size each message — out of scope for one spec.)
import type { ProtocolSpec } from '../core/types';

// Client-to-server message types (RFC 6143 §7.5). Type 1 is intentionally
// absent: it is FixColourMapEntries, a SERVER-to-client message (§7.6.2).
const CLIENT_MSG_TYPE: Record<number, string> = {
  0: 'SetPixelFormat',
  2: 'SetEncodings',
  3: 'FramebufferUpdateRequest',
  4: 'KeyEvent',
  5: 'PointerEvent',
  6: 'ClientCutText',
};

export const rfb: ProtocolSpec = {
  id: 'rfb',
  name: 'RFB (VNC)',
  layer: 7,
  summary:
    'The Remote Framebuffer protocol behind VNC, over TCP/5900. After a 12-byte ASCII "RFB 003.008\\n" version handshake and a security/init exchange, the session becomes an asynchronous message stream where each client-to-server message starts with a 1-byte type. This spec models FramebufferUpdateRequest (type 3): the client asking the server to send the pixels of one screen rectangle.',
  fields: [
    {
      name: 'messageType',
      label: 'Message type',
      bits: 8,
      type: 'enum',
      enumMap: CLIENT_MSG_TYPE,
      note: 'First byte of every client-to-server message. 3 = FramebufferUpdateRequest.',
      desc: 'A one-byte tag that tells the server how to parse the rest of this message. In the normal phase the RFB stream has no framing other than this type byte plus the fixed/derived length of each message kind. Here it is 3, FramebufferUpdateRequest.',
      detail: `MESSAGE-TYPE (U8) — the discriminator for client-to-server messages (RFC 6143 §7.5).

CLIENT-TO-SERVER TYPES:
- 0 = SetPixelFormat        — declares how the client wants pixels encoded (bpp, depth, RGB shifts).
- 2 = SetEncodings          — lists the framebuffer encodings the client supports, in preference order (Raw, CopyRect, Tight, ZRLE, plus pseudo-encodings).
- 3 = FramebufferUpdateRequest — "send me the pixels of this rectangle" (this message).
- 4 = KeyEvent              — a key press or release (keysym + down flag).
- 5 = PointerEvent          — mouse position and button mask.
- 6 = ClientCutText         — the client's clipboard text.

(Type 1 is FixColourMapEntries, which goes the OTHER way — server to client — so it is not in the client set.)

WHY A BARE TYPE BYTE WORKS: RFB is asynchronous and message-oriented over a reliable stream. Each message's length is either fixed (FramebufferUpdateRequest is always 10 bytes) or self-describing via an internal length field (SetEncodings, ClientCutText). The receiver reads the type byte, then reads exactly the bytes that type requires before looking for the next type byte.`,
    },
    {
      name: 'incremental',
      label: 'Incremental',
      bits: 8,
      decode: (v) =>
        v === 0
          ? '0 (full update — send the whole rectangle now)'
          : `${v} (incremental — only what changed since the last update)`,
      note: '0 = send the full rectangle; non-zero = send only changes since the last FramebufferUpdate.',
      desc: 'A boolean flag. When zero, the client wants the entire requested rectangle sent immediately (used on connect or after a resize). When non-zero, the client already has a copy and only wants the regions that changed — the basis of efficient interactive VNC.',
      detail: `INCREMENTAL (U8 boolean, RFC 6143 §7.5.3).

= 0 (non-incremental): the server MUST send the whole requested rectangle as a FramebufferUpdate, even if nothing changed. Clients use this for the first request and after anything that invalidates their copy (e.g. a desktop-size change).

≠ 0 (incremental): the server sends a FramebufferUpdate covering only the parts of the rectangle that have changed since the last update the client received. If nothing has changed, the server may legitimately send nothing yet — so a well-behaved client does not block waiting for a reply; it keeps the request/update loop going asynchronously.

THE INTERACTIVE LOOP: after the initial full request, a VNC client streams incremental FramebufferUpdateRequests; the server coalesces screen changes and answers with FramebufferUpdate messages. This request/update pumping is what makes the remote desktop feel live.`,
    },
    {
      name: 'xPosition',
      label: 'X position',
      bits: 16,
      note: 'Left edge (in pixels) of the requested rectangle within the framebuffer.',
      desc: 'The x coordinate of the top-left corner of the rectangle the client is requesting, measured in pixels from the left edge of the framebuffer. Big-endian.',
      detail: `X-POSITION (U16, big-endian, RFC 6143 §7.5.3).

The framebuffer is addressed as a grid of pixels with the origin (0,0) at the TOP-LEFT. This field is the column of the requested rectangle's left edge. Together with y-position, width, and height it defines the exact rectangle the client wants pixels for — typically the whole screen (0,0,W,H), but a client may request smaller regions.`,
    },
    {
      name: 'yPosition',
      label: 'Y position',
      bits: 16,
      note: 'Top edge (in pixels) of the requested rectangle within the framebuffer.',
      desc: 'The y coordinate of the top-left corner of the requested rectangle, measured in pixels down from the top edge of the framebuffer. Big-endian.',
      detail: `Y-POSITION (U16, big-endian, RFC 6143 §7.5.3).

The row of the requested rectangle's top edge, with (0,0) at the top-left of the framebuffer (y increases downward, screen-coordinate convention). Bounds the rectangle vertically together with height.`,
    },
    {
      name: 'width',
      label: 'Width',
      bits: 16,
      note: 'Width of the requested rectangle, in pixels.',
      desc: 'The width in pixels of the rectangle being requested. For a full-screen update this equals the framebuffer width that the server announced in ServerInit.',
      detail: `WIDTH (U16, big-endian, RFC 6143 §7.5.3).

Pixels wide. The rectangle requested is [x-position, x-position+width) horizontally. A request for the whole screen sets x-position=0 and width = the framebuffer width from ServerInit. The maximum is 65535, comfortably above real display widths.`,
    },
    {
      name: 'height',
      label: 'Height',
      bits: 16,
      note: 'Height of the requested rectangle, in pixels.',
      desc: 'The height in pixels of the rectangle being requested. For a full-screen update this equals the framebuffer height the server announced in ServerInit.',
      detail: `HEIGHT (U16, big-endian, RFC 6143 §7.5.3).

Pixels tall. The rectangle requested is [y-position, y-position+height) vertically. Combined with x/y/width this fully specifies the region the client wants the server to encode and return in a FramebufferUpdate.`,
    },
  ],
  // FramebufferUpdateRequest is a fixed 10-byte message with no body of its own:
  // 1 (type) + 1 (incremental) + 2 (x) + 2 (y) + 2 (width) + 2 (height).
  headerBytes: () => 10,
  // It carries no encapsulated protocol — the server answers separately with a
  // FramebufferUpdate message — so dissection stops here.
  next: () => null,
};
