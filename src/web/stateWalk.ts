// Walk a StateMachine through a sequence of events, collecting the states it
// visits. Pure — the state-machine view animates over this. Generic over any
// StateMachine; the event list is a teaching choice passed in by the view.
import type { ConversationSpec, DissectionNode, StateMachine } from '../core/types';

export interface StateStep {
  state: string; // state BEFORE the event
  event: string | null; // event that fires from here (null at the end)
  next: string | null; // resulting state
}

/** Follow `events` from the machine's initial state, stopping if an event has no transition. */
export function walkStates(machine: StateMachine, events: string[]): StateStep[] {
  const steps: StateStep[] = [];
  let state = machine.initial;
  for (const event of events) {
    const next = machine.transitions[state]?.[event] ?? null;
    steps.push({ state, event, next });
    if (next == null) break;
    state = next;
  }
  steps.push({ state, event: null, next: null });
  return steps;
}

/** The canonical client active-open → data → active-close lifecycle (real transitions). */
export const TCP_CLIENT_LIFECYCLE = ['send-SYN', 'recv-SYN+ACK', 'close', 'recv-ACK', 'recv-FIN', 'timeout'];

/** Find the first layer in a tree that declares a state machine (e.g. TCP). */
export function findStateful(
  tree: DissectionNode,
): { machine: StateMachine; conversation?: ConversationSpec; name: string } | null {
  for (let n: DissectionNode | null = tree; n; n = n.child) {
    if (n.header.spec.states) {
      return { machine: n.header.spec.states, conversation: n.header.spec.conversation, name: n.header.spec.name };
    }
  }
  return null;
}
