// The Double Ratchet, made visible. Send messages to advance the symmetric hash
// chain (each gets its own key), and run a DH ratchet to reseed the root from a fresh
// key exchange. Then "compromise" the device and watch the colouring: past messages
// stay safe (forward secrecy — their keys are gone), messages in the current epoch
// after the compromise leak, and the next DH ratchet heals everything after it
// (post-compromise security). Real SHA-256 chains (ratchet.ts, tested).
import { useState } from 'react';
import { symStep, dhStep, shortHex } from './ratchet';

const rand = () => Uint8Array.from({ length: 32 }, () => Math.floor(Math.random() * 256));

interface Msg { id: number; epoch: number; from: string; mk: string }

export function RatchetSection() {
  const [rk, setRk] = useState<Uint8Array>(rand);
  const [ck, setCk] = useState<Uint8Array>(rand);
  const [epoch, setEpoch] = useState(0);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [next, setNext] = useState(0);
  const [comp, setComp] = useState<{ at: number; epoch: number } | null>(null);

  const send = () => {
    const s = symStep(ck);
    setMsgs((m) => [...m, { id: next, epoch, from: next % 2 ? 'Bob' : 'Alice', mk: shortHex(s.mk, 6) }]);
    setCk(s.ck);
    setNext((n) => n + 1);
  };
  const ratchet = () => { const d = dhStep(rk, rand()); setRk(d.rk); setCk(d.ck); setEpoch((e) => e + 1); };
  const compromise = () => setComp({ at: msgs.length, epoch });
  const reset = () => { setRk(rand()); setCk(rand()); setEpoch(0); setMsgs([]); setNext(0); setComp(null); };

  const status = (m: Msg, idx: number): 'safe' | 'leak' => {
    if (!comp) return 'safe';
    return idx >= comp.at && m.epoch === comp.epoch ? 'leak' : 'safe'; // exposed only in the compromise epoch, from the compromise point on
  };

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>The Double Ratchet — a key per message</h2></div>
        <p className="jsec-sub">
          Two ratchets give Signal/WhatsApp their guarantees. The <strong>symmetric ratchet</strong> is a one-way hash chain:
          every message advances the chain key and emits a fresh message key, then the key is deleted. The <strong>DH ratchet</strong>{' '}
          folds a new key exchange into the root, reseeding the chains. Build a conversation, then compromise the device.
        </p>

        <div className="rt-keys">
          <span>root key <code>{shortHex(rk, 6)}</code></span>
          <span>chain key <code>{shortHex(ck, 6)}</code></span>
          <span>DH epoch <code>{epoch}</code></span>
        </div>
        <div className="rt-controls">
          <button onClick={send}>✉ send message</button>
          <button onClick={ratchet}>🔄 DH ratchet (new key exchange)</button>
          <button className="rt-danger" onClick={compromise} disabled={!!comp}>💥 compromise device now</button>
          <button className="rt-ghost" onClick={reset}>↺ reset</button>
        </div>

        <div className="rt-thread">
          {msgs.length === 0 && <div className="rt-empty">Send some messages, run a DH ratchet, send more — then compromise.</div>}
          {msgs.map((m, idx) => {
            const boundary = idx > 0 && m.epoch !== msgs[idx - 1].epoch;
            const compHere = comp && comp.at === idx;
            return (
              <div key={m.id}>
                {boundary && <div className="rt-epoch">— DH ratchet → epoch {m.epoch} (chains reseeded) —</div>}
                {compHere && <div className="rt-comp-line">💥 device compromised here — attacker now holds the current chain key</div>}
                <div className={`rt-msg ${m.from === 'Alice' ? 'a' : 'b'} ${status(m, idx)}`}>
                  <span className="rt-from">{m.from}</span>
                  <span className="rt-mk">MK {m.mk}</span>
                  <span className="rt-flag">{status(m, idx) === 'leak' ? '🔓 exposed' : '🔒 safe'}</span>
                </div>
              </div>
            );
          })}
          {comp && comp.at === msgs.length && <div className="rt-comp-line">💥 device compromised here — only this epoch’s remaining messages are at risk</div>}
        </div>

        {comp && (
          <div className="rt-explain">
            <strong>Forward secrecy:</strong> every message before the compromise stays <strong>🔒 safe</strong> — its key was a
            deleted hash-chain output, and the stolen chain key only runs <em>forward</em>. <strong>Post-compromise security:</strong>{' '}
            the next <strong>DH ratchet</strong> reseeds the root from a key exchange the attacker can’t see, so everything after it
            heals back to <strong>🔒 safe</strong>. Only the current epoch, from the breach onward, leaks.
          </div>
        )}

        <p className="rt-foot">
          This is why a single stolen phone doesn’t expose a whole chat history, and why the conversation self-heals once both
          sides ratchet again. In real Signal each direction has its own sending chain, and the DH ratchet runs automatically
          whenever a message carries a new ratchet public key.
        </p>
      </section>
    </div>
  );
}
