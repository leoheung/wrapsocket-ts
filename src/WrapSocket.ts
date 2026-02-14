import type {
  WrapSocketOptions,
  WrapSocketEvents,
  ConnectionState,
  EventHandler,
  Message,
} from "./types";
import { defaultReconnectOptions, defaultHeartbeatOptions } from "./types";
import { StateMachine } from "./state";
import { ReconnectManager } from "./reconnect";
import { HeartbeatManager } from "./heartbeat";
import { NetworkMonitor } from "./network";
import { VisibilityMonitor } from "./visibility";

type EventKey = keyof WrapSocketEvents;

export class WrapSocket {
  private url: string;
  private protocols?: string | string[];
  private debug: boolean;
  private ws: WebSocket | null = null;
  private stateMachine: StateMachine;
  private reconnectManager: ReconnectManager;
  private heartbeatManager: HeartbeatManager;
  private networkMonitor: NetworkMonitor;
  private visibilityMonitor: VisibilityMonitor;
  private eventHandlers: Map<EventKey, Set<EventHandler<EventKey>>> = new Map();
  private isManualClose = false;
  private wasOnline = true;
  private wasVisible = true;

  constructor(options: WrapSocketOptions) {
    this.url = options.url;
    this.protocols = options.protocols;
    this.debug = options.debug ?? false;

    const reconnectOpts = {
      ...defaultReconnectOptions,
      ...options.reconnect,
    };
    const heartbeatOpts = {
      ...defaultHeartbeatOptions,
      ...options.heartbeat,
    };

    this.stateMachine = new StateMachine();
    this.reconnectManager = new ReconnectManager(reconnectOpts);
    this.heartbeatManager = new HeartbeatManager(
      () => this.sendPing(),
      () => this.handleHeartbeatTimeout(),
      heartbeatOpts
    );
    this.networkMonitor = new NetworkMonitor();
    this.visibilityMonitor = new VisibilityMonitor();

    this.setupStateListener();
    this.setupNetworkMonitor();
    this.setupVisibilityMonitor();
  }

  get state(): ConnectionState {
    return this.stateMachine.state;
  }

  get isConnected(): boolean {
    return this.state === "open";
  }

  get isConnecting(): boolean {
    return this.state === "connecting" || this.state === "reconnecting";
  }

  connect(): void {
    if (this.state === "open" || this.state === "connecting") {
      return;
    }

    this.isManualClose = false;
    this.doConnect();
  }

  private doConnect(): void {
    try {
      this.stateMachine.transition("connecting");
      this.ws = new WebSocket(this.url, this.protocols);
      this.setupWebSocketHandlers();
    } catch (error) {
      this.log("Connection error:", error);
      this.handleConnectionError();
    }
  }

  private setupWebSocketHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = (event: Event) => {
      this.stateMachine.transition("open");
      this.reconnectManager.reset();
      this.heartbeatManager.start();
      this.emit("open", event);
      this.log("Connected");
    };

    this.ws.onclose = (event: CloseEvent) => {
      this.heartbeatManager.stop();
      this.emit("close", event);

      if (this.isManualClose) {
        this.stateMachine.transition("disconnected");
        this.log("Disconnected (manual)");
      } else {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (event: Event) => {
      this.emit("error", event);
      this.log("WebSocket error");
    };

    this.ws.onmessage = (event: MessageEvent) => {
      this.handleMessage(event);
    };
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data) as Message;

      if (data.type === "heartbeat" || data.type === "pong") {
        this.heartbeatManager.pong();
        return;
      }

      this.emit("message", event);
    } catch {
      this.emit("message", event);
    }
  }

  private sendPing(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const ping: Message = {
        type: "heartbeat",
        id:
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : Math.random().toString(36),
        data: "ping",
        timestamp: Date.now(),
      };
      this.ws.send(JSON.stringify(ping));
      this.log("Ping sent");
    }
  }

  private handleHeartbeatTimeout(): void {
    this.log("Heartbeat timeout, closing connection");
    this.ws?.close(1000, "Heartbeat timeout");
  }

  private handleConnectionError(): void {
    if (!this.isManualClose) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (!this.reconnectManager.canReconnect) {
      this.stateMachine.transition("disconnected");
      this.emit("reconnectFailed", this.reconnectManager.currentAttempt);
      this.log(
        "Reconnect failed after",
        this.reconnectManager.currentAttempt,
        "attempts"
      );
      return;
    }

    this.stateMachine.transition("reconnecting");
    const delay = this.reconnectManager.schedule(() => this.doConnect());

    if (delay >= 0) {
      this.emit("reconnecting", this.reconnectManager.currentAttempt, delay);
      this.log(
        "Reconnecting in",
        delay,
        "ms (attempt",
        this.reconnectManager.currentAttempt,
        ")"
      );
    }
  }

  private setupStateListener(): void {
    this.stateMachine.subscribe((state, previousState) => {
      this.emit("stateChange", state, previousState);
    });
  }

  private setupNetworkMonitor(): void {
    this.wasOnline = this.networkMonitor.isOnline;

    this.networkMonitor.start(
      () => {
        this.emit("online");
        this.log("Network online");
        if (!this.wasOnline && this.state === "disconnected") {
          this.connect();
        }
        this.wasOnline = true;
      },
      () => {
        this.emit("offline");
        this.log("Network offline");
        this.wasOnline = false;
      }
    );
  }

  private setupVisibilityMonitor(): void {
    this.wasVisible = this.visibilityMonitor.isVisible;

    this.visibilityMonitor.start((visible: boolean) => {
      this.emit("visibilityChange", visible);
      this.log("Visibility changed:", visible ? "visible" : "hidden");

      if (visible && !this.wasVisible && this.state === "disconnected") {
        this.connect();
      }
      this.wasVisible = visible;
    });
  }

  disconnect(): void {
    this.isManualClose = true;
    this.reconnectManager.stop();
    this.heartbeatManager.stop();

    if (this.ws) {
      this.ws.close(1000, "Manual disconnect");
      this.ws = null;
    }

    this.stateMachine.transition("disconnected");
    this.log("Disconnected");
  }

  reconnect(): void {
    this.isManualClose = false;
    this.reconnectManager.start();
    this.reconnectManager.reset();

    if (this.ws) {
      this.ws.close(1000, "Reconnecting");
    }

    this.scheduleReconnect();
  }

  send(data: string | object): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      this.log("Cannot send: not connected");
      return false;
    }

    const message = typeof data === "string" ? data : JSON.stringify(data);
    this.ws.send(message);
    return true;
  }

  on<K extends EventKey>(event: K, handler: EventHandler<K>): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }

    const handlers = this.eventHandlers.get(event)!;
    handlers.add(handler as EventHandler<EventKey>);

    return () => {
      handlers.delete(handler as EventHandler<EventKey>);
    };
  }

  off<K extends EventKey>(event: K, handler: EventHandler<K>): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler as EventHandler<EventKey>);
    }
  }

  private emit<K extends EventKey>(
    event: K,
    ...args: Parameters<EventHandler<K>>
  ): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          (handler as (...a: Parameters<EventHandler<K>>) => void)(...args);
        } catch (error) {
          this.log("Handler error:", error);
        }
      });
    }
  }

  private log(...args: unknown[]): void {
    if (this.debug) {
      console.log("[WrapSocket]", ...args);
    }
  }

  destroy(): void {
    this.disconnect();
    this.networkMonitor.stop();
    this.visibilityMonitor.stop();
    this.eventHandlers.clear();
    this.log("Destroyed");
  }
}
