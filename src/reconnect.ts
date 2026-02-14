import type { ReconnectOptions } from "./types";
import { defaultReconnectOptions } from "./types";

type ReconnectCallback = () => void | Promise<void>;

export class ReconnectManager {
  private options: ReconnectOptions;
  private attempt = 0;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private isStopped = false;

  constructor(options: Partial<ReconnectOptions> = {}) {
    this.options = { ...defaultReconnectOptions, ...options };
  }

  get currentAttempt(): number {
    return this.attempt;
  }

  get canReconnect(): boolean {
    if (!this.options.enabled) return false;
    if (this.isStopped) return false;
    if (this.attempt >= this.options.maxAttempts) return false;
    return true;
  }

  calculateDelay(): number {
    const { initialDelay, maxDelay, backoffFactor } = this.options;
    const delay = initialDelay * Math.pow(backoffFactor, this.attempt);
    return Math.min(delay, maxDelay);
  }

  schedule(callback: ReconnectCallback): number {
    if (!this.canReconnect) {
      return -1;
    }

    const delay = this.calculateDelay();
    this.attempt++;

    this.timeoutId = setTimeout(async () => {
      if (this.isStopped) return;
      await callback();
    }, delay);

    return delay;
  }

  reset(): void {
    this.attempt = 0;
    this.cancel();
  }

  cancel(): void {
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  stop(): void {
    this.isStopped = true;
    this.cancel();
  }

  start(): void {
    this.isStopped = false;
  }
}
