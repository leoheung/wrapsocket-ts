type OnlineCallback = () => void;
type OfflineCallback = () => void;

export class NetworkMonitor {
  private onlineCallback: OnlineCallback | null = null;
  private offlineCallback: OfflineCallback | null = null;
  private isMonitoring = false;

  get isOnline(): boolean {
    if (typeof navigator !== "undefined" && "onLine" in navigator) {
      return navigator.onLine;
    }
    return true;
  }

  get isOffline(): boolean {
    return !this.isOnline;
  }

  start(
    onlineCallback: OnlineCallback,
    offlineCallback: OfflineCallback
  ): void {
    if (this.isMonitoring || typeof window === "undefined") {
      return;
    }

    this.onlineCallback = onlineCallback;
    this.offlineCallback = offlineCallback;
    this.isMonitoring = true;

    window.addEventListener("online", this.handleOnline);
    window.addEventListener("offline", this.handleOffline);
  }

  stop(): void {
    if (!this.isMonitoring || typeof window === "undefined") {
      return;
    }

    window.removeEventListener("online", this.handleOnline);
    window.removeEventListener("offline", this.handleOffline);
    this.isMonitoring = false;
    this.onlineCallback = null;
    this.offlineCallback = null;
  }

  private handleOnline = (): void => {
    this.onlineCallback?.();
  };

  private handleOffline = (): void => {
    this.offlineCallback?.();
  };
}
