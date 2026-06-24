// IPsec ESP, made visible. Flip between transport and tunnel mode and watch the packet get wrapped:
// the ESP header (SPI + seq) stays readable so the receiver can find the right key, an encrypted
// region (shown locked/opaque — never invented plaintext) hides the payload (transport) or the entire
// original packet incl. addresses (tunnel), and an ICV authenticates it. See exactly what an
// eavesdropper can still read, and how the receiver demuxes by SPI. Logic from ipsec.ts (tested).
import { useMemo, useState } from 'react';
import { encapsulate, demux, type Mode, type SADB, type Endpoints } from './ipsec';

const EP: Endpoints = { origSrc: '10.1.1.5', origDst: '10.2.2.9', gwSrc: '203.0.113.1', gwDst: '198.51.100.1' };
const SPI = 0x1234;
const SADB: SADB = { [SPI]: { spi: SPI, peer: EP.gwDst, cipher: 'AES-GCM-128' } };

export function IpsecSection() {
  const [mode, setMode] = useState<Mode>('tunnel');
  const p = useMemo(() => encapsulate(mode, SPI, 7, EP), [mode]);
  const sa = demux(SADB, SPI);

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>IPsec ESP — the two ways a VPN wraps a packet</h2></div>
        <p className="jsec-sub">
          ESP encrypts and authenticates IP traffic. It always adds a header carrying a <strong>SPI</strong> (which security association / key to
          use) and a sequence number, encrypts a region, and appends an integrity tag. What changes between modes is <strong>how much</strong> it
          hides: <strong>transport</strong> mode protects just the payload (endpoints stay visible); <strong>tunnel</strong> mode protects the whole
          original packet and adds a new gateway-to-gateway IP header — the classic site-to-site VPN.
        </p>

        <div className="esp-modes">
          {(['transport', 'tunnel'] as Mode[]).map((m) => (
            <button key={m} className={`esp-mode ${mode === m ? 'on' : ''}`} onClick={() => setMode(m)}>{m}<span>{m === 'transport' ? 'host ↔ host' : 'gateway ↔ gateway'}</span></button>
          ))}
        </div>

        <div className="esp-stack">
          {p.layers.map((l, i) => (
            <div key={i} className={`esp-layer ${l.encrypted ? 'enc' : ''}`}>
              <div className="esp-lhead">{l.encrypted && <span className="esp-lock">🔒</span>}<b>{l.label}</b></div>
              <div className="esp-ldetail">{l.detail}</div>
            </div>
          ))}
        </div>
        <div className="esp-overhead">+{p.overheadBytes} bytes overhead · ESP trailer Next Header = {p.nextHeader}</div>

        <div className={`esp-observer ${p.originalHidden ? 'hidden' : 'exposed'}`}>
          <div className="esp-obhead">👁️ what an on-path eavesdropper reads</div>
          <div className="esp-obval">IP {p.observerSees.src} → {p.observerSees.dst}</div>
          <div className="esp-obnote">{p.originalHidden
            ? `Only the gateway addresses. The real endpoints (${EP.origSrc} → ${EP.origDst}) are inside the ciphertext — tunnel mode hides the topology.`
            : `The real endpoints are visible — transport mode hides the conversation, not who is having it.`}</div>
        </div>

        <div className="esp-demux">
          <div className="esp-dhead">receiver: demux by SPI</div>
          <div className="esp-drow">arriving SPI <code>0x{SPI.toString(16)}</code> → SA found → decrypt with <b>{sa?.cipher}</b> (peer {sa?.peer})</div>
          <div className="esp-drow muted">an unknown SPI has no SA → the packet is dropped (anti-spoofing)</div>
        </div>

        <p className="esp-foot">
          ESP gives confidentiality + integrity; its sibling AH gives integrity only and is now rarely used. The keys and algorithms in each SA
          aren’t configured by hand — they’re negotiated by <strong>IKEv2</strong>, which authenticates the peers and runs a Diffie-Hellman
          exchange to derive fresh session keys. Tunnel mode’s topology hiding is why it underpins site-to-site VPNs and secure overlays; the
          honest caveat is that traffic <em>analysis</em> still leaks packet sizes and timing even when the contents are opaque.
        </p>
      </section>
    </div>
  );
}
