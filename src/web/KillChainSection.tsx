// Offensive-security synthesis story: the cyber kill chain + defense-in-depth. A real breach is a CHAIN of stages the
// attacker must complete in order (recon → exploit → escalate → move → collect → exfiltrate), each a concrete
// technique with its own Apex story, and each with a defense. The strategic point: the chain is a CONJUNCTION — the
// attacker needs every stage, so breaking ANY single link stops the whole attack. Verified in node: of all 2^6 defense
// combinations a full breach occurs in exactly one (nothing defended); any single defense contains it. Sandboxed/CTF.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

type Stage = { name: string; tech: string; sections: string; defense: string; rungs?: { id: string; label: string }[] };
const STAGES: Stage[] = [
  { name: 'Reconnaissance', tech: 'Scan & map the target', sections: 'find an exposed, vulnerable service', defense: 'attack-surface reduction' },
  { name: 'Exploitation', tech: 'buffer overflow → ROP', sections: 'bufferoverflow · rop (beat NX)', defense: 'ASLR · canary · CFI', rungs: [{ id: 'bufferoverflow', label: 'buffer overflow' }, { id: 'rop', label: 'ROP' }] },
  { name: 'Priv. escalation', tech: 'Meltdown / Rowhammer', sections: 'meltdown · rowhammer', defense: 'KPTI · TRR/ECC', rungs: [{ id: 'meltdown', label: 'Meltdown' }, { id: 'rowhammer', label: 'Rowhammer' }] },
  { name: 'Lateral movement', tech: 'ARP spoof / DNS poison', sections: 'arpspoof · kaminsky', defense: 'DAI · DNSSEC', rungs: [{ id: 'arpspoof', label: 'ARP spoofing' }, { id: 'kaminsky', label: 'Kaminsky' }] },
  { name: 'Collection', tech: 'padding oracle / Spectre', sections: 'paddingoracle · spectre', defense: 'AEAD · const-time', rungs: [{ id: 'paddingoracle', label: 'padding oracle' }, { id: 'spectre', label: 'Spectre' }] },
  { name: 'Exfiltration', tech: 'covert channel out', sections: 'DNS tunnel / timing channel', defense: 'egress filtering' },
];
const reach = (defended: boolean[]) => { for (let i = 0; i < STAGES.length; i++) if (defended[i]) return i; return STAGES.length; };

const BW = 138, BH = 92, BX = 20, BY = 70, GAP = 6;

type Phase = 'chain' | 'techniques' | 'defenses' | 'break' | 'layers' | 'run';

export function KillChainSection({ onOpen }: { onOpen?: (id: string) => void }) {
  const [defended, setDefended] = useState<boolean[]>([false, false, true, false, false, false]);
  const toggle = (i: number) => setDefended((d) => d.map((v, k) => (k === i ? !v : v)));

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string, def: boolean[]): StoryScene =>
    ({ key, title, caption, render: () => <KC phase={key} defended={def} /> });

  const none = [false, false, false, false, false, false];
  const scenes: StoryScene[] = [
    scene('chain', 'An attack is a chain, not one trick', 'A real breach is never a single exploit — it’s a sequence of stages the attacker must complete in order: find a way in, run code, gain privilege, move through the network, collect the data, and get it out. Miss any stage and the objective is never reached. Here, with nothing defended, the attacker walks the whole chain to exfiltration.', none),
    scene('techniques', 'Each stage is a technique you’ve seen', 'These stages aren’t abstract — each is a concrete method, most with its own Apex story. Get code running with a buffer overflow chained into ROP (to sidestep NX). Cross into the kernel with Meltdown or a Rowhammer bit-flip. Pivot across the LAN with ARP spoofing or Kaminsky DNS poisoning. Read protected data with a padding oracle or Spectre. Then tunnel it out.', none),
    scene('defenses', 'Every stage has a defense', 'And every stage has a countermeasure: ASLR, stack canaries and CFI break exploitation; KPTI and TRR/ECC stop the escalation; dynamic ARP inspection and DNSSEC stop the pivot; authenticated encryption and constant-time code stop the read; egress filtering stops the exfil. A whole defensive stack, one layer per attacker stage.', none),
    scene('break', 'Break any one link, stop the attack', 'Here’s the defender’s leverage: the chain is a conjunction — the attacker needs EVERY stage to succeed. So defending a single stage (here, escalation with KPTI) halts the attacker right there; the later stages are never reached. You don’t have to be perfect everywhere — breaking one link contains the whole intrusion.', [false, false, true, false, false, false]),
    scene('layers', 'Why layers beat a single wall', 'No single defense is airtight — ASLR falls to an info leak, a canary to a non-contiguous write, KPTI has known bypasses. But layered, independent defenses each get a turn to break the chain, and the attacker must defeat ALL of them in series. Their failure odds multiply, so many imperfect layers beat one “perfect” wall. It’s also a map of where to detect: the earlier you break the chain, the less damage.', [true, false, true, false, true, false]),
    { key: 'run', title: 'Contain the intrusion', caption: 'Click a stage to raise its defense (shield). The attacker (red) advances left to right and stops dead at the first defended stage — “contained.” Raise none and it reaches exfiltration (full breach); raise any single one and the attack is stopped there. That’s defense-in-depth: you only have to break one link of the chain.', render: () => <KC phase="run" defended={defended} onToggle={toggle} /> },
  ];

  return (
    <>
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>A real breach is never a single exploit — it’s a <strong>chain</strong> of stages the attacker must complete in order: reconnaissance, initial access, exploitation, privilege escalation, lateral movement, collection, and exfiltration. Each stage uses a specific technique (a buffer overflow and ROP to run code, Meltdown or Rowhammer to reach the kernel, ARP or DNS spoofing to move, a padding oracle to read data), and each stage has a defense. The defender’s advantage is that the chain is a <strong>conjunction</strong>: the attacker must succeed at every stage, so breaking any single link — defending any one stage — stops the entire attack.</>,
        takeaway: <>The <strong>cyber kill chain</strong> (Lockheed Martin) frames an intrusion as an ordered sequence of stages — here reconnaissance → exploitation → privilege escalation → lateral movement → collection → exfiltration — each of which the attacker must complete to reach the objective. Every stage maps to concrete techniques, most with their own Apex story: a stack <strong>buffer overflow</strong> chained into <strong>ROP</strong> (defeating NX) for code execution, defeated by ASLR + stack canaries + CFI; <strong>Meltdown</strong> or <strong>Rowhammer</strong> to cross the user/kernel boundary, defeated by KPTI and TRR/ECC; <strong>ARP spoofing</strong> or <strong>Kaminsky</strong> DNS poisoning to intercept traffic, defeated by dynamic ARP inspection and DNSSEC; a <strong>padding oracle</strong> or <strong>Spectre</strong> to read secrets, defeated by authenticated encryption and speculation barriers; and a covert channel to exfiltrate, defeated by egress filtering. The strategic insight is <strong>defense-in-depth</strong>: because the stages form a conjunction (the attack reaches its goal only if EVERY stage succeeds), the defender needs to break just one link — verified here by enumerating all 2⁶ defense combinations, where a full breach occurs in exactly one case (nothing defended) and any single defense contains the attack at that stage. This is why layered, independent controls beat a single strong wall: no individual defense is perfect (ASLR falls to an info leak, KPTI is bypassable, a canary to a non-contiguous overwrite), but an attacker must defeat all of them in series and their failure probabilities multiply. It also tells the defender where to invest — detect and break the chain as early and often as possible — and it’s the same logic behind <strong>MITRE ATT&CK</strong>, which catalogs the techniques at each stage so defenders can map their coverage. (Sandboxed synthesis of the individual attack stories, not a live tool.)</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="kc-ctl">
          <span className="kc-hint">click a stage to raise its defense</span>
          {(() => { const r = reach(defended); return <span className={`kc-live ${r === STAGES.length ? 'bad' : 'ok'}`}>{r === STAGES.length ? '⚠ FULL BREACH — data exfiltrated' : `✓ contained at “${STAGES[r].name}” (${STAGES.length - r} stage${STAGES.length - r === 1 ? '' : 's'} never reached)`}</span>; })()}
        </div>
      )}
    />
    {onOpen && (
      <div className="kc-launchpad">
        <div className="kc-lp-title">The whole journey, in one attack — jump back to any stage’s rung:</div>
        <div className="kc-lp-grid">
          {STAGES.filter((s) => s.rungs?.length).map((s) => (
            <div key={s.name} className="kc-lp-row">
              <span className="kc-lp-stage">{s.name}</span>
              <span className="kc-lp-links">
                {s.rungs!.map((r) => (
                  <button key={r.id} type="button" className="kc-lp-link" onClick={() => onOpen(r.id)}>{r.label} ↗</button>
                ))}
              </span>
            </div>
          ))}
        </div>
      </div>
    )}
    </>
  );
}

function KC({ phase, defended, onToggle }: { phase: Phase; defended: boolean[]; onToggle?: (i: number) => void }) {
  const on = (p: Phase) => phase === p;
  const r = reach(defended);
  const showDef = !on('chain') && !on('techniques');
  return (
    <svg viewBox="0 0 900 320" className="story-svg">
      <text x="60" y="26" className="kc-col">the cyber kill chain · attacker →{r === STAGES.length ? ' full breach' : ` contained at stage ${r + 1}/${STAGES.length}`}</text>

      {/* attacker progress line */}
      <line x1={BX} y1={BY - 16} x2={BX + reachX(r)} y2={BY - 16} className="kc-progress" />
      <text x={BX + reachX(r)} y={BY - 22} className="kc-attacker" textAnchor="middle">{r === STAGES.length ? '💀' : '🛑'}</text>

      {STAGES.map((st, i) => {
        const x = BX + i * (BW + GAP); const breached = i < r; const contained = i === r && r < STAGES.length;
        const state = breached ? 'breached' : contained ? 'contained' : 'unreached';
        return <g key={i} onClick={onToggle ? () => onToggle(i) : undefined} style={{ cursor: onToggle ? 'pointer' : 'default' }}>
          <rect x={x} y={BY} width={BW} height={BH} rx="7" className={`kc-box ${state} ${on('run') ? 'click' : ''}`} />
          <text x={x + BW / 2} y={BY + 18} className="kc-stage" textAnchor="middle">{i + 1}. {st.name}</text>
          <text x={x + BW / 2} y={BY + 38} className="kc-tech" textAnchor="middle">{st.tech}</text>
          {(on('techniques') || on('run')) && <text x={x + BW / 2} y={BY + 54} className="kc-sec" textAnchor="middle">{st.sections}</text>}
          {showDef && <g>
            <rect x={x + 8} y={BY + BH - 26} width={BW - 16} height={19} rx="4" className={`kc-def ${defended[i] ? 'on' : ''}`} />
            <text x={x + BW / 2} y={BY + BH - 12} className={`kc-deflbl ${defended[i] ? 'on' : ''}`} textAnchor="middle">{defended[i] ? '🛡 ' : ''}{st.defense}</text>
          </g>}
          {i < STAGES.length - 1 && <text x={x + BW + GAP / 2 - 1} y={BY + BH / 2 + 4} className="kc-arrow" textAnchor="middle">›</text>}
        </g>;
      })}

      <text x="450" y={BY + BH + 40} className="kc-foot" textAnchor="middle">
        {on('chain') ? 'six stages, in order — the objective needs all of them'
          : on('techniques') ? 'each stage is a real technique — most have their own Apex story'
          : on('defenses') ? 'one defensive layer per attacker stage'
          : on('break') ? 'the chain is a conjunction → defend one stage, stop the whole attack'
          : on('layers') ? 'imperfect layers in series: the attacker must beat every one'
          : r === STAGES.length ? 'no link broken → the attacker reaches exfiltration' : `contained at “${STAGES[r].name}” — break any one link, stop the chain`}
      </text>
    </svg>
  );
}
function reachX(r: number) { const full = STAGES.length * (BW + GAP) - GAP; return r >= STAGES.length ? full : r * (BW + GAP) + BW / 2; }
