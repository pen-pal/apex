import { describe, it, expect } from 'vitest';
import { plan } from '../src/web/sshtunnel';

// Independent oracle: SSH forwarding semantics, not the implementation. -L opens the listener on the CLIENT and the
// server makes the final hop (reach a service the server can see); -R is the mirror (listener on the SERVER, client
// makes the final hop, exposing a local service); -D opens a client-side SOCKS proxy. The right flag meets each goal,
// the wrong one opens the listener on the wrong side and fails. Expected sides/verdicts follow from those rules.

describe('-L local forward: listener on the client, server makes the last hop', () => {
  const p = plan('L', 'reach-internal');
  it('opens the port on the laptop', () => expect(p.listener.side).toBe('laptop'));
  it('meets the goal of reaching a server-side service', () => expect(p.ok).toBe(true));
  it('the final hop is made by the server', () => {
    const last = p.hops[p.hops.length - 1];
    expect(last.node).toBe('server');
    expect(p.cmd).toContain('-L');
  });
});

describe('-R remote forward: listener on the server, client makes the last hop', () => {
  const p = plan('R', 'expose-local');
  it('opens the port on the server (bastion)', () => expect(p.listener.side).toBe('server'));
  it('meets the goal of exposing a local service', () => expect(p.ok).toBe(true));
  it('the final hop is made by the laptop', () => {
    expect(p.hops[p.hops.length - 1].node).toBe('laptop');
    expect(p.cmd).toContain('-R');
  });
});

describe('using the wrong flag opens the listener on the wrong side and fails', () => {
  it('-R for "reach a server-side service" is the wrong direction', () => {
    const p = plan('R', 'reach-internal');
    expect(p.ok).toBe(false);
    expect(p.listener.side).toBe('server'); // listener on the wrong side for this goal
    expect(p.reason).toMatch(/wrong direction|-L/i);
  });
  it('-L for "expose my local app" is the wrong direction', () => {
    const p = plan('L', 'expose-local');
    expect(p.ok).toBe(false);
    expect(p.listener.side).toBe('laptop');
    expect(p.reason).toMatch(/wrong direction|-R/i);
  });
});

describe('-D dynamic: a client-side SOCKS proxy', () => {
  it('opens a SOCKS listener on the client and can reach a server-side service', () => {
    const p = plan('D', 'reach-internal');
    expect(p.listener.side).toBe('laptop');
    expect(p.listener.text).toMatch(/SOCKS/);
    expect(p.ok).toBe(true);
    expect(p.cmd).toContain('-D');
  });
  it('cannot publish a local service inbound (outbound proxy only)', () => {
    expect(plan('D', 'expose-local').ok).toBe(false);
  });
});
