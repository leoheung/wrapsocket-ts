import type { ConnectionState } from "./types";

type StateListener = (
  state: ConnectionState,
  previousState: ConnectionState
) => void;

const VALID_TRANSITIONS: Record<ConnectionState, ConnectionState[]> = {
  connecting: ["open", "disconnected", "reconnecting"],
  open: ["disconnected", "reconnecting"],
  disconnected: ["connecting", "reconnecting"],
  reconnecting: ["open", "disconnected", "connecting"],
};

export class StateMachine {
  private _state: ConnectionState = "disconnected";
  private listeners: Set<StateListener> = new Set();

  get state(): ConnectionState {
    return this._state;
  }

  canTransitionTo(newState: ConnectionState): boolean {
    return VALID_TRANSITIONS[this._state].includes(newState);
  }

  transition(newState: ConnectionState): boolean {
    if (!this.canTransitionTo(newState)) {
      return false;
    }

    const previousState = this._state;
    this._state = newState;

    this.listeners.forEach((listener) => {
      try {
        listener(newState, previousState);
      } catch {
        // Ignore listener errors
      }
    });

    return true;
  }

  forceTransition(newState: ConnectionState): void {
    const previousState = this._state;
    this._state = newState;

    this.listeners.forEach((listener) => {
      try {
        listener(newState, previousState);
      } catch {
        // Ignore listener errors
      }
    });
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  reset(): void {
    this._state = "disconnected";
  }
}
