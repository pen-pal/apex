// 802.1Q VLANs, made visible. Build the 4-byte tag and watch the bytes change;
// follow a frame across access and trunk ports (tagged on the trunk, untagged to the
// host); then run the double-tagging VLAN hop that abuses the native VLAN. The tag
// bytes are real (vlanlab.ts, matching the 802.1Q dissector). Defensive/educational.
import { useState } from 'react';
import { buildTag, parseTag, stripOuter, type Tag } from './vlanlab';

const PCP_NAME = ['BE', 'BK', 'EE', 'CA', 'VI', 'VO', 'IC', 'NC']; // 802.1p priority classes
const hx = (b: number) => b.toString(16).padStart(2, '0').toUpperCase();

export function VlanSection() {
  const [vid, setVid] = useState(100);
  const [pcp, setPcp] = useState(5);
  const [dei, setDei] = useState(false);
  const tag: Tag = { vid, pcp, dei: dei ? 1 : 0 };
  const bytes = buildTag(tag);
  const p = parseTag(bytes);

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>① The 4-byte 802.1Q tag</h2></div>
        <p className="jsec-sub">
          A switch slips a 4-byte tag into the Ethernet frame, right after the source MAC: a <strong>TPID</strong> of{' '}
          <code>0x8100</code> marks the frame tagged, then a <strong>TCI</strong> packs the priority (PCP), a drop-eligible bit
          (DEI), and the 12-bit <strong>VLAN id</strong>.
        </p>
        <div className="vl-controls">
          <label>VLAN id <input type="number" min={0} max={4095} value={vid} onChange={(e) => setVid(Math.min(4095, Math.max(0, Number(e.target.value) || 0)))} /></label>
          <label>PCP <input type="range" min={0} max={7} value={pcp} onChange={(e) => setPcp(Number(e.target.value))} /> <span className="vl-pcp">{pcp} ({PCP_NAME[pcp]})</span></label>
          <label className="vl-dei"><input type="checkbox" checked={dei} onChange={(e) => setDei(e.target.checked)} /> DEI</label>
        </div>
        <div className="vl-frame">
          <div className="vl-f-field mac">dst MAC<span>6</span></div>
          <div className="vl-f-field mac">src MAC<span>6</span></div>
          <div className="vl-f-field tag">
            <div className="vl-tag-bytes">{[...bytes].map((b, i) => <code key={i} className={i < 2 ? 'tpid' : 'tci'}>{hx(b)}</code>)}</div>
            802.1Q tag<span>4</span>
          </div>
          <div className="vl-f-field etype">EtherType<span>2</span></div>
          <div className="vl-f-field payload">payload …</div>
        </div>
        <div className="vl-decode">
          TPID <code>0x8100</code> · PCP <code>{p.pcp}</code> ({PCP_NAME[p.pcp]}) · DEI <code>{p.dei}</code> · VID <code>{p.vid}</code>
        </div>
      </section>

      <section className="jsec">
        <div className="jsec-head"><h2>② Access ports vs trunk ports</h2></div>
        <p className="jsec-sub">
          An <strong>access</strong> port belongs to one VLAN and hosts send/receive <em>untagged</em> — the switch adds the tag on
          the way in and strips it on the way out. A <strong>trunk</strong> carries many VLANs between switches, every frame{' '}
          <em>tagged</em> so the far side knows which VLAN it belongs to.
        </p>
        <div className="vl-topo">
          <div className="vl-host v10">PC-A<span>VLAN 10</span></div>
          <div className="vl-link">access<br /><em>untagged</em></div>
          <div className="vl-sw">SW1</div>
          <div className="vl-link trunk">trunk<br /><em>tag: VLAN 10</em></div>
          <div className="vl-sw">SW2</div>
          <div className="vl-link">access<br /><em>untagged</em></div>
          <div className="vl-host v10">PC-B<span>VLAN 10</span></div>
        </div>
        <p className="vl-note">PC-A and PC-B share VLAN 10 and talk freely; a PC in VLAN 20 on the same switches is invisible to them — that isolation is the whole point. Routing between VLANs needs a layer-3 device.</p>
      </section>

      <section className="jsec">
        <div className="jsec-head"><h2>③ Double-tagging VLAN hop</h2></div>
        <p className="jsec-sub">
          The classic attack: a host on the <strong>native</strong> VLAN sends a frame with <em>two</em> tags. The first switch strips
          the outer (native) tag as usual and forwards onto the trunk — where the <strong>inner</strong> tag survives and the second
          switch delivers it into the victim VLAN the attacker was never allowed to reach.
        </p>
        <div className="vl-hop">
          <div className="vl-hop-stage">
            <div className="vl-hop-l">attacker → SW1</div>
            <div className="vl-tags"><span className="vl-t outer">VLAN 1 (native)</span><span className="vl-t inner">VLAN 20</span><span className="vl-t pay">payload</span></div>
          </div>
          <div className="vl-hop-arrow">SW1 strips the outer native tag ▼</div>
          <div className="vl-hop-stage">
            <div className="vl-hop-l">on the trunk → SW2</div>
            <div className="vl-tags">{stripOuter([{ vid: 1, pcp: 0, dei: 0 }, { vid: 20, pcp: 0, dei: 0 }]).map((t) => <span key={t.vid} className="vl-t inner">VLAN {t.vid}</span>)}<span className="vl-t pay">payload</span></div>
          </div>
          <div className="vl-hop-arrow done">SW2 delivers into <strong>VLAN 20</strong> ✓ (one-way)</div>
        </div>
        <p className="vl-note">
          Mitigations: don’t put hosts on the native VLAN, set a dedicated unused native VLAN, or force <code>vlan dot1q tag
          native</code> so even native traffic is tagged and the trick fails. It’s one-way (no return path), but enough to inject
          frames into a segment you shouldn’t reach.
        </p>
      </section>
    </div>
  );
}
