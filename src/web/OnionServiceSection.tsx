// Onion (hidden) services — reach a server that has no public IP, with neither side learning the other's location.
// Auto-plays the rendezvous protocol step by step; a small table shows the mutual-anonymity guarantee. Model in
// onionservice.ts.
import { useEffect, useState } from 'react';
import { rendezvousKnowledge, mutuallyAnonymous } from './onionservice';

const STEPS = [
  { icon: '🧅', title: 'No public IP', desc: 'The service has no address to connect to. It builds Tor circuits out to a few relays and asks them to be its introduction points.' },
  { icon: '📖', title: 'Publish descriptor', desc: 'It signs a descriptor — its public key + those intro points — and stores it in the DHT, keyed by its .onion address, which IS its public key (self-authenticating, no certificate authority).' },
  { icon: '🔎', title: 'Client fetches it', desc: 'You enter the .onion address; your client looks it up in the DHT, gets the signed descriptor, verifies it against the address itself, and learns the intro points — never the server’s IP.' },
  { icon: '🤝', title: 'Rendezvous setup', desc: 'Your client picks a rendezvous relay, builds a circuit to it, and — through an introduction point — tells the service: “meet me at rendezvous R, here’s a one-time cookie.”' },
  { icon: '🔒', title: 'Connected — both anonymous', desc: 'Both sides extend a Tor circuit to the rendezvous point, which splices them together. It sees two circuits, not two IPs: the client never learns the server’s location, the server never learns the client’s.' },
];

export function OnionServiceSection() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  useEffect(() => {
    if (!playing) return;
    const last = step >= STEPS.length - 1;
    const t = setTimeout(() => setStep((s) => (s >= STEPS.length - 1 ? 0 : s + 1)), last ? 2600 : 1800);
    return () => clearTimeout(t);
  }, [playing, step]);

  const know = rendezvousKnowledge();
  const anon = mutuallyAnonymous(know);

  return (
    <div className="ons">
      <p className="ons-intro">
        Normally a server has an IP you connect to — which means it can be found, blocked, or seized. An
        <strong> onion service</strong> (a <code>.onion</code> address) has <em>no public IP at all</em>. You still reach it,
        and the twist is that <strong>neither side learns the other’s location</strong> — the anonymity is mutual. Here’s how
        the rendezvous does it.
      </p>

      <div className="ons-flowbar">
        <div className="ons-flow">
          {STEPS.map((st, i) => (
            <div key={st.title} className="ons-cell">
              <div className={`ons-step ${i === step ? 'on' : ''} ${i < step ? 'done' : ''}`}>
                <div className="ons-ico">{st.icon}</div>
                <div className="ons-st-title">{i + 1}. {st.title}</div>
              </div>
              {i < STEPS.length - 1 && <div className={`ons-arrow ${i < step ? 'lit' : ''}`}>→</div>}
            </div>
          ))}
        </div>
        <button type="button" className={`ons-play ${playing ? 'on' : ''}`} onClick={() => setPlaying((p) => !p)}>{playing ? '❚❚' : '▶'}</button>
      </div>

      <div className="ons-caption"><strong>{STEPS[step].title}.</strong> {STEPS[step].desc}</div>

      <div className="ons-know">
        <div className="ons-know-h">who learns what, once connected — {anon ? 'no relay sees both ends' : 'anonymity broken'}</div>
        <table className="ons-table">
          <thead><tr><th>relay</th><th>sees client IP?</th><th>sees service IP?</th></tr></thead>
          <tbody>
            {know.map((r) => (
              <tr key={r.role}>
                <td>{r.role}</td>
                <td className={r.seesClientIp ? 'yes' : 'no'}>{r.seesClientIp ? 'yes' : 'no'}</td>
                <td className={r.seesServiceIp ? 'yes' : 'no'}>{r.seesServiceIp ? 'yes' : 'no'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="ons-foot">
        The result is <strong>mutual anonymity</strong>: each side reaches the rendezvous over its own 3-hop circuit, so the
        rendezvous point splices two circuits without seeing either endpoint, and no single relay knows both IPs. Because the
        address <em>is</em> the public key, the connection is <strong>self-authenticating</strong> — no certificate authority,
        and you’re guaranteed you reached the real service, not an impostor. This is the backbone of censorship-resistant
        publishing (and, yes, of hidden marketplaces): there is no server location to raid and no domain to seize. (Tor
        rendezvous specification; v3 onion services.)
      </p>
    </div>
  );
}
