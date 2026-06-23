// The shared simulation clock. All four views subscribe to ONE event stream so
// they stay synchronized: stepping the handshake advances the byte view, the
// journey view, the conversation view, and the state machine together.
// (Phase 2 wires the views to this; the contract lives here from day one.)

export interface SimEvent {
  t: number;                 // logical step index
  kind: string;              // 'send' | 'recv' | 'state' | ...
  actor: 'client' | 'server';
  label: string;             // e.g. 'SYN'
  payload?: unknown;         // view-specific detail
}

type Listener = (event: SimEvent, history: SimEvent[]) => void;

export class SimClock {
  private history: SimEvent[] = [];
  private listeners = new Set<Listener>();
  private t = 0;

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(event: Omit<SimEvent, 't'>): void {
    const full: SimEvent = { ...event, t: this.t++ };
    this.history.push(full);
    for (const fn of this.listeners) fn(full, this.history);
  }

  reset(): void {
    this.history = [];
    this.t = 0;
  }

  get events(): readonly SimEvent[] { return this.history; }
}
