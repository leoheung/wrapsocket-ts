export type ConnectionState =
  | "connecting"
  | "open"
  | "disconnected"
  | "reconnecting";

export interface WrapSocketOptions {
  url: string;
  protocols?: string | string[];
  reconnect?: ReconnectOptions;
  heartbeat?: HeartbeatOptions;
  debug?: boolean;
}

export interface ReconnectOptions {
  enabled: boolean;
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffFactor: number;
}

export interface HeartbeatOptions {
  enabled: boolean;
  interval: number;
  timeout: number;
}

export interface WrapSocketEvents {
  open: (event: Event) => void;
  close: (event: CloseEvent) => void;
  error: (event: Event) => void;
  message: (data: MessageEvent) => void;
  stateChange: (state: ConnectionState, previousState: ConnectionState) => void;
  reconnecting: (attempt: number, delay: number) => void;
  reconnectFailed: (attempt: number) => void;
  online: () => void;
  offline: () => void;
  visibilityChange: (visible: boolean) => void;
}

export type EventHandler<K extends keyof WrapSocketEvents> =
  WrapSocketEvents[K];

export interface Message {
  type: "event" | "ack" | "heartbeat" | "pong";
  id: string;
  data: unknown;
  timestamp: number;
}

export const defaultReconnectOptions: ReconnectOptions = {
  enabled: true,
  maxAttempts: Infinity,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffFactor: 2,
};

export const defaultHeartbeatOptions: HeartbeatOptions = {
  enabled: true,
  interval: 30000,
  timeout: 10000,
};
