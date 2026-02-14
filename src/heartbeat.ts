import type { HeartbeatOptions } from "./types";
import { defaultHeartbeatOptions } from "./types";

type SendPing = () => void;

export class HeartbeatManager {
  private options: HeartbeatOptions;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastPong: number = Date.now();
  private missedPongs = 0;
  private isRunning = false;
  private sendPing: SendPing;
  private onTimeout: () => void;

  constructor(
    sendPing: SendPing,
    onTimeout: () => void,
    options: Partial<HeartbeatOptions> = {}
  ) {
    this.sendPing = sendPing;
    this.onTimeout = onTimeout;
    this.options = { ...defaultHeartbeatOptions, ...options };
  }

  start(): void {
    if (!this.options.enabled || this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.missedPongs = 0;
    this.lastPong = Date.now();

    this.intervalId = setInterval(() => {
      this.sendPing();
    }, this.options.interval);
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
  }

  pong(): void {
    this.lastPong = Date.now();
    this.missedPongs = 0;
  }

  checkTimeout(): boolean {
    const elapsed = Date.now() - this.lastPong;
    if (elapsed > this.options.timeout) {
      this.missedPongs++;
      if (this.missedPongs >= 3) {
        this.onTimeout();
        return true;
      }
    }
    return false;
  }

  get isHealthy(): boolean {
    return this.missedPongs < 3;
  }

  get lastPongTime(): number {
    return this.lastPong;
  }
}
