# The four synchronized views

The project exists because learning a protocol from **static** diagrams forces you to synchronize them in your head: the layer-stack picture, the handshake picture, and the state-machine picture each show one facet of the *same* events, and you have to line them up yourself. Apex renders all of them from one engine, driven by one clock, so they move together.

Each view is **derived from engine data** — no view re-describes a protocol's layout.

## 1. Byte / anatomy view
The hex grid. Every byte is coloured by which field owns it, using each `ParsedField`'s `bitOffset` and `bits`. Clicking a byte opens a decode panel; flag and sub-byte fields (TCP flags, IP version/IHL) expand to a bit-level view. This is the "type `443` and watch it become `01 BB` as an int vs `34 34 33` as text" view.
*Source:* `DissectionNode.header.fields`.

## 2. Journey / encapsulation view
Data going **down** the stack (payload wrapped by TCP, then IPv4, then Ethernet), the frame crossing the link, a router stripping the link layer and re-wrapping for the next hop, then the receiver going **up** the stack. Built by walking the `child` chain of the dissection tree.
*Source:* the `DissectionNode` tree + `buildFrame` segments. *Maps to: the layer-stack-with-router diagram.*

## 3. Conversation / sequence view
The handshake as a sequence diagram between client and server, with sequence/ack numbers evolving step by step (SYN: seq=x → SYN,ACK: seq=y, ack=x+1 → ACK: ack=y+1).
*Source:* `spec.conversation` (see `tcpHandshake` in `tcp.ts`). *Maps to: the SYN/SYN-ACK/ACK diagram.*

## 4. Behaviour / state-machine view
The protocol's state diagram with the current state highlighted, advancing as events fire (CLOSED → SYN_SENT → ESTABLISHED → …).
*Source:* `spec.states` (see `tcpStateMachine` in `tcp.ts`). *Maps to: the TCP state-machine diagram.*

## What synchronizes them
All four subscribe to one `SimClock` (`src/sim/clock.ts`). Advancing the simulation emits a single `SimEvent`; each view reacts to the same event stream, so the byte that's highlighted, the arrow that's drawn, and the state that lights up always refer to the same moment. No view keeps a private timeline.

```
            ┌─────────────┐
   step ──► │  SimClock   │ ──emit(event)──┬─► byte view
            └─────────────┘                ├─► journey view
                                           ├─► conversation view
                                           └─► state-machine view
```

Build order (see PLAN.md): byte view first (it already exists in prototype form), then journey, then conversation + state machine wired to the clock together — because those last two are exactly the diagrams that were hardest to synchronize by hand.
